import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MembersMenu } from './MembersMenu';
import type { MembersMenuProps, MenuMember } from './MembersMenu';

const alice: MenuMember = { user_id: 'u1', username: 'alice', role: 'owner' };
const bob: MenuMember = { user_id: 'u2', username: 'bob', role: 'editor' };

function setup(overrides: Partial<MembersMenuProps> = {}) {
  const props: MembersMenuProps = {
    label: 'Collaborateurs',
    load: vi.fn(() => Promise.resolve([alice, bob])),
    remove: vi.fn(() => Promise.resolve()),
    canRemove: (m) => m.role !== 'owner',
    onRemoved: vi.fn(),
    emptyMessage: 'Aucun collaborateur.',
    confirmMessage: 'Retirer ?',
    removeLabel: (name) => `Retirer ${name}`,
    ...overrides,
  };
  render(<MembersMenu {...props} />);
  return props;
}

async function openMenu() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Collaborateurs' })); });
}

describe('MembersMenu', () => {
  it('charge la liste à l’ouverture et affiche les rôles', async () => {
    const props = setup();
    await openMenu();
    expect(props.load).toHaveBeenCalledTimes(1);
    expect(screen.getByText('@alice')).toBeTruthy();
    expect(screen.getByText('propriétaire')).toBeTruthy();
    // Le propriétaire n'est pas retirable.
    expect(screen.queryByRole('button', { name: 'Retirer alice' })).toBeNull();
  });

  it('retire un membre après confirmation', async () => {
    const props = setup();
    await openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer bob' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /confirmer|retirer|oui/i })); });
    expect(props.remove).toHaveBeenCalledWith('u2');
    expect(props.onRemoved).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('@bob')).toBeNull();
  });

  it('affiche une erreur de chargement sans relancer en boucle', async () => {
    const props = setup({ load: vi.fn(() => Promise.reject(new Error('réseau'))) });
    await openMenu();
    expect(screen.getByText('Erreur de chargement.')).toBeTruthy();
    expect(props.load).toHaveBeenCalledTimes(1);
  });
});

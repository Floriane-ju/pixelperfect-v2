import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';

async function openMenu() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Options' })); });
}

describe('Menu — item interrupteur', () => {
  it('bascule sans fermer le menu', async () => {
    const onClick = vi.fn();
    render(<Menu items={[{ label: 'Lien public', checked: false, onClick }]} />);
    await openMenu();
    const toggle = screen.getByRole('menuitemcheckbox', { name: 'Lien public' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeNull();
  });

  it('affiche l’action secondaire et ferme le menu après son clic', async () => {
    const copy = vi.fn();
    const item: MenuItem = {
      label: 'Lien public',
      checked: true,
      onClick: vi.fn(),
      action: { icon: 'duplicate', label: 'Copier le lien', onClick: copy },
    };
    render(<Menu items={[item]} />);
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copier le lien' }));
    expect(copy).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

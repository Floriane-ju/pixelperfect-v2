import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button — infobulle icon-only', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const hover = (el: HTMLElement, pointerType: string) => {
    fireEvent.pointerEnter(el, { pointerType });
    act(() => vi.advanceTimersByTime(500));
  };

  it('affiche le title (sinon aria-label) au survol souris puis le masque', () => {
    render(
      <Button iconOnly iconLeft="import" aria-label="Importer une bibliothèque" title="Importer" />
    );
    const btn = screen.getByRole('button', { name: 'Importer une bibliothèque' });
    expect(btn.getAttribute('title')).toBeNull();

    hover(btn, 'mouse');
    expect(screen.getByText('Importer')).toBeTruthy();

    fireEvent.pointerLeave(btn);
    expect(screen.queryByText('Importer')).toBeNull();
  });

  it('retombe sur aria-label et se ferme à Escape', () => {
    render(<Button iconOnly iconLeft="export" aria-label="Exporter" />);
    hover(screen.getByRole('button'), 'mouse');
    expect(screen.getByText('Exporter')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Exporter')).toBeNull();
  });

  it('ignore le tactile et les boutons avec libellé', () => {
    render(
      <>
        <Button iconOnly iconLeft="export" aria-label="Exporter" />
        <Button aria-label="Valider" title="Valider">
          Valider
        </Button>
      </>
    );
    hover(screen.getByRole('button', { name: 'Exporter' }), 'touch');
    hover(screen.getByRole('button', { name: 'Valider' }), 'mouse');
    expect(screen.queryAllByText('Exporter')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Valider' }).getAttribute('title')).toBe('Valider');
  });
});

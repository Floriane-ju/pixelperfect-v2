import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorPanel } from './ColorPanel';

describe('ColorPanel', () => {
  it("ne met pas le focus sur le champ à l'ouverture", () => {
    render(
      <ColorPanel onClose={() => {}}>
        <input aria-label="hex" />
      </ColorPanel>,
    );
    expect(document.activeElement).not.toBe(screen.getByLabelText('hex'));
  });
});

describe('ColorPanel anchorY', () => {
  it('garde le panneau dans la fenêtre quand la pastille est près du haut', () => {
    const height = 400;
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
    const { container } = render(<ColorPanel onClose={() => {}} anchorY={10}><div /></ColorPanel>);
    const top = parseFloat((container.firstChild as HTMLElement).style.top);
    expect(top).toBeGreaterThanOrEqual(0);
    spy.mockRestore();
  });

  it('garde le panneau dans la fenêtre quand la pastille est près du bas', () => {
    const height = 400;
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
    const { container } = render(<ColorPanel onClose={() => {}} anchorY={window.innerHeight - 5}><div /></ColorPanel>);
    const top = parseFloat((container.firstChild as HTMLElement).style.top);
    expect(top + height).toBeLessThanOrEqual(window.innerHeight);
    spy.mockRestore();
  });
});

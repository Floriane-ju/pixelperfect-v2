import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS } from '../hooks/useLongPress';
import { TOOLS } from '../tools';
import type { ToolDef } from '../tools';
import type { Tool } from '../Canvas/Canvas';
import { ToolButton } from './ToolButton';

const pencil = TOOLS.find((t) => t.tool === 'pencil') as ToolDef;
const fill = TOOLS.find((t) => t.tool === 'fill') as ToolDef;

function Harness({ def, initialTool = 'fill', onSelect }: { def: ToolDef; initialTool?: Tool; onSelect: (t: Tool) => void }) {
  const [tool, setTool] = useState<Tool>(initialTool);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(3);
  return (
    <ToolButton
      def={def}
      active={tool === def.tool}
      brushSize={size}
      sizeOpen={open}
      onSelect={(t) => { setTool(t); onSelect(t); }}
      onSizeOpenChange={setOpen}
      onBrushSizeChange={setSize}
    />
  );
}

const sizeDialog = () => screen.queryByRole('dialog', { name: /Pinceau · Crayon/ });

describe('ToolButton', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('ouvre le popover de taille après un appui long et sélectionne l’outil', () => {
    const onSelect = vi.fn();
    render(<Harness def={pencil} onSelect={onSelect} />);
    const button = screen.getByRole('button', { name: 'Crayon' });

    fireEvent.pointerDown(button, { button: 0, clientX: 10, clientY: 10 });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS - 1); });
    expect(sizeDialog()).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });

    expect(onSelect).toHaveBeenCalledWith('pencil');
    expect(sizeDialog()).not.toBeNull();

    // Le clic qui suit le relâchement ne referme pas le popover.
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    expect(sizeDialog()).not.toBeNull();
  });

  it('un appui court sélectionne sans ouvrir', () => {
    const onSelect = vi.fn();
    render(<Harness def={pencil} onSelect={onSelect} />);
    const button = screen.getByRole('button', { name: 'Crayon' });

    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS / 2); });
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });

    expect(onSelect).toHaveBeenCalledWith('pencil');
    expect(sizeDialog()).toBeNull();
  });

  it('clic droit ou nouveau clic sur l’outil actif ouvrent le popover (voie clavier)', () => {
    render(<Harness def={pencil} initialTool="pencil" onSelect={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Crayon' });

    fireEvent.click(button);
    expect(sizeDialog()).not.toBeNull();
    fireEvent.click(button);
    expect(sizeDialog()).toBeNull();

    fireEvent.contextMenu(button);
    expect(sizeDialog()).not.toBeNull();
  });

  it('le popover règle la taille', () => {
    render(<Harness def={pencil} initialTool="pencil" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crayon' }));
    fireEvent.click(screen.getByRole('button', { name: '8 px' }));
    expect((screen.getByRole('slider', { name: 'Taille du pinceau' }) as HTMLInputElement).value).toBe('8');
    expect(screen.getByRole('button', { name: '8 px' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('un outil sans taille ignore l’appui long', () => {
    const onSelect = vi.fn();
    render(<Harness def={fill} initialTool="pencil" onSelect={onSelect} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Pot de peinture' }), { button: 0 });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS * 2); });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

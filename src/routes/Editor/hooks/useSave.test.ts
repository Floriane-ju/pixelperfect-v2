import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useSave } from './useSave';
import { updateDrawingData } from '@/lib/drawings';
import type { DrawingData, DrawingRow } from '@/types';

vi.mock('@/lib/drawings', () => ({
  updateDrawingData: vi.fn(),
}));

const updateMock = vi.mocked(updateDrawingData);

const data: DrawingData = {
  width: 4,
  height: 4,
  layers: [{ id: 'l1', name: 'L', pixels: { '0,0': '#ff0000' }, opacity: 1, visible: true }],
};

const row = (d: DrawingData): DrawingRow => ({
  id: 'd1',
  title: 't',
  data: d,
  created_at: '',
  updated_at: '',
  group: null,
  collaborator_count: 1,
});

const QUEUE_KEY = 'pp_offline_d1';

function setup(initial: DrawingRow | null = row(data)) {
  const setStatus = vi.fn();
  const hook = renderHook(() => {
    const [drawing, setDrawing] = useState<DrawingRow | null>(initial);
    const save = useSave({ id: drawing?.id, drawing, setStatus });
    return { save, setDrawing };
  });
  return { hook, setStatus };
}

beforeEach(() => {
  vi.useFakeTimers();
  updateMock.mockReset();
  updateMock.mockResolvedValue(undefined);
  localStorage.clear();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSave', () => {
  it('debounces save and sets status saving → ready', async () => {
    const { hook, setStatus } = setup();
    act(() => { hook.result.current.save.scheduleSave(); });
    expect(setStatus).toHaveBeenCalledWith('saving');
    expect(updateMock).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith('d1', data);
    expect(setStatus).toHaveBeenLastCalledWith('ready');
  });

  it('coalesces rapid scheduleSave calls into one update', async () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.save.scheduleSave();
      hook.result.current.save.scheduleSave();
      hook.result.current.save.scheduleSave();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('enqueues to localStorage and sets error on failure', async () => {
    updateMock.mockRejectedValueOnce(new Error('network'));
    const { hook, setStatus } = setup();
    act(() => { hook.result.current.save.scheduleSave(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

    const queued = localStorage.getItem(QUEUE_KEY);
    expect(queued).not.toBeNull();
    expect(JSON.parse(queued!)).toEqual(data);
    expect(setStatus).toHaveBeenLastCalledWith('error');
  });

  it('clears localStorage queue on successful save', async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify({ stale: true }));
    const { hook } = setup();
    act(() => { hook.result.current.save.scheduleSave(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
  });

  it('flushes pending queue on mount when online', async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(data));
    const { setStatus } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(updateMock).toHaveBeenCalledWith('d1', data);
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
    expect(setStatus).toHaveBeenCalledWith('ready');
  });

  it('does not flush on mount when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(data));
    setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(updateMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(QUEUE_KEY)).not.toBeNull();
  });

  it('retries on online event', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(data));
    setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(updateMock).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(updateMock).toHaveBeenCalledWith('d1', data);
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
  });

  it('keeps queue when retry still fails', async () => {
    updateMock.mockRejectedValueOnce(new Error('still down'));
    localStorage.setItem(QUEUE_KEY, JSON.stringify(data));
    setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(localStorage.getItem(QUEUE_KEY)).not.toBeNull();
  });

  it('does nothing when id is undefined', () => {
    const { hook, setStatus } = setup(null);
    act(() => { hook.result.current.save.scheduleSave(); });
    expect(setStatus).not.toHaveBeenCalled();
  });
});

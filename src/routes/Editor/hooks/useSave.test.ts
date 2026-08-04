import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useSave } from './useSave';
import { updateDrawingData } from '@/lib/drawings';
import { updateDrawingData as localUpdateDrawingData } from '@/lib/localLibrary';
import * as offlineQueue from '@/lib/offlineQueue';
import type { DrawingData, DrawingRow } from '@/types';

vi.mock('@/lib/drawings', () => ({
  updateDrawingData: vi.fn(),
}));

vi.mock('@/lib/localLibrary', () => ({
  updateDrawingData: vi.fn(),
}));

vi.mock('@/lib/offlineQueue', () => {
  const store = new Map<string, DrawingData>();
  return {
    enqueue: vi.fn(async (id: string, data: DrawingData) => { store.set(id, data); }),
    dequeue: vi.fn(async (id: string) => { store.delete(id); }),
    getPending: vi.fn(async (id: string) => store.get(id) ?? null),
    __store: store,
  };
});

const updateMock = vi.mocked(updateDrawingData);
const localUpdateMock = vi.mocked(localUpdateDrawingData);
const enqueueMock = vi.mocked(offlineQueue.enqueue);
const dequeueMock = vi.mocked(offlineQueue.dequeue);
const getPendingMock = vi.mocked(offlineQueue.getPending);
const queueStore = offlineQueue as unknown as { __store: Map<string, DrawingData> };

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
  owner_id: 'u1',
  collaborator_count: 1,
});

function setup(initial: DrawingRow | null = row(data), authed = true) {
  const setStatus = vi.fn();
  const hook = renderHook(() => {
    const [drawing, setDrawing] = useState<DrawingRow | null>(initial);
    const save = useSave({ id: drawing?.id, drawing, authed, setStatus });
    return { save, setDrawing };
  });
  return { hook, setStatus };
}

beforeEach(() => {
  vi.useFakeTimers();
  updateMock.mockReset();
  updateMock.mockResolvedValue(undefined);
  localUpdateMock.mockReset();
  localUpdateMock.mockResolvedValue(undefined);
  enqueueMock.mockClear();
  dequeueMock.mockClear();
  getPendingMock.mockClear();
  queueStore.__store.clear();
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

  it('enqueues to offline queue and sets error on failure', async () => {
    updateMock.mockRejectedValueOnce(new Error('network'));
    const { hook, setStatus } = setup();
    act(() => { hook.result.current.save.scheduleSave(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

    expect(enqueueMock).toHaveBeenCalledWith('d1', data);
    expect(queueStore.__store.get('d1')).toEqual(data);
    expect(setStatus).toHaveBeenLastCalledWith('error');
  });

  it('clears offline queue on successful save', async () => {
    queueStore.__store.set('d1', data);
    const { hook } = setup();
    act(() => { hook.result.current.save.scheduleSave(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(dequeueMock).toHaveBeenCalledWith('d1');
    expect(queueStore.__store.has('d1')).toBe(false);
  });

  it('flushes pending queue on mount when online', async () => {
    queueStore.__store.set('d1', data);
    const { setStatus } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(updateMock).toHaveBeenCalledWith('d1', data);
    expect(queueStore.__store.has('d1')).toBe(false);
    expect(setStatus).toHaveBeenCalledWith('ready');
  });

  it('does not flush on mount when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    queueStore.__store.set('d1', data);
    setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(updateMock).not.toHaveBeenCalled();
    expect(queueStore.__store.has('d1')).toBe(true);
  });

  it('retries on online event', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    queueStore.__store.set('d1', data);
    setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(updateMock).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(updateMock).toHaveBeenCalledWith('d1', data);
    expect(queueStore.__store.has('d1')).toBe(false);
  });

  it('keeps queue when retry still fails', async () => {
    updateMock.mockRejectedValueOnce(new Error('still down'));
    queueStore.__store.set('d1', data);
    setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(queueStore.__store.has('d1')).toBe(true);
  });

  it('does nothing when id is undefined', () => {
    const { hook, setStatus } = setup(null);
    act(() => { hook.result.current.save.scheduleSave(); });
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('saves to the local library (no offline queue) when not authenticated', async () => {
    const { hook, setStatus } = setup(row(data), false);
    act(() => { hook.result.current.save.scheduleSave(); });
    expect(setStatus).toHaveBeenCalledWith('saving');

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(localUpdateMock).toHaveBeenCalledWith('d1', data);
    expect(updateMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith('ready');
  });

  it('does not flush the offline queue when not authenticated', async () => {
    queueStore.__store.set('d1', data);
    setup(row(data), false);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(updateMock).not.toHaveBeenCalled();
    expect(queueStore.__store.has('d1')).toBe(true);
  });

  it('flushes a pending edit to the local library on unmount when anonymous', async () => {
    const { hook } = setup(row(data), false);
    act(() => { hook.result.current.save.scheduleSave(); });
    act(() => { hook.unmount(); });
    expect(localUpdateMock).toHaveBeenCalledWith('d1', data);
    expect(updateMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('flushes a pending edit to the remote backend on unmount when authenticated', async () => {
    const { hook } = setup(row(data), true);
    act(() => { hook.result.current.save.scheduleSave(); });
    act(() => { hook.unmount(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(updateMock).toHaveBeenCalledWith('d1', data);
    expect(localUpdateMock).not.toHaveBeenCalled();
  });
});

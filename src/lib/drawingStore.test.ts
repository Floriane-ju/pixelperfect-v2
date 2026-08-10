import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as remote from './drawings';
import * as local from './localLibrary';
import { supabase } from './supabase';
import * as drawingStore from './drawingStore';
import type { DrawingRow } from '@/types';

// Mock Supabase auth
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

// Mock remote drawings
vi.mock('./drawings', () => ({
  fetchDrawings: vi.fn(),
  fetchDrawing: vi.fn(),
  createDrawing: vi.fn(),
  updateDrawingData: vi.fn(),
  renameDrawing: vi.fn(),
  deleteDrawing: vi.fn(),
  removeFromGroup: vi.fn(),
  moveToGroup: vi.fn(),
  renameGroup: vi.fn(),
  dissolveGroup: vi.fn(),
}));

// Mock local library
vi.mock('./localLibrary', () => ({
  fetchDrawings: vi.fn(),
  fetchDrawing: vi.fn(),
  createDrawing: vi.fn(),
  updateDrawingData: vi.fn(),
  renameDrawing: vi.fn(),
  deleteDrawing: vi.fn(),
  removeFromGroup: vi.fn(),
  moveToGroup: vi.fn(),
  renameGroup: vi.fn(),
  dissolveGroup: vi.fn(),
}));

const mockGetSession = vi.mocked(supabase.auth.getSession);
const remoteDrawings = vi.mocked(remote);
const localDrawings = vi.mocked(local);

const sampleRow: DrawingRow = {
  id: 'd1',
  title: 'Test Drawing',
  data: {
    width: 8,
    height: 8,
    layers: [{ id: 'l1', name: 'L1', pixels: { '0,0': '#FF0000' }, opacity: 1, visible: true }],
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  group: null,
  owner_id: 'u1',
  collaborator_count: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  remoteDrawings.fetchDrawings.mockResolvedValue([sampleRow]);
  remoteDrawings.fetchDrawing.mockResolvedValue(sampleRow);
  remoteDrawings.createDrawing.mockResolvedValue(sampleRow);
  remoteDrawings.updateDrawingData.mockResolvedValue(undefined);
  remoteDrawings.renameDrawing.mockResolvedValue(undefined);
  remoteDrawings.deleteDrawing.mockResolvedValue(undefined);
  remoteDrawings.removeFromGroup.mockResolvedValue(undefined);
  remoteDrawings.moveToGroup.mockResolvedValue(undefined);
  remoteDrawings.renameGroup.mockResolvedValue(undefined);
  remoteDrawings.dissolveGroup.mockResolvedValue(undefined);

  localDrawings.fetchDrawings.mockResolvedValue([sampleRow]);
  localDrawings.fetchDrawing.mockResolvedValue(sampleRow);
  localDrawings.createDrawing.mockResolvedValue(sampleRow);
  localDrawings.updateDrawingData.mockResolvedValue(undefined);
  localDrawings.renameDrawing.mockResolvedValue(undefined);
  localDrawings.deleteDrawing.mockResolvedValue(undefined);
  localDrawings.removeFromGroup.mockResolvedValue(undefined);
  localDrawings.moveToGroup.mockResolvedValue(undefined);
  localDrawings.renameGroup.mockResolvedValue(undefined);
  localDrawings.dissolveGroup.mockResolvedValue(undefined);
});

describe('drawingStore', () => {
  describe('when authenticated', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'u1',
              app_metadata: {},
              user_metadata: {},
              aud: 'authenticated',
              created_at: '2024-01-01',
            },
          },
        },
        error: null,
      } as Parameters<typeof mockGetSession.mockResolvedValue>[0]);
    });

    it('routes fetchDrawings to remote', async () => {
      const result = await drawingStore.fetchDrawings();
      expect(remoteDrawings.fetchDrawings).toHaveBeenCalled();
      expect(localDrawings.fetchDrawings).not.toHaveBeenCalled();
      expect(result).toEqual([sampleRow]);
    });

    it('routes fetchDrawing to remote', async () => {
      const result = await drawingStore.fetchDrawing('d1');
      expect(remoteDrawings.fetchDrawing).toHaveBeenCalledWith('d1');
      expect(localDrawings.fetchDrawing).not.toHaveBeenCalled();
      expect(result).toEqual(sampleRow);
    });

    it('routes createDrawing to remote', async () => {
      const result = await drawingStore.createDrawing('New', 16, 16);
      expect(remoteDrawings.createDrawing).toHaveBeenCalledWith('New', 16, 16);
      expect(localDrawings.createDrawing).not.toHaveBeenCalled();
      expect(result).toEqual(sampleRow);
    });

    it('routes updateDrawingData to remote', async () => {
      const data = sampleRow.data;
      await drawingStore.updateDrawingData('d1', data);
      expect(remoteDrawings.updateDrawingData).toHaveBeenCalledWith('d1', data);
      expect(localDrawings.updateDrawingData).not.toHaveBeenCalled();
    });

    it('routes renameDrawing to remote', async () => {
      await drawingStore.renameDrawing('d1', 'Renamed');
      expect(remoteDrawings.renameDrawing).toHaveBeenCalledWith('d1', 'Renamed');
      expect(localDrawings.renameDrawing).not.toHaveBeenCalled();
    });

    it('routes deleteDrawing to remote', async () => {
      await drawingStore.deleteDrawing('d1');
      expect(remoteDrawings.deleteDrawing).toHaveBeenCalledWith('d1');
      expect(localDrawings.deleteDrawing).not.toHaveBeenCalled();
    });

    it('routes removeFromGroup to remote', async () => {
      await drawingStore.removeFromGroup('d1');
      expect(remoteDrawings.removeFromGroup).toHaveBeenCalledWith('d1');
      expect(localDrawings.removeFromGroup).not.toHaveBeenCalled();
    });

    it('routes moveToGroup to remote', async () => {
      await drawingStore.moveToGroup('d1', 'MyGroup');
      expect(remoteDrawings.moveToGroup).toHaveBeenCalledWith('d1', 'MyGroup');
      expect(localDrawings.moveToGroup).not.toHaveBeenCalled();
    });

    it('routes renameGroup to remote', async () => {
      await drawingStore.renameGroup('Old', 'New');
      expect(remoteDrawings.renameGroup).toHaveBeenCalledWith('Old', 'New');
      expect(localDrawings.renameGroup).not.toHaveBeenCalled();
    });

    it('routes dissolveGroup to remote', async () => {
      await drawingStore.dissolveGroup('MyGroup');
      expect(remoteDrawings.dissolveGroup).toHaveBeenCalledWith('MyGroup');
      expect(localDrawings.dissolveGroup).not.toHaveBeenCalled();
    });
  });

  describe('when not authenticated', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });
    });

    it('routes fetchDrawings to local', async () => {
      const result = await drawingStore.fetchDrawings();
      expect(localDrawings.fetchDrawings).toHaveBeenCalled();
      expect(remoteDrawings.fetchDrawings).not.toHaveBeenCalled();
      expect(result).toEqual([sampleRow]);
    });

    it('routes fetchDrawing to local', async () => {
      const result = await drawingStore.fetchDrawing('d1');
      expect(localDrawings.fetchDrawing).toHaveBeenCalledWith('d1');
      expect(remoteDrawings.fetchDrawing).not.toHaveBeenCalled();
      expect(result).toEqual(sampleRow);
    });

    it('routes createDrawing to local', async () => {
      const result = await drawingStore.createDrawing('New', 16, 16);
      expect(localDrawings.createDrawing).toHaveBeenCalledWith('New', 16, 16);
      expect(remoteDrawings.createDrawing).not.toHaveBeenCalled();
      expect(result).toEqual(sampleRow);
    });

    it('routes updateDrawingData to local', async () => {
      const data = sampleRow.data;
      await drawingStore.updateDrawingData('d1', data);
      expect(localDrawings.updateDrawingData).toHaveBeenCalledWith('d1', data);
      expect(remoteDrawings.updateDrawingData).not.toHaveBeenCalled();
    });

    it('routes renameDrawing to local', async () => {
      await drawingStore.renameDrawing('d1', 'Renamed');
      expect(localDrawings.renameDrawing).toHaveBeenCalledWith('d1', 'Renamed');
      expect(remoteDrawings.renameDrawing).not.toHaveBeenCalled();
    });

    it('routes deleteDrawing to local', async () => {
      await drawingStore.deleteDrawing('d1');
      expect(localDrawings.deleteDrawing).toHaveBeenCalledWith('d1');
      expect(remoteDrawings.deleteDrawing).not.toHaveBeenCalled();
    });

    it('routes removeFromGroup to local', async () => {
      await drawingStore.removeFromGroup('d1');
      expect(localDrawings.removeFromGroup).toHaveBeenCalledWith('d1');
      expect(remoteDrawings.removeFromGroup).not.toHaveBeenCalled();
    });

    it('routes moveToGroup to local', async () => {
      await drawingStore.moveToGroup('d1', 'MyGroup');
      expect(localDrawings.moveToGroup).toHaveBeenCalledWith('d1', 'MyGroup');
      expect(remoteDrawings.moveToGroup).not.toHaveBeenCalled();
    });

    it('routes renameGroup to local', async () => {
      await drawingStore.renameGroup('Old', 'New');
      expect(localDrawings.renameGroup).toHaveBeenCalledWith('Old', 'New');
      expect(remoteDrawings.renameGroup).not.toHaveBeenCalled();
    });

    it('routes dissolveGroup to local', async () => {
      await drawingStore.dissolveGroup('MyGroup');
      expect(localDrawings.dissolveGroup).toHaveBeenCalledWith('MyGroup');
      expect(remoteDrawings.dissolveGroup).not.toHaveBeenCalled();
    });
  });
});

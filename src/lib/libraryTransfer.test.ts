import { describe, it, expect } from 'vitest';
import { serializeLibrary, parseLibraryFile } from './libraryTransfer';
import type { LocalDrawing } from './localLibrary';

const sample: LocalDrawing = {
  id: 'orig-1',
  title: 'Test',
  data: {
    width: 2,
    height: 2,
    layers: [{ id: 'l1', name: 'L', pixels: { '0,0': '#FF0000' }, opacity: 1, visible: true }],
  },
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-02T00:00:00.000Z',
  group: 'Groupe A',
};

describe('serializeLibrary', () => {
  it('wraps drawings in the library envelope', () => {
    const file = serializeLibrary([sample], '2026-05-30T00:00:00.000Z');
    expect(file.format).toBe('pixelperfect-library');
    expect(file.version).toBe(1);
    expect(file.exportedAt).toBe('2026-05-30T00:00:00.000Z');
    expect(file.drawings).toHaveLength(1);
  });
});

describe('parseLibraryFile', () => {
  it('round-trips a serialized library, reassigning new ids', () => {
    const file = serializeLibrary([sample], '2026-05-30T00:00:00.000Z');
    const parsed = parseLibraryFile(file);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.title).toBe('Test');
    expect(parsed[0]?.group).toBe('Groupe A');
    expect(parsed[0]?.data).toEqual(sample.data);
    expect(parsed[0]?.created_at).toBe(sample.created_at);
    expect(parsed[0]?.id).toEqual(expect.any(String));
    expect(parsed[0]?.id).not.toBe('orig-1');
  });

  it('defaults missing title/group', () => {
    const parsed = parseLibraryFile({
      format: 'pixelperfect-library',
      version: 1,
      drawings: [{ data: sample.data }],
    });
    expect(parsed[0]?.title).toBe('Sans titre');
    expect(parsed[0]?.group).toBeNull();
  });

  it('rejects a non-object payload', () => {
    expect(() => parseLibraryFile(null)).toThrow();
    expect(() => parseLibraryFile('nope')).toThrow();
  });

  it('rejects a wrong format tag', () => {
    expect(() => parseLibraryFile({ format: 'something-else', version: 1, drawings: [] })).toThrow();
  });

  it('rejects when drawings is not an array', () => {
    expect(() => parseLibraryFile({ format: 'pixelperfect-library', version: 1 })).toThrow();
  });

  it('rejects corrupted drawing data', () => {
    expect(() =>
      parseLibraryFile({
        format: 'pixelperfect-library',
        version: 1,
        drawings: [{ title: 'X', data: { width: 0, height: 2, layers: [] } }],
      }),
    ).toThrow();
  });
});

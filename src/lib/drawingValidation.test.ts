import { describe, it, expect } from 'vitest';
import { parseDrawingData, parsePixelLayer, isRecord } from './drawingValidation';
import type { DrawingData } from '@/types';

describe('isRecord', () => {
  it('returns true for plain objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ key: 'value' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isRecord(null)).toBe(false);
  });

  it('returns false for arrays', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isRecord('string')).toBe(false);
    expect(isRecord(123)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe('parsePixelLayer', () => {
  const validPixels = { '0,0': '#ff0000', '1,1': '#00ff00' };
  const maxPixels = 16;

  it('parses a valid pixel layer', () => {
    const raw = {
      id: 'layer-1',
      name: 'Background',
      pixels: validPixels,
      opacity: 0.5,
      visible: true,
    };
    const result = parsePixelLayer(raw, maxPixels);
    expect(result).toEqual({
      id: 'layer-1',
      name: 'Background',
      pixels: validPixels,
      opacity: 0.5,
      visible: true,
    });
  });

  it('throws if layer is not an object', () => {
    expect(() => parsePixelLayer(null, maxPixels)).toThrow('layer must be object');
    expect(() => parsePixelLayer('string', maxPixels)).toThrow('layer must be object');
    expect(() => parsePixelLayer([1, 2], maxPixels)).toThrow('layer must be object');
  });

  it('throws if id is not a string', () => {
    expect(() =>
      parsePixelLayer({ id: 123, name: 'Test', pixels: {}, opacity: 1, visible: true }, maxPixels)
    ).toThrow('layer.id');
  });

  it('throws if name is not a string', () => {
    expect(() =>
      parsePixelLayer({ id: 'l1', name: null, pixels: {}, opacity: 1, visible: true }, maxPixels)
    ).toThrow('layer.name');
  });

  it('throws if opacity is not a number', () => {
    expect(() =>
      parsePixelLayer(
        { id: 'l1', name: 'Test', pixels: {}, opacity: 'high', visible: true },
        maxPixels
      )
    ).toThrow('layer.opacity');
  });

  it('throws if opacity is below 0', () => {
    expect(() =>
      parsePixelLayer(
        { id: 'l1', name: 'Test', pixels: {}, opacity: -0.1, visible: true },
        maxPixels
      )
    ).toThrow('layer.opacity');
  });

  it('throws if opacity is above 1', () => {
    expect(() =>
      parsePixelLayer(
        { id: 'l1', name: 'Test', pixels: {}, opacity: 1.1, visible: true },
        maxPixels
      )
    ).toThrow('layer.opacity');
  });

  it('accepts opacity at boundary 0', () => {
    const result = parsePixelLayer(
      { id: 'l1', name: 'Test', pixels: {}, opacity: 0, visible: true },
      maxPixels
    );
    expect(result.opacity).toBe(0);
  });

  it('accepts opacity at boundary 1', () => {
    const result = parsePixelLayer(
      { id: 'l1', name: 'Test', pixels: {}, opacity: 1, visible: true },
      maxPixels
    );
    expect(result.opacity).toBe(1);
  });

  it('throws if visible is not a boolean', () => {
    expect(() =>
      parsePixelLayer({ id: 'l1', name: 'Test', pixels: {}, opacity: 1, visible: 'yes' }, maxPixels)
    ).toThrow('layer.visible');
  });

  it('throws if pixels is not a record', () => {
    expect(() =>
      parsePixelLayer(
        { id: 'l1', name: 'Test', pixels: null, opacity: 1, visible: true },
        maxPixels
      )
    ).toThrow('layer.pixels');
    expect(() =>
      parsePixelLayer(
        { id: 'l1', name: 'Test', pixels: [1, 2], opacity: 1, visible: true },
        maxPixels
      )
    ).toThrow('layer.pixels');
  });

  it('throws if pixels exceeds maxPixels', () => {
    const tooManyPixels = Object.fromEntries(
      Array.from({ length: 17 }, (_, i) => [`${i},0`, '#ff0000'])
    );
    expect(() =>
      parsePixelLayer(
        { id: 'l1', name: 'Test', pixels: tooManyPixels, opacity: 1, visible: true },
        16
      )
    ).toThrow('layer.pixels exceeds cap 16');
  });

  it('accepts pixels at max capacity', () => {
    const maxPixels = 16;
    const atMaxPixels = Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [`${i},0`, '#ff0000'])
    );
    const result = parsePixelLayer(
      { id: 'l1', name: 'Test', pixels: atMaxPixels, opacity: 1, visible: true },
      maxPixels
    );
    expect(Object.keys(result.pixels).length).toBe(16);
  });

  it('throws if pixel color is invalid', () => {
    const invalidPixels = { '0,0': 'red' };
    expect(() =>
      parsePixelLayer(
        { id: 'l1', name: 'Test', pixels: invalidPixels, opacity: 1, visible: true },
        maxPixels
      )
    ).toThrow('pixel color must be hex string');
  });

  it('accepts valid hex colors in different formats', () => {
    const pixels = {
      '0,0': '#fff', // 3-char
      '0,1': '#1234', // 4-char
      '1,0': '#ff00ff', // 6-char
      '1,1': '#ff00ffaa', // 8-char
    };
    const result = parsePixelLayer(
      { id: 'l1', name: 'Test', pixels, opacity: 1, visible: true },
      maxPixels
    );
    expect(result.pixels).toEqual(pixels);
  });
});

describe('parseDrawingData', () => {
  const validData: DrawingData = {
    width: 10,
    height: 10,
    layers: [
      {
        id: 'l1',
        name: 'Layer 1',
        pixels: { '0,0': '#ff0000' },
        opacity: 1,
        visible: true,
      },
    ],
  };

  it('parses valid drawing data', () => {
    const result = parseDrawingData(validData);
    expect(result).toEqual(validData);
  });

  it('throws if data is not an object', () => {
    expect(() => parseDrawingData(null)).toThrow('data must be object');
    expect(() => parseDrawingData('string')).toThrow('data must be object');
    expect(() => parseDrawingData([1, 2])).toThrow('data must be object');
  });

  it('throws if width is not an integer', () => {
    expect(() => parseDrawingData({ ...validData, width: 10.5 })).toThrow('width must be integer');
  });

  it('throws if width is 0', () => {
    expect(() => parseDrawingData({ ...validData, width: 0 })).toThrow('width must be integer');
  });

  it('throws if width is negative', () => {
    expect(() => parseDrawingData({ ...validData, width: -5 })).toThrow('width must be integer');
  });

  it('accepts width at lower boundary (1)', () => {
    const result = parseDrawingData({ ...validData, width: 1 });
    expect(result.width).toBe(1);
  });

  it('accepts width at upper boundary (512)', () => {
    const result = parseDrawingData({ ...validData, width: 512 });
    expect(result.width).toBe(512);
  });

  it('throws if width exceeds maximum (512)', () => {
    expect(() => parseDrawingData({ ...validData, width: 513 })).toThrow(
      'width must be integer in [1, 512]'
    );
  });

  it('throws if width is not a number', () => {
    expect(() => parseDrawingData({ ...validData, width: 'ten' })).toThrow('width must be integer');
  });

  it('throws if height is not an integer', () => {
    expect(() => parseDrawingData({ ...validData, height: 10.5 })).toThrow(
      'height must be integer'
    );
  });

  it('throws if height is 0', () => {
    expect(() => parseDrawingData({ ...validData, height: 0 })).toThrow('height must be integer');
  });

  it('throws if height is negative', () => {
    expect(() => parseDrawingData({ ...validData, height: -5 })).toThrow('height must be integer');
  });

  it('accepts height at lower boundary (1)', () => {
    const result = parseDrawingData({ ...validData, height: 1 });
    expect(result.height).toBe(1);
  });

  it('accepts height at upper boundary (512)', () => {
    const result = parseDrawingData({ ...validData, height: 512 });
    expect(result.height).toBe(512);
  });

  it('throws if height exceeds maximum (512)', () => {
    expect(() => parseDrawingData({ ...validData, height: 513 })).toThrow(
      'height must be integer in [1, 512]'
    );
  });

  it('throws if height is not a number', () => {
    expect(() => parseDrawingData({ ...validData, height: 'ten' })).toThrow(
      'height must be integer'
    );
  });

  it('throws if layers is not an array', () => {
    expect(() => parseDrawingData({ ...validData, layers: null })).toThrow('layers must be array');
    expect(() => parseDrawingData({ ...validData, layers: 'not an array' })).toThrow(
      'layers must be array'
    );
  });

  it('throws if layers exceeds maximum (64)', () => {
    const tooManyLayers = Array.from({ length: 65 }, (_, i) => ({
      id: `l${i}`,
      name: `Layer ${i}`,
      pixels: {},
      opacity: 1,
      visible: true,
    }));
    expect(() => parseDrawingData({ ...validData, layers: tooManyLayers })).toThrow(
      'layers exceeds cap 64'
    );
  });

  it('accepts layers at maximum (64)', () => {
    const maxLayers = Array.from({ length: 64 }, (_, i) => ({
      id: `l${i}`,
      name: `Layer ${i}`,
      pixels: {},
      opacity: 1,
      visible: true,
    }));
    const result = parseDrawingData({ ...validData, layers: maxLayers });
    expect(result.layers.length).toBe(64);
  });

  it('accepts empty layers array', () => {
    const result = parseDrawingData({ ...validData, layers: [] });
    expect(result.layers).toEqual([]);
  });

  it('throws if any layer is invalid', () => {
    const invalidLayers = [{ id: 'l1', name: 'Layer 1', pixels: null, opacity: 1, visible: true }];
    expect(() => parseDrawingData({ ...validData, layers: invalidLayers })).toThrow('layer.pixels');
  });

  it('validates pixel count against width × height', () => {
    const tooManyPixels = Object.fromEntries(
      Array.from({ length: 101 }, (_, i) => [`${i},0`, '#ff0000'])
    );
    const data = {
      width: 10,
      height: 10, // max 100 pixels
      layers: [{ id: 'l1', name: 'Test', pixels: tooManyPixels, opacity: 1, visible: true }],
    };
    expect(() => parseDrawingData(data)).toThrow('layer.pixels exceeds cap 100');
  });

  it('parses complete valid drawing with multiple layers', () => {
    const complexData: DrawingData = {
      width: 32,
      height: 32,
      layers: [
        {
          id: 'bg',
          name: 'Background',
          pixels: { '0,0': '#ffffff', '31,31': '#000000' },
          opacity: 1,
          visible: true,
        },
        {
          id: 'fg',
          name: 'Foreground',
          pixels: { '15,15': '#ff0000' },
          opacity: 0.8,
          visible: true,
        },
        {
          id: 'empty',
          name: 'Empty Layer',
          pixels: {},
          opacity: 0.5,
          visible: false,
        },
      ],
    };
    const result = parseDrawingData(complexData);
    expect(result).toEqual(complexData);
    expect(result.layers.length).toBe(3);
  });

  it('returns a correctly typed DrawingData result', () => {
    const result = parseDrawingData(validData);
    expect(typeof result.width).toBe('number');
    expect(typeof result.height).toBe('number');
    expect(Array.isArray(result.layers)).toBe(true);
    expect(result.layers.length).toBeGreaterThan(0);
    const firstLayer = result.layers[0];
    if (firstLayer) {
      expect(firstLayer.opacity).toBeGreaterThanOrEqual(0);
      expect(firstLayer.opacity).toBeLessThanOrEqual(1);
    }
  });
});

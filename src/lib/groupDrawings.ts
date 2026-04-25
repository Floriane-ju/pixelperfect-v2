import type { DrawingRow } from '@/types';

export interface DrawingGroup {
  name: string;
  drawings: DrawingRow[];
}

export interface GroupedGallery {
  groups: DrawingGroup[];
  ungrouped: DrawingRow[];
}

export function groupDrawings(drawings: DrawingRow[]): GroupedGallery {
  const map = new Map<string, DrawingRow[]>();
  const ungrouped: DrawingRow[] = [];

  for (const d of drawings) {
    if (d.group) {
      const existing = map.get(d.group);
      if (existing) {
        existing.push(d);
      } else {
        map.set(d.group, [d]);
      }
    } else {
      ungrouped.push(d);
    }
  }

  const groups: DrawingGroup[] = Array.from(map.entries()).map(([name, ds]) => ({
    name,
    drawings: ds,
  }));

  return { groups, ungrouped };
}

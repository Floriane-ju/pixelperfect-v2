export type HexColor = `#${string}`;

export interface PixelLayer {
  id: string;
  name: string;
  pixels: Record<string, HexColor>;
  opacity: number;
  visible: boolean;
}

export interface DrawingData {
  width: number;
  height: number;
  layers: PixelLayer[];
}

export interface DrawingRow {
  id: string;
  title: string;
  data: DrawingData;
  created_at: string;
  updated_at: string;
  group: string | null;
}

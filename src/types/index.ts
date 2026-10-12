export type HexColor = `#${string}`;

export interface PixelLayer {
  id: string;
  name: string;
  pixels: Record<string, HexColor>;
  opacity: number;
  visible: boolean;
}

export type CanvasBgColor = 'white' | 'gray' | 'black';

/** Réglages d'affichage enregistrés avec le dessin ; un champ absent prend sa valeur par défaut. */
export interface DrawingSettings {
  animationMode?: boolean;
  /** Vitesse de lecture de l'animation, en images par seconde. */
  fps?: number;
  bgColor?: CanvasBgColor;
}

export interface DrawingData {
  width: number;
  height: number;
  layers: PixelLayer[];
  settings?: DrawingSettings;
}

export type CollaboratorRole = 'owner' | 'editor';

export interface Profile {
  user_id: string;
  username: string;
  email: string;
}

export interface DrawingRow {
  id: string;
  title: string;
  data: DrawingData;
  created_at: string;
  updated_at: string;
  group: string | null;
  owner_id: string;
  collaborator_count: number;
}

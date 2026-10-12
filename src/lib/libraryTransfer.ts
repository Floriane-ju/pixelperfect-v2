import { parseDrawingData, isRecord } from './drawingValidation';
import { bulkAdd, getAllDrawings } from './localLibrary';
import type { LocalDrawing } from './localLibrary';

const FORMAT = 'pixelperfect-library';
const FORMAT_VERSION = 1;
const MAX_TITLE_LENGTH = 80;
const MAX_GROUP_LENGTH = 80;
const MAX_IMPORT_ENTRIES = 1000;

export interface LibraryFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  drawings: LocalDrawing[];
}

/** Sérialise une bibliothèque en objet fichier (pur, testable sans IndexedDB). */
export function serializeLibrary(drawings: LocalDrawing[], exportedAt: string): LibraryFile {
  return { format: FORMAT, version: FORMAT_VERSION, exportedAt, drawings };
}

/**
 * Valide un fichier de bibliothèque importé et renvoie des dessins prêts à insérer.
 * Réassigne de nouveaux IDs (fusion sans écrasement) et revalide chaque `data`.
 * Pur, testable sans IndexedDB.
 */
export function parseLibraryFile(raw: unknown): LocalDrawing[] {
  if (!isRecord(raw)) throw new Error('Fichier invalide : format non reconnu.');
  if (raw.format !== FORMAT)
    throw new Error('Fichier invalide : ce n’est pas une bibliothèque PixelPerfect.');
  if (typeof raw.version !== 'number') throw new Error('Fichier invalide : version manquante.');
  if (raw.version > FORMAT_VERSION) {
    throw new Error('Fichier créé par une version plus récente de PixelPerfect.');
  }
  if (!Array.isArray(raw.drawings)) throw new Error('Fichier invalide : aucun dessin.');

  const list = raw.drawings as unknown[];
  if (list.length > MAX_IMPORT_ENTRIES) {
    throw new Error(`Fichier invalide : trop de dessins (maximum ${MAX_IMPORT_ENTRIES}).`);
  }

  const ts = new Date().toISOString();
  return list.map((entry, i) => {
    if (!isRecord(entry)) throw new Error(`Dessin ${i + 1} invalide.`);
    const title = typeof entry.title === 'string' ? entry.title : 'Sans titre';
    const group = typeof entry.group === 'string' ? entry.group : null;

    if (title.length > MAX_TITLE_LENGTH) {
      throw new Error(
        `Fichier invalide : le titre du dessin ${i + 1} dépasse ${MAX_TITLE_LENGTH} caractères.`
      );
    }

    if (group !== null && group.length > MAX_GROUP_LENGTH) {
      throw new Error(
        `Fichier invalide : le groupe du dessin ${i + 1} dépasse ${MAX_GROUP_LENGTH} caractères.`
      );
    }

    const created_at = typeof entry.created_at === 'string' ? entry.created_at : ts;
    const updated_at = typeof entry.updated_at === 'string' ? entry.updated_at : ts;
    return {
      id: crypto.randomUUID(),
      title,
      data: parseDrawingData(entry.data),
      created_at,
      updated_at,
      group,
    };
  });
}

/** Déclenche le téléchargement d'un texte sous forme de fichier. */
function triggerDownload(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Révoquer hors du tick courant : a.click() ne fait que planifier le téléchargement ;
  // révoquer immédiatement peut produire un fichier vide (notamment iOS Safari).
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

/** Exporte la bibliothèque locale vers un fichier JSON téléchargé. */
export async function exportLibrary(): Promise<void> {
  const drawings = await getAllDrawings();
  const exportedAt = new Date().toISOString();
  const file = serializeLibrary(drawings, exportedAt);
  const filename = `pixelperfect-library-${exportedAt.slice(0, 10)}.json`;
  triggerDownload(filename, JSON.stringify(file));
}

/** Importe (fusionne) une bibliothèque depuis un texte JSON. Renvoie le nombre ajouté. */
export async function importLibrary(jsonText: string): Promise<number> {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error('Fichier invalide : JSON illisible.');
  }
  const drawings = parseLibraryFile(raw);
  await bulkAdd(drawings);
  return drawings.length;
}

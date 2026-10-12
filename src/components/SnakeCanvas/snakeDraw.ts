const CELL = 24;
const GAP = 3;
const MINI_CELL = (CELL - 2 * GAP) / 3;
/** Pas de la grille (case + gouttière), en px. */
export const STEP = CELL + GAP;
const FOOD_SIZE = 24;
const FOOD_OFFSET = (CELL - FOOD_SIZE) / 2;

export interface Cell {
  x: number;
  y: number;
}

/** Une case = grille 3×3 de mini-carrés (segment du serpent ou bordure). */
export function drawCell(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const px = cx * STEP;
  const py = cy * STEP;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      ctx.fillRect(px + col * (MINI_CELL + GAP), py + row * (MINI_CELL + GAP), MINI_CELL, MINI_CELL);
    }
  }
}

export function drawBorder(ctx: CanvasRenderingContext2D, cols: number, rows: number): void {
  for (let x = 0; x < cols; x++) {
    drawCell(ctx, x, 0);
    drawCell(ctx, x, rows - 1);
  }
  for (let y = 1; y < rows - 1; y++) {
    drawCell(ctx, 0, y);
    drawCell(ctx, cols - 1, y);
  }
}

/** Nourriture : losange pixelisé (centre + quatre côtés). */
export function drawFood(ctx: CanvasRenderingContext2D, food: Cell): void {
  const x = food.x * STEP + FOOD_OFFSET;
  const y = food.y * STEP + FOOD_OFFSET;
  const s = FOOD_SIZE;
  ctx.fillRect(x + s / 2 - s / 8, y + s / 2 - s / 8, s / 4, s / 4);
  ctx.fillRect(x + s / 4, y, s / 2, s / 6);
  ctx.fillRect(x + s / 4, y + s - s / 6, s / 2, s / 6);
  ctx.fillRect(x + s - s / 6, y + s / 4, s / 6, s / 2);
  ctx.fillRect(x, y + s / 4, s / 6, s / 2);
}

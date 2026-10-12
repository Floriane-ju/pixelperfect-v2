import { useEffect, useRef, useCallback, useState } from 'react';
import styles from './SnakeCanvas.module.scss';
import { Button } from '@/components/Button';
import { cx } from '@/lib/cx';
import { STEP, drawBorder, drawCell, drawFood } from './snakeDraw';

const TICK_MS = 150;
const INITIAL_LENGTH = 5;
// Palette D07 (cf. _variables.scss) : en veille, le serpent se fond dans la trame du papier ;
// en jeu, il prend le rouge d'action et la nourriture l'encre.
const COLOR_AUTO = '#D9CFBC';
const COLOR_USER = '#D12E15';
const COLOR_FOOD_AUTO = '#D9CFBC';
const COLOR_FOOD_USER = '#111111';
const BORDER_INSET = 1;

type Dir = 'up' | 'down' | 'left' | 'right';

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const TURN_LEFT: Record<Dir, Dir> = { up: 'left', left: 'down', down: 'right', right: 'up' };
const TURN_RIGHT: Record<Dir, Dir> = { up: 'right', right: 'down', down: 'left', left: 'up' };

function gridCols() { return Math.max(1, Math.floor(window.innerWidth / STEP)); }
function gridRows() { return Math.max(1, Math.floor(window.innerHeight / STEP)); }

interface SnakeCanvasProps {
  onModeChange?: (active: boolean) => void;
}

export function SnakeCanvas({ onModeChange }: SnakeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakeRef = useRef<{ x: number; y: number }[]>([]);
  const dirRef = useRef<Dir>('right');
  const nextDirRef = useRef<Dir>('right');
  const modeRef = useRef<'auto' | 'user'>('auto');
  const colsRef = useRef(0);
  const rowsRef = useRef(0);
  const movesUntilTurnRef = useRef(5);
  const foodRef = useRef<{ x: number; y: number } | null>(null);
  const pendingGrowRef = useRef(0);
  const gameOverRef = useRef(false);
  const [gameOver, setGameOver] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const borderActiveRef = useRef(false);

  const isBorderCell = useCallback((x: number, y: number): boolean => {
    return (
      x < BORDER_INSET ||
      y < BORDER_INSET ||
      x >= colsRef.current - BORDER_INSET ||
      y >= rowsRef.current - BORDER_INSET
    );
  }, []);

  const placeFood = useCallback(() => {
    const occupied = new Set(snakeRef.current.map((s) => `${s.x},${s.y}`));
    const minX = BORDER_INSET;
    const minY = BORDER_INSET;
    const maxX = Math.max(minX, colsRef.current - BORDER_INSET - 1);
    const maxY = Math.max(minY, rowsRef.current - BORDER_INSET - 1);
    let x: number;
    let y: number;
    let attempts = 0;
    do {
      x = minX + Math.floor(Math.random() * (maxX - minX + 1));
      y = minY + Math.floor(Math.random() * (maxY - minY + 1));
      attempts++;
    } while (occupied.has(`${x},${y}`) && attempts < 200);
    foodRef.current = { x, y };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const isUser = modeRef.current === 'user';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (borderActiveRef.current) {
      ctx.fillStyle = COLOR_USER;
      drawBorder(ctx, colsRef.current, rowsRef.current);
    }

    ctx.fillStyle = isUser ? COLOR_USER : COLOR_AUTO;
    for (const seg of snakeRef.current) drawCell(ctx, seg.x, seg.y);

    const food = foodRef.current;
    if (food) {
      ctx.fillStyle = isUser ? COLOR_FOOD_USER : COLOR_FOOD_AUTO;
      drawFood(ctx, food);
    }
  }, []);

  const tick = useCallback(() => {
    if (gameOverRef.current) return;
    const head = snakeRef.current[0];
    if (!head) return;

    const step = (d: Dir): { x: number; y: number } => {
      let x = head.x;
      let y = head.y;
      if (d === 'right') x++;
      else if (d === 'left') x--;
      else if (d === 'up') y--;
      else y++;
      x = ((x % colsRef.current) + colsRef.current) % colsRef.current;
      y = ((y % rowsRef.current) + rowsRef.current) % rowsRef.current;
      return { x, y };
    };

    const food = foodRef.current;
    const wouldCollide = (x: number, y: number): boolean => {
      if (isBorderCell(x, y)) return true;
      const willEat = food !== null && x === food.x && y === food.y;
      const growing = pendingGrowRef.current > 0 || willEat;
      const body = growing ? snakeRef.current : snakeRef.current.slice(0, -1);
      for (const seg of body) {
        if (seg.x === x && seg.y === y) return true;
      }
      return false;
    };

    if (modeRef.current === 'auto') {
      const curDir = nextDirRef.current;
      const planned = step(curDir);
      if (wouldCollide(planned.x, planned.y)) {
        const left = TURN_LEFT[curDir];
        const right = TURN_RIGHT[curDir];
        const leftPos = step(left);
        const rightPos = step(right);
        const leftSafe = !wouldCollide(leftPos.x, leftPos.y);
        const rightSafe = !wouldCollide(rightPos.x, rightPos.y);
        if (leftSafe && rightSafe) {
          nextDirRef.current = Math.random() < 0.5 ? left : right;
        } else if (leftSafe) {
          nextDirRef.current = left;
        } else if (rightSafe) {
          nextDirRef.current = right;
        }
        movesUntilTurnRef.current = 4 + Math.floor(Math.random() * 8);
      }
    }

    dirRef.current = nextDirRef.current;
    const dir = dirRef.current;
    const next = step(dir);
    const nx = next.x;
    const ny = next.y;

    const ate = food !== null && nx === food.x && ny === food.y;
    if (ate) {
      pendingGrowRef.current++;
      foodRef.current = null;
    }

    if (modeRef.current === 'user') {
      if (isBorderCell(nx, ny)) {
        gameOverRef.current = true;
        setGameOver(true);
        return;
      }
      const growing = pendingGrowRef.current > 0;
      const body = growing ? snakeRef.current : snakeRef.current.slice(0, -1);
      for (const seg of body) {
        if (seg.x === nx && seg.y === ny) {
          gameOverRef.current = true;
          setGameOver(true);
          return;
        }
      }
    }

    if (pendingGrowRef.current > 0) {
      snakeRef.current = [{ x: nx, y: ny }, ...snakeRef.current];
      pendingGrowRef.current--;
    } else {
      snakeRef.current = [{ x: nx, y: ny }, ...snakeRef.current.slice(0, -1)];
    }

    if (ate) placeFood();

    if (modeRef.current === 'auto') {
      movesUntilTurnRef.current--;
      if (movesUntilTurnRef.current <= 0) {
        nextDirRef.current = Math.random() < 0.5 ? TURN_LEFT[dir] : TURN_RIGHT[dir];
        movesUntilTurnRef.current = 4 + Math.floor(Math.random() * 8);
      }
    }

    draw();
  }, [draw, placeFood, isBorderCell]);

  const resetSnake = useCallback(() => {
    const c = colsRef.current;
    const r = rowsRef.current;
    const midX = Math.floor(c / 2);
    const midY = Math.floor(r / 2);
    snakeRef.current = Array.from({ length: INITIAL_LENGTH }, (_, i) => ({ x: midX - i, y: midY }));
    dirRef.current = 'right';
    nextDirRef.current = 'right';
    pendingGrowRef.current = 0;
    movesUntilTurnRef.current = 4 + Math.floor(Math.random() * 8);
    placeFood();
    draw();
  }, [draw, placeFood]);

  const handleReplay = useCallback(() => {
    const canvas = canvasRef.current;
    modeRef.current = 'user';
    borderActiveRef.current = true;
    resetSnake();
    gameOverRef.current = false;
    setGameOver(false);
    setShowHint(false);
    if (canvas) {
      if (styles.dormant) canvas.classList.remove(styles.dormant);
      if (styles.active) canvas.classList.add(styles.active);
    }
    onModeChange?.(true);
  }, [resetSnake, onModeChange]);

  const handleBackToGallery = useCallback(() => {
    const canvas = canvasRef.current;
    modeRef.current = 'auto';
    borderActiveRef.current = false;
    resetSnake();
    gameOverRef.current = false;
    setGameOver(false);
    setShowHint(true);
    if (canvas) {
      if (styles.active) canvas.classList.remove(styles.active);
      if (styles.dormant) canvas.classList.add(styles.dormant);
    }
    onModeChange?.(false);
  }, [resetSnake, onModeChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      colsRef.current = gridCols();
      rowsRef.current = gridRows();
    };

    resize();
    // Préférence d'accessibilité lue au montage : le serpent auto reste figé, le jeu reste jouable.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const c = colsRef.current;
    const r = rowsRef.current;
    const midX = Math.floor(c / 2);
    const midY = Math.floor(r / 2);
    snakeRef.current = Array.from({ length: INITIAL_LENGTH }, (_, i) => ({ x: midX - i, y: midY }));
    movesUntilTurnRef.current = 4 + Math.floor(Math.random() * 8);
    placeFood();
    draw();

    const interval = setInterval(() => {
      if (document.hidden) return;
      if (reducedMotion && modeRef.current === 'auto') return;
      tick();
    }, TICK_MS);

    const onKey = (e: KeyboardEvent) => {
      // Seulement quand rien n'a le focus : sinon les flèches/lettres d'un bouton ou d'une
      // modale basculent en mode jeu et figent la galerie (pointer-events: none).
      if (e.target !== document.body) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (gameOverRef.current) return;

      let newDir: Dir | null = null;
      switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': case 'z': case 'Z': newDir = 'up';    break;
        case 'ArrowDown':  case 's': case 'S':                      newDir = 'down';  break;
        case 'ArrowLeft':  case 'a': case 'A': case 'q': case 'Q': newDir = 'left';  break;
        case 'ArrowRight': case 'd': case 'D':                      newDir = 'right'; break;
        case 'Escape':
          modeRef.current = 'auto';
          borderActiveRef.current = false;
          if (styles.active) canvas.classList.remove(styles.active);
          if (styles.dormant) canvas.classList.add(styles.dormant);
          movesUntilTurnRef.current = 4 + Math.floor(Math.random() * 8);
          draw();
          setShowHint(true);
          onModeChange?.(false);
          return;
      }

      if (newDir && newDir !== OPPOSITE[dirRef.current]) {
        nextDirRef.current = newDir;
        if (modeRef.current !== 'user') {
          modeRef.current = 'user';
          borderActiveRef.current = true;
          if (styles.dormant) canvas.classList.remove(styles.dormant);
          if (styles.active) canvas.classList.add(styles.active);
          draw();
          setShowHint(false);
          onModeChange?.(true);
        }
        e.preventDefault();
      }
    };

    const onResize = () => {
      const prevCols = colsRef.current;
      const prevRows = rowsRef.current;
      resize();
      if (colsRef.current === prevCols && rowsRef.current === prevRows) return;
      // En mode jeu, recaler les segments sur la nouvelle bordure les ferait se toucher d'un coup
      // (rotation, barre d'outils iOS) : on repart d'un serpent neuf.
      if (modeRef.current === 'user') {
        resetSnake();
        return;
      }
      const maxX = Math.max(BORDER_INSET, colsRef.current - BORDER_INSET - 1);
      const maxY = Math.max(BORDER_INSET, rowsRef.current - BORDER_INSET - 1);
      snakeRef.current = snakeRef.current.map((seg) => ({
        x: Math.min(Math.max(seg.x, BORDER_INSET), maxX),
        y: Math.min(Math.max(seg.y, BORDER_INSET), maxY),
      }));
      if (foodRef.current) {
        foodRef.current = {
          x: Math.min(Math.max(foodRef.current.x, BORDER_INSET), maxX),
          y: Math.min(Math.max(foodRef.current.y, BORDER_INSET), maxY),
        };
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [tick, draw, placeFood, resetSnake, onModeChange]);

  return (
    <>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {showHint && !gameOver && (
        <div className={styles.keyHint} aria-hidden="true">
          <div className={styles.keyHintGrid}>
            <div className={cx(styles.key, styles.keyZ)}>Z</div>
            <div className={cx(styles.key, styles.keyQ)}>Q</div>
            <div className={cx(styles.key, styles.keyS)}>S</div>
            <div className={cx(styles.key, styles.keyD)}>D</div>
          </div>
        </div>
      )}
      {gameOver ? (
        <div className={styles.gameOver} role="dialog" aria-modal="true" aria-labelledby="snake-gameover-title">
          <h2 id="snake-gameover-title" className={styles.title}>Game Over</h2>
          <div className={styles.actions}>
            <Button variant="primary" size="lg" autoFocus onClick={handleReplay}>Rejouer</Button>
            <Button variant="secondary" size="lg" onClick={handleBackToGallery}>Revenir à la galerie</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

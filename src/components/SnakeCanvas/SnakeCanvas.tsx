import { useEffect, useRef, useCallback } from 'react';
import styles from './SnakeCanvas.module.scss';

const CELL = 24;
const GAP = 3;
const MINI_CELL = (CELL - 2*GAP)/3;
const STEP = CELL + GAP;
const FOOD_SIZE = 24;
const FOOD_OFFSET = (CELL - FOOD_SIZE) / 2;
const TICK_MS = 150;
const INITIAL_LENGTH = 5;
const COLOR_AUTO = '#A28EFD';
const COLOR_USER = '#FFF8A9';
const COLOR_FOOD_AUTO = '#A28EFD';
const COLOR_FOOD_USER = '#FFFBD4';

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

  const placeFood = useCallback(() => {
    const occupied = new Set(snakeRef.current.map((s) => `${s.x},${s.y}`));
    let x = 0;
    let y = 0;
    let attempts = 0;
    do {
      x = Math.floor(Math.random() * colsRef.current);
      y = Math.floor(Math.random() * rowsRef.current);
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
    ctx.fillStyle = isUser ? COLOR_USER : COLOR_AUTO;
    for (const seg of snakeRef.current) {
      ctx.fillRect(seg.x * STEP,                          seg.y * STEP, MINI_CELL, MINI_CELL);
      ctx.fillRect(seg.x * STEP + MINI_CELL + GAP,        seg.y * STEP, MINI_CELL, MINI_CELL);
      ctx.fillRect(seg.x * STEP + MINI_CELL*2 + GAP*2,    seg.y * STEP, MINI_CELL, MINI_CELL);

      ctx.fillRect(seg.x * STEP,                          seg.y * STEP + MINI_CELL + GAP, MINI_CELL, MINI_CELL);
      ctx.fillRect(seg.x * STEP + MINI_CELL + GAP,        seg.y * STEP + MINI_CELL + GAP, MINI_CELL, MINI_CELL);
      ctx.fillRect(seg.x * STEP + MINI_CELL*2 + GAP*2,    seg.y * STEP + MINI_CELL + GAP, MINI_CELL, MINI_CELL);

      ctx.fillRect(seg.x * STEP,                          seg.y * STEP + (MINI_CELL)*2 + GAP*2, MINI_CELL, MINI_CELL);
      ctx.fillRect(seg.x * STEP + MINI_CELL + GAP,        seg.y * STEP + (MINI_CELL)*2 + GAP*2, MINI_CELL, MINI_CELL);
      ctx.fillRect(seg.x * STEP + MINI_CELL*2 + GAP*2,    seg.y * STEP + (MINI_CELL)*2 + GAP*2, MINI_CELL, MINI_CELL);
    }
    const food = foodRef.current;
    if (food) {
      ctx.fillStyle = isUser ? COLOR_FOOD_USER : COLOR_FOOD_AUTO;
      ctx.fillRect(
        food.x * STEP + FOOD_OFFSET + FOOD_SIZE/2-(FOOD_SIZE/4)/2,
        food.y * STEP + FOOD_OFFSET + FOOD_SIZE/2-(FOOD_SIZE/4)/2,
        FOOD_SIZE/4,
        FOOD_SIZE/4,
      );
      ctx.fillRect(
        food.x * STEP + FOOD_OFFSET + FOOD_SIZE/4,
        food.y * STEP + FOOD_OFFSET,
        FOOD_SIZE/2,
        FOOD_SIZE/6,
      );
      ctx.fillRect(
        food.x * STEP + FOOD_OFFSET + FOOD_SIZE/4,
        food.y * STEP + FOOD_OFFSET + FOOD_SIZE-FOOD_SIZE/6,
        FOOD_SIZE/2,
        FOOD_SIZE/6,
      );
      ctx.fillRect(
        food.x * STEP + FOOD_OFFSET + FOOD_SIZE-FOOD_SIZE/6,
        food.y * STEP + FOOD_OFFSET + FOOD_SIZE/4,
        FOOD_SIZE/6,
        FOOD_SIZE/2,
      );
      ctx.fillRect(
        food.x * STEP + FOOD_OFFSET,
        food.y * STEP + FOOD_OFFSET + FOOD_SIZE/4,
        FOOD_SIZE/6,
        FOOD_SIZE/2,
      );
    }
  }, []);

  const tick = useCallback(() => {
    dirRef.current = nextDirRef.current;
    const dir = dirRef.current;
    const head = snakeRef.current[0];
    if (!head) return;
    let nx = head.x;
    let ny = head.y;
    if (dir === 'right') nx++;
    else if (dir === 'left') nx--;
    else if (dir === 'up') ny--;
    else ny++;
    nx = ((nx % colsRef.current) + colsRef.current) % colsRef.current;
    ny = ((ny % rowsRef.current) + rowsRef.current) % rowsRef.current;

    const food = foodRef.current;
    const ate = food !== null && nx === food.x && ny === food.y;
    if (ate) {
      pendingGrowRef.current++;
      foodRef.current = null;
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
  }, [draw, placeFood]);

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

    const c = colsRef.current;
    const r = rowsRef.current;
    const midX = Math.floor(c / 2);
    const midY = Math.floor(r / 2);
    snakeRef.current = Array.from({ length: INITIAL_LENGTH }, (_, i) => ({ x: midX - i, y: midY }));
    movesUntilTurnRef.current = 4 + Math.floor(Math.random() * 8);
    placeFood();
    draw();

    const interval = setInterval(tick, TICK_MS);

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as Element | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      let newDir: Dir | null = null;
      switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': case 'z': case 'Z': newDir = 'up';    break;
        case 'ArrowDown':  case 's': case 'S':                      newDir = 'down';  break;
        case 'ArrowLeft':  case 'a': case 'A': case 'q': case 'Q': newDir = 'left';  break;
        case 'ArrowRight': case 'd': case 'D':                      newDir = 'right'; break;
        case 'Escape':
          modeRef.current = 'auto';
          if (styles.active) canvas.classList.remove(styles.active);
          if (styles.dormant) canvas.classList.add(styles.dormant);
          movesUntilTurnRef.current = 4 + Math.floor(Math.random() * 8);
          onModeChange?.(false);
          return;
      }

      if (newDir && newDir !== OPPOSITE[dirRef.current]) {
        nextDirRef.current = newDir;
        if (modeRef.current !== 'user') {
          modeRef.current = 'user';
          if (styles.dormant) canvas.classList.remove(styles.dormant);
          if (styles.active) canvas.classList.add(styles.active);
          onModeChange?.(true);
        }
        e.preventDefault();
      }
    };

    const onResize = () => {
      resize();
      snakeRef.current = snakeRef.current.map((seg) => ({
        x: Math.min(seg.x, colsRef.current - 1),
        y: Math.min(seg.y, rowsRef.current - 1),
      }));
      if (foodRef.current) {
        foodRef.current = {
          x: Math.min(foodRef.current.x, colsRef.current - 1),
          y: Math.min(foodRef.current.y, rowsRef.current - 1),
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
  }, [tick, draw, placeFood]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}

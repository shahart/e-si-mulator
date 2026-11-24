export interface ViewWindow {
  xMin: number;
  xMax: number;
  xScale: number;
  yMin: number;
  yMax: number;
  yScale: number;
}

export const DEFAULT_VIEW_WINDOW: ViewWindow = {
  xMin: -10,
  xMax: 10,
  xScale: 1,
  yMin: -10,
  yMax: 10,
  yScale: 1,
};

export type GraphAction =
  | { kind: 'clear' }
  | { kind: 'view'; window: ViewWindow }
  | { kind: 'plot'; x: number; y: number; on: boolean }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'text'; x: number; y: number; text: string };

export interface ProjectedPoint {
  x: number;
  y: number;
  visible: boolean;
}

export function projectPoint(
  window: ViewWindow,
  x: number,
  y: number,
  width: number,
  height: number,
): ProjectedPoint {
  const spanX = window.xMax - window.xMin;
  const spanY = window.yMax - window.yMin;
  if (!(spanX > 0) || !(spanY > 0) || width < 1 || height < 1) {
    return { x: 0, y: 0, visible: false };
  }

  const rawX = ((x - window.xMin) / spanX) * (width - 1);
  const rawY = (height - 1) - ((y - window.yMin) / spanY) * (height - 1);
  const pixelX = Math.round(rawX);
  const pixelY = Math.round(rawY);

  return {
    x: pixelX,
    y: pixelY,
    visible: Number.isFinite(rawX) && Number.isFinite(rawY)
      && pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height,
  };
}

export interface GraphRenderer {
  readonly window: ViewWindow;
  clear(): void;
  draw(actions: GraphAction[]): void;
}

export function createGraphRenderer(canvas: HTMLCanvasElement): GraphRenderer {
  const maybeContext = canvas.getContext('2d');
  if (!maybeContext) throw new Error('Canvas 2D context is unavailable.');
  const context: CanvasRenderingContext2D = maybeContext;

  const width = canvas.width;
  const height = canvas.height;
  const lcdColor = '#c6d2b3';
  const gridColor = '#b6c3a3';
  const inkColor = '#2e3a27';

  let view: ViewWindow = { ...DEFAULT_VIEW_WINDOW };

  function clear(): void {
    context.fillStyle = lcdColor;
    context.fillRect(0, 0, width, height);
    context.fillStyle = gridColor;
    for (let x = 15; x < width; x += 16) context.fillRect(x, 0, 1, height);
    for (let y = 15; y < height; y += 16) context.fillRect(0, y, width, 1);
  }

  function drawLine(x1: number, y1: number, x2: number, y2: number): void {
    let x = x1;
    let y = y1;
    const deltaX = Math.abs(x2 - x1);
    const deltaY = Math.abs(y2 - y1);
    const stepX = x1 < x2 ? 1 : -1;
    const stepY = y1 < y2 ? 1 : -1;
    let error = deltaX - deltaY;

    for (;;) {
      context.fillRect(x, y, 1, 1);
      if (x === x2 && y === y2) break;
      const doubled = error * 2;
      if (doubled > -deltaY) {
        error -= deltaY;
        x += stepX;
      }
      if (doubled < deltaX) {
        error += deltaX;
        y += stepY;
      }
    }
  }

  clear();

  return {
    get window(): ViewWindow {
      return { ...view };
    },

    clear,

    draw(actions: GraphAction[]): void {
      context.imageSmoothingEnabled = false;

      for (const action of actions) {
        if (action.kind === 'clear') {
          clear();
        } else if (action.kind === 'view') {
          view = { ...action.window };
        } else if (action.kind === 'plot') {
          const point = projectPoint(view, action.x, action.y, width, height);
          if (!point.visible) continue;
          context.fillStyle = action.on ? inkColor : lcdColor;
          context.fillRect(point.x, point.y, 1, 1);
        } else if (action.kind === 'line') {
          const start = projectPoint(view, action.x1, action.y1, width, height);
          const end = projectPoint(view, action.x2, action.y2, width, height);
          if (!start.visible || !end.visible) continue;
          context.fillStyle = inkColor;
          drawLine(start.x, start.y, end.x, end.y);
        } else {
          context.fillStyle = inkColor;
          context.font = '6px "DM Mono", monospace';
          context.fillText(action.text, action.x * 4, action.y * 6 + 6);
        }
      }
    },
  };
}

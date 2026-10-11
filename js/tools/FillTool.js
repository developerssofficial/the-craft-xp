/**
 * The Craft — Fill Tool (Bucket Flood Fill)
 * Flood fill pixel algorithm on the active layer's raster canvas.
 */
import { BaseTool } from './BaseTool.js';
import { events } from '../core/EventBus.js';

export class FillTool extends BaseTool {
  constructor() {
    super('fill', 'Paint Bucket', 'crosshair');
  }

  onPointerDown(e, ctx) {
    if (ctx.activeLayer.locked || !ctx.activeLayer.visible) return;

    const startX = Math.floor(ctx.x);
    const startY = Math.floor(ctx.y);
    const width = ctx.doc.width;
    const height = ctx.doc.height;

    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

    // Get raster canvas for active layer
    ctx.activeLayer.ensureRasterCanvas(width, height);
    const rasterCtx = ctx.activeLayer.rasterCtx;

    // Save previous snapshot for undo
    const prevData = rasterCtx.getImageData(0, 0, width, height);

    // Isolate active layer content (raster + vector) so fill works STRICTLY on active layer
    const activeBuffer = document.createElement('canvas');
    activeBuffer.width = width;
    activeBuffer.height = height;
    const activeCtx = activeBuffer.getContext('2d', { willReadFrequently: true });

    if (ctx.activeLayer.rasterCanvas) {
      activeCtx.drawImage(ctx.activeLayer.rasterCanvas, 0, 0);
    }
    if (ctx.activeLayer.elements && ctx.activeLayer.elements.length > 0) {
      ctx.activeLayer.elements.forEach(el => ctx.renderer.renderElement(activeCtx, el));
    }

    const activeLayerData = activeCtx.getImageData(0, 0, width, height);
    const targetIdx = (startY * width + startX) * 4;
    const targetR = activeLayerData.data[targetIdx];
    const targetG = activeLayerData.data[targetIdx + 1];
    const targetB = activeLayerData.data[targetIdx + 2];
    const targetA = activeLayerData.data[targetIdx + 3];

    // Convert active fill color to RGBA
    const fillColor = this.hexToRgba(ctx.toolState.color, ctx.toolState.opacity);

    // If clicking same color, return
    if (this.colorMatch(targetR, targetG, targetB, targetA, fillColor.r, fillColor.g, fillColor.b, fillColor.a, 5)) {
      return;
    }

    // Perform flood fill on active layer raster canvas
    const layerImgData = rasterCtx.getImageData(0, 0, width, height);
    this.floodFill(layerImgData, activeLayerData, startX, startY, width, height, targetR, targetG, targetB, targetA, fillColor);

    rasterCtx.putImageData(layerImgData, 0, 0);

    // Create undo/redo command
    const layerId = ctx.activeLayer.id;
    const doc = ctx.doc;
    const nextData = rasterCtx.getImageData(0, 0, width, height);

    ctx.commandManager.execute({
      execute() {
        const l = doc.layers.find(layer => layer.id === layerId);
        if (l && l.rasterCtx) {
          l.rasterCtx.putImageData(nextData, 0, 0);
          events.emit('document:changed');
        }
      },
      undo() {
        const l = doc.layers.find(layer => layer.id === layerId);
        if (l && l.rasterCtx) {
          l.rasterCtx.putImageData(prevData, 0, 0);
          events.emit('document:changed');
        }
      }
    });

    events.emit('document:changed');
  }

  floodFill(layerData, compData, startX, startY, width, height, tr, tg, tb, ta, fill) {
    const lData = layerData.data;
    const cData = compData.data;
    const queue = [[startX, startY]];
    const visited = new Uint8Array(width * height);
    const fillMask = new Uint8Array(width * height);
    const tolerance = 36;

    let minX = startX;
    let maxX = startX;
    let minY = startY;
    let maxY = startY;

    while (queue.length > 0) {
      const [x, y] = queue.pop();
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const idx = y * width + x;
      if (visited[idx]) continue;
      visited[idx] = 1;

      const pIdx = idx * 4;
      const cr = cData[pIdx];
      const cg = cData[pIdx + 1];
      const cb = cData[pIdx + 2];
      const ca = cData[pIdx + 3];

      if (this.colorMatch(cr, cg, cb, ca, tr, tg, tb, ta, tolerance)) {
        fillMask[idx] = 1;
        lData[pIdx] = fill.r;
        lData[pIdx + 1] = fill.g;
        lData[pIdx + 2] = fill.b;
        lData[pIdx + 3] = fill.a;

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        if (x > 0 && !visited[idx - 1]) queue.push([x - 1, y]);
        if (x < width - 1 && !visited[idx + 1]) queue.push([x + 1, y]);
        if (y > 0 && !visited[idx - width]) queue.push([x, y - 1]);
        if (y < height - 1 && !visited[idx + width]) queue.push([x, y + 1]);
      }
    }

    // Expand / Bleed fill by 2 pixels (Dilation) into surrounding outline stroke
    // This completely eliminates white borders, halos, and uncolored fringes
    this.expandFill(lData, fillMask, width, height, fill, minX, maxX, minY, maxY, 2);
  }

  /**
   * Expands the filled region by `radius` pixels outwards into neighboring pixels.
   * Since rasterCanvas sits underneath vector strokes, this bleed neatly hides beneath
   * the stroke borders, resulting in a gap-free, professional fill.
   */
  expandFill(lData, fillMask, width, height, fill, minX, maxX, minY, maxY, radius = 2) {
    let currentBoundary = [];
    const boundMinX = Math.max(0, minX - 1);
    const boundMaxX = Math.min(width - 1, maxX + 1);
    const boundMinY = Math.max(0, minY - 1);
    const boundMaxY = Math.min(height - 1, maxY + 1);

    for (let y = boundMinY; y <= boundMaxY; y++) {
      const yOffset = y * width;
      for (let x = boundMinX; x <= boundMaxX; x++) {
        const idx = yOffset + x;
        if (!fillMask[idx]) continue;

        if (
          (x > 0 && !fillMask[idx - 1]) ||
          (x < width - 1 && !fillMask[idx + 1]) ||
          (y > 0 && !fillMask[idx - width]) ||
          (y < height - 1 && !fillMask[idx + width])
        ) {
          currentBoundary.push(idx);
        }
      }
    }

    for (let step = 0; step < radius; step++) {
      const nextBoundary = [];
      for (let i = 0; i < currentBoundary.length; i++) {
        const idx = currentBoundary[i];
        const x = idx % width;
        const y = Math.floor(idx / width);

        const neighbors = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1]
        ];

        for (let j = 0; j < 4; j++) {
          const [nx, ny] = neighbors[j];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!fillMask[nIdx]) {
              fillMask[nIdx] = 1;
              const pIdx = nIdx * 4;
              lData[pIdx] = fill.r;
              lData[pIdx + 1] = fill.g;
              lData[pIdx + 2] = fill.b;
              lData[pIdx + 3] = fill.a;
              nextBoundary.push(nIdx);
            }
          }
        }
      }
      currentBoundary = nextBoundary;
      if (currentBoundary.length === 0) break;
    }
  }

  colorMatch(r1, g1, b1, a1, r2, g2, b2, a2, tol) {
    return (
      Math.abs(r1 - r2) <= tol &&
      Math.abs(g1 - g2) <= tol &&
      Math.abs(b1 - b2) <= tol &&
      Math.abs(a1 - a2) <= tol
    );
  }

  hexToRgba(hex, opacity = 1.0) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
      a: Math.round(opacity * 255)
    };
  }
}

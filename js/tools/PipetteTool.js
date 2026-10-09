/**
 * The Craft — Pipette Tool (Eyedropper)
 * Samples pixel color from canvas and updates active tool color.
 */
import { BaseTool } from './BaseTool.js';
import { events } from '../core/EventBus.js';

export class PipetteTool extends BaseTool {
  constructor() {
    super('pipette', 'Eyedropper', 'crosshair');
  }

  onPointerDown(e, ctx) {
    const x = Math.floor(ctx.x);
    const y = Math.floor(ctx.y);
    const width = ctx.doc.width;
    const height = ctx.doc.height;

    if (x < 0 || x >= width || y < 0 || y >= height) return;

    const pixel = ctx.renderer.paintCtx.getImageData(x, y, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];
    const a = pixel[3];

    if (a === 0) return; // Transparent

    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    events.emit('color:selected', { color: hex });
    events.emit('toast', { message: `Sampled color: ${hex}` });
  }
}

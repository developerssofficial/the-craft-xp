/**
 * The Craft — Stamp Tool
 * Inserts emoji stamps onto the active layer.
 */
import { BaseTool } from './BaseTool.js';
import { DrawCommand } from '../core/commands/DrawCommand.js';

export class StampTool extends BaseTool {
  constructor() {
    super('stamp', 'Emoji Stamp', 'crosshair');
  }

  onPointerDown(e, ctx) {
    if (ctx.activeLayer.locked || !ctx.activeLayer.visible) return;

    const elements = [];
    const stampEl = {
      type: 'stamp',
      emoji: ctx.toolState.selectedStamp || '⭐',
      size: ctx.toolState.size * 3.5 || 40,
      x: ctx.x,
      y: ctx.y,
      opacity: ctx.toolState.opacity
    };
    elements.push(stampEl);

    if (ctx.isSymmetry) {
      const midX = ctx.doc.width / 2;
      const mirrorStamp = {
        type: 'stamp',
        emoji: ctx.toolState.selectedStamp || '⭐',
        size: ctx.toolState.size * 3.5 || 40,
        x: midX * 2 - ctx.x,
        y: ctx.y,
        opacity: ctx.toolState.opacity
      };
      elements.push(mirrorStamp);
    }

    ctx.commandManager.execute(new DrawCommand(ctx.doc, ctx.activeLayer.id, elements));
  }
}

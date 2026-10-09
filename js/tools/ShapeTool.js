/**
 * The Craft — Shape Tool
 * Handles vector lines, arrows, rectangles, circles, stars, and hearts.
 */
import { BaseTool } from './BaseTool.js';
import { DrawCommand } from '../core/commands/DrawCommand.js';

export class ShapeTool extends BaseTool {
  constructor(shapeType = 'rectangle') {
    super(shapeType, shapeType.charAt(0).toUpperCase() + shapeType.slice(1), 'crosshair');
    this.shapeType = shapeType;
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currX = 0;
    this.currY = 0;
  }

  onPointerDown(e, ctx) {
    if (ctx.activeLayer.locked || !ctx.activeLayer.visible) return;

    this.isDrawing = true;
    this.startX = ctx.x;
    this.startY = ctx.y;
    this.currX = ctx.x;
    this.currY = ctx.y;
  }

  onPointerMove(e, ctx) {
    if (!this.isDrawing) return;
    this.currX = ctx.x;
    this.currY = ctx.y;
    this.renderPreview(ctx.renderer.previewCtx, ctx);
  }

  onPointerUp(e, ctx) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    const w = this.currX - this.startX;
    const h = this.currY - this.startY;

    // Minimum drag threshold
    if (Math.abs(w) > 3 || Math.abs(h) > 3) {
      const elements = [];
      const shapeEl = {
        type: 'shape',
        shapeType: this.shapeType,
        x: this.startX,
        y: this.startY,
        width: w,
        height: h,
        color: ctx.toolState.color,
        size: ctx.toolState.size,
        fill: ctx.toolState.fillShape,
        opacity: ctx.toolState.opacity
      };
      elements.push(shapeEl);

      if (ctx.isSymmetry) {
        const midX = ctx.doc.width / 2;
        const symStartX = midX * 2 - this.startX;
        const symWidth = -w;
        const mirrorShape = {
          type: 'shape',
          shapeType: this.shapeType,
          x: symStartX,
          y: this.startY,
          width: symWidth,
          height: h,
          color: ctx.toolState.color,
          size: ctx.toolState.size,
          fill: ctx.toolState.fillShape,
          opacity: ctx.toolState.opacity
        };
        elements.push(mirrorShape);
      }

      ctx.commandManager.execute(new DrawCommand(ctx.doc, ctx.activeLayer.id, elements));
    }

    ctx.renderer.previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);
  }

  renderPreview(previewCtx, ctx) {
    previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);
    if (!this.isDrawing) return;

    const w = this.currX - this.startX;
    const h = this.currY - this.startY;

    const tempShape = {
      type: 'shape',
      shapeType: this.shapeType,
      x: this.startX,
      y: this.startY,
      width: w,
      height: h,
      color: ctx.toolState.color,
      size: ctx.toolState.size,
      fill: ctx.toolState.fillShape,
      opacity: ctx.toolState.opacity
    };

    ctx.renderer.renderShape(previewCtx, tempShape);

    if (ctx.isSymmetry) {
      const midX = ctx.doc.width / 2;
      const symStartX = midX * 2 - this.startX;
      const symWidth = -w;
      const tempMirror = {
        type: 'shape',
        shapeType: this.shapeType,
        x: symStartX,
        y: this.startY,
        width: symWidth,
        height: h,
        color: ctx.toolState.color,
        size: ctx.toolState.size,
        fill: ctx.toolState.fillShape,
        opacity: ctx.toolState.opacity
      };
      ctx.renderer.renderShape(previewCtx, tempMirror);
    }
  }

  cleanup() {
    this.isDrawing = false;
  }
}

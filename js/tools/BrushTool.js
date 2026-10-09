/**
 * The Craft — Brush Tool
 * Handles smooth brush, pencil, neon glow, rainbow stream, highlighter, and eraser.
 * Full stylus pressure support and optional symmetry/mirror drawing.
 */
import { BaseTool } from './BaseTool.js';
import { DrawCommand } from '../core/commands/DrawCommand.js';

export class BrushTool extends BaseTool {
  constructor(mode = 'brush') {
    super(mode, mode.charAt(0).toUpperCase() + mode.slice(1), 'crosshair');
    this.mode = mode; // 'brush', 'pencil', 'neon', 'rainbow', 'highlighter', 'eraser'
    this.isDrawing = false;
    this.points = [];
    this.symPoints = [];
    this.rainbowHue = 0;
  }

  onPointerDown(e, ctx) {
    if (ctx.activeLayer.locked || !ctx.activeLayer.visible) {
      return;
    }

    this.isDrawing = true;
    const p = { x: ctx.x, y: ctx.y, pressure: ctx.pressure };
    this.points = [p];

    if (ctx.isSymmetry) {
      const midX = ctx.doc.width / 2;
      this.symPoints = [{ x: midX * 2 - ctx.x, y: ctx.y, pressure: ctx.pressure }];
    } else {
      this.symPoints = [];
    }

    // Set preview cursor
    this.renderPreview(ctx.renderer.previewCtx, ctx);
  }

  onPointerMove(e, ctx) {
    if (!this.isDrawing) return;

    const p = { x: ctx.x, y: ctx.y, pressure: ctx.pressure };
    this.points.push(p);

    if (ctx.isSymmetry) {
      const midX = ctx.doc.width / 2;
      this.symPoints.push({ x: midX * 2 - ctx.x, y: ctx.y, pressure: ctx.pressure });
    }

    if (this.mode === 'rainbow') {
      this.rainbowHue = (this.rainbowHue + 3) % 360;
    }

    this.renderPreview(ctx.renderer.previewCtx, ctx);
  }

  onPointerUp(e, ctx) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.points.length >= 2) {
      const color = this.mode === 'rainbow' ? `hsl(${this.rainbowHue}, 100%, 55%)` : ctx.toolState.color;
      const elementsToCommit = [];

      const mainStroke = {
        type: 'stroke',
        tool: this.mode,
        color: color,
        size: ctx.toolState.size,
        opacity: ctx.toolState.opacity,
        points: [...this.points]
      };
      elementsToCommit.push(mainStroke);

      if (ctx.isSymmetry && this.symPoints.length >= 2) {
        const mirrorStroke = {
          type: 'stroke',
          tool: this.mode,
          color: color,
          size: ctx.toolState.size,
          opacity: ctx.toolState.opacity,
          points: [...this.symPoints]
        };
        elementsToCommit.push(mirrorStroke);
      }

      ctx.commandManager.execute(new DrawCommand(ctx.doc, ctx.activeLayer.id, elementsToCommit));
    }

    this.points = [];
    this.symPoints = [];
    ctx.renderer.previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);
  }

  renderPreview(previewCtx, ctx) {
    previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);
    if (!this.isDrawing || this.points.length < 2) return;

    const color = this.mode === 'rainbow' ? `hsl(${this.rainbowHue}, 100%, 55%)` : ctx.toolState.color;
    const tempStroke = {
      type: 'stroke',
      tool: this.mode,
      color: color,
      size: ctx.toolState.size,
      opacity: ctx.toolState.opacity,
      points: this.points
    };

    ctx.renderer.renderStroke(previewCtx, tempStroke);

    if (ctx.isSymmetry && this.symPoints.length >= 2) {
      const tempMirror = {
        type: 'stroke',
        tool: this.mode,
        color: color,
        size: ctx.toolState.size,
        opacity: ctx.toolState.opacity,
        points: this.symPoints
      };
      ctx.renderer.renderStroke(previewCtx, tempMirror);
    }
  }

  cleanup() {
    this.isDrawing = false;
    this.points = [];
    this.symPoints = [];
  }
}

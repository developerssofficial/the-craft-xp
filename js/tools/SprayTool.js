/**
 * The Craft — Spray Tool
 * Simulates particle airbrush spray on the active layer.
 */
import { BaseTool } from './BaseTool.js';
import { DrawCommand } from '../core/commands/DrawCommand.js';

export class SprayTool extends BaseTool {
  constructor() {
    super('spray', 'Airbrush', 'crosshair');
    this.isSpraying = false;
    this.drops = [];
    this.intervalId = null;
  }

  onPointerDown(e, ctx) {
    if (ctx.activeLayer.locked || !ctx.activeLayer.visible) return;

    this.isSpraying = true;
    this.drops = [];
    this.sprayAt(ctx.x, ctx.y, ctx.toolState.size);
    this.renderPreview(ctx.renderer.previewCtx, ctx);

    this.intervalId = setInterval(() => {
      if (this.isSpraying) {
        this.sprayAt(ctx.x, ctx.y, ctx.toolState.size);
        this.renderPreview(ctx.renderer.previewCtx, ctx);
      }
    }, 25);
  }

  onPointerMove(e, ctx) {
    if (!this.isSpraying) return;
    this.sprayAt(ctx.x, ctx.y, ctx.toolState.size);
    this.renderPreview(ctx.renderer.previewCtx, ctx);
  }

  sprayAt(cx, cy, radius) {
    const density = Math.max(8, Math.floor(radius * 1.2));
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      this.drops.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        radius: Math.random() > 0.8 ? 1.5 : 0.8
      });
    }
  }

  onPointerUp(e, ctx) {
    if (!this.isSpraying) return;
    this.isSpraying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.drops.length > 0) {
      const sprayEl = {
        type: 'spray',
        color: ctx.toolState.color,
        opacity: ctx.toolState.opacity,
        drops: [...this.drops]
      };
      ctx.commandManager.execute(new DrawCommand(ctx.doc, ctx.activeLayer.id, sprayEl));
    }

    this.drops = [];
    ctx.renderer.previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);
  }

  renderPreview(previewCtx, ctx) {
    previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);
    if (this.drops.length === 0) return;

    const tempSpray = {
      type: 'spray',
      color: ctx.toolState.color,
      opacity: ctx.toolState.opacity,
      drops: this.drops
    };
    ctx.renderer.renderSpray(previewCtx, tempSpray);
  }

  cleanup() {
    this.isSpraying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.drops = [];
  }
}

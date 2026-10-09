/**
 * The Craft — Text Tool
 * Interactive typography tool with inline canvas text input.
 */
import { BaseTool } from './BaseTool.js';
import { DrawCommand } from '../core/commands/DrawCommand.js';

export class TextTool extends BaseTool {
  constructor(inlineInputEl) {
    super('text', 'Text Tool', 'text');
    this.inlineInput = inlineInputEl;
    this.activePos = null;
    this.currentContext = null;

    if (this.inlineInput) {
      this.inlineInput.addEventListener('keydown', (e) => this.handleInlineKeydown(e));
      this.inlineInput.addEventListener('blur', () => this.commitInlineText());
    }
  }

  onPointerDown(e, ctx) {
    if (ctx.activeLayer.locked || !ctx.activeLayer.visible) return;

    this.currentContext = ctx;
    this.activePos = { x: ctx.x, y: ctx.y };

    if (!this.inlineInput) return;

    this.inlineInput.value = '';
    this.inlineInput.style.left = `${ctx.x}px`;
    this.inlineInput.style.top = `${ctx.y}px`;
    this.inlineInput.style.color = ctx.toolState.color;
    this.inlineInput.style.fontSize = `${Math.max(16, ctx.toolState.size * 2)}px`;
    this.inlineInput.classList.remove('hidden');
    this.inlineInput.focus();
  }

  handleInlineKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.commitInlineText();
    } else if (e.key === 'Escape') {
      this.cancelInlineText();
    }
  }

  commitInlineText() {
    if (!this.inlineInput || !this.activePos || !this.currentContext) return;

    const text = this.inlineInput.value.trim();
    if (text) {
      const textEl = {
        type: 'text',
        text: text,
        x: this.activePos.x,
        y: this.activePos.y,
        color: this.currentContext.toolState.color,
        fontSize: Math.max(16, this.currentContext.toolState.size * 2),
        fontWeight: '600',
        opacity: this.currentContext.toolState.opacity
      };

      this.currentContext.commandManager.execute(
        new DrawCommand(this.currentContext.doc, this.currentContext.activeLayer.id, textEl)
      );
    }

    this.cancelInlineText();
  }

  cancelInlineText() {
    if (this.inlineInput) {
      this.inlineInput.classList.add('hidden');
      this.inlineInput.value = '';
    }
    this.activePos = null;
  }

  cleanup() {
    this.commitInlineText();
  }
}

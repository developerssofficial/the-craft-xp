/**
 * The Craft — Select Tool
 * Allows selecting, moving, and resizing elements on the active layer.
 * Full undo/redo integration via TransformCommand.
 */
import { BaseTool } from './BaseTool.js';
import { TransformCommand } from '../core/commands/TransformCommand.js';
import { events } from '../core/EventBus.js';

export class SelectTool extends BaseTool {
  constructor() {
    super('select', 'Select & Move', 'default');
    this.selectedElement = null;
    this.selectedLayerId = null;
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null; // 'nw', 'ne', 'se', 'sw'
    this.dragOffset = { x: 0, y: 0 };
    this.initialElementState = null;
  }

  onPointerDown(e, ctx) {
    const x = ctx.x;
    const y = ctx.y;

    // Check if clicking a resize handle of currently selected element
    if (this.selectedElement && this.selectedLayerId) {
      const parentLayer = ctx.doc.layers.find(l => l.id === this.selectedLayerId);
      if (parentLayer && parentLayer.locked) {
        events.emit('toast', { message: 'Layer is locked', type: 'warning' });
        return;
      }
      const handle = this.hitTestHandles(this.selectedElement, x, y, ctx.renderer);
      if (handle) {
        this.isResizing = true;
        this.resizeHandle = handle;
        this.initialElementState = this.snapshotElement(this.selectedElement);
        return;
      }
    }

    // Hit test elements on the active layer first, then other visible layers
    let found = null;
    let foundLayerId = null;

    const layersToSearch = [
      ctx.activeLayer,
      ...ctx.doc.layers.filter(l => l.id !== ctx.activeLayer.id && l.visible && !l.locked)
    ];

    for (const layer of layersToSearch) {
      if (!layer.visible || layer.locked) continue;
      // Search from top element to bottom
      for (let i = layer.elements.length - 1; i >= 0; i--) {
        const el = layer.elements[i];
        if (this.hitTestElement(el, x, y, ctx.renderer)) {
          found = el;
          foundLayerId = layer.id;
          break;
        }
      }
      if (found) break;
    }

    if (found) {
      this.selectedElement = found;
      this.selectedLayerId = foundLayerId;
      ctx.renderer.selectedElement = found;
      ctx.doc.setActiveLayer(foundLayerId);

      this.isDragging = true;
      const bounds = ctx.renderer.getElementBounds(found);
      this.dragOffset = { x: x - bounds.x, y: y - bounds.y };
      this.initialElementState = this.snapshotElement(found);
    } else {
      this.selectedElement = null;
      this.selectedLayerId = null;
      ctx.renderer.selectedElement = null;
    }

    events.emit('element:selected', { element: this.selectedElement });
    ctx.renderer.render();
  }

  onPointerMove(e, ctx) {
    if (!this.selectedElement) return;

    if (this.isDragging) {
      const bounds = ctx.renderer.getElementBounds(this.selectedElement);
      if (!bounds) return;

      const targetX = ctx.x - this.dragOffset.x;
      const targetY = ctx.y - this.dragOffset.y;
      const dx = targetX - bounds.x;
      const dy = targetY - bounds.y;

      this.moveElementBy(this.selectedElement, dx, dy);
      ctx.renderer.render();
    } else if (this.isResizing) {
      this.resizeElementTo(this.selectedElement, ctx.x, ctx.y, this.resizeHandle, ctx.renderer);
      ctx.renderer.render();
    }
  }

  onPointerUp(e, ctx) {
    if ((this.isDragging || this.isResizing) && this.selectedElement && this.initialElementState) {
      const finalState = this.snapshotElement(this.selectedElement);
      // Check if actually moved
      if (JSON.stringify(this.initialElementState) !== JSON.stringify(finalState)) {
        ctx.commandManager.execute(
          new TransformCommand(
            ctx.doc,
            this.selectedLayerId,
            this.selectedElement.id,
            this.initialElementState,
            finalState
          )
        );
      }
    }

    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.initialElementState = null;
  }

  hitTestElement(el, px, py, renderer) {
    const bounds = renderer.getElementBounds(el);
    if (!bounds) return false;
    const pad = 6;
    return (
      px >= bounds.x - pad &&
      px <= bounds.x + bounds.width + pad &&
      py >= bounds.y - pad &&
      py <= bounds.y + bounds.height + pad
    );
  }

  hitTestHandles(el, px, py, renderer) {
    const b = renderer.getElementBounds(el);
    if (!b) return null;
    const r = 8;

    const handles = {
      nw: { x: b.x - 4, y: b.y - 4 },
      ne: { x: b.x + b.width + 4, y: b.y - 4 },
      se: { x: b.x + b.width + 4, y: b.y + b.height + 4 },
      sw: { x: b.x - 4, y: b.y + b.height + 4 }
    };

    for (const [key, pt] of Object.entries(handles)) {
      if (Math.hypot(px - pt.x, py - pt.y) <= r) {
        return key;
      }
    }
    return null;
  }

  moveElementBy(el, dx, dy) {
    if (el.type === 'stroke') {
      el.points.forEach(p => {
        p.x += dx;
        p.y += dy;
      });
    } else if (el.type === 'spray') {
      el.drops.forEach(d => {
        d.x += dx;
        d.y += dy;
      });
    } else {
      el.x += dx;
      el.y += dy;
    }
  }

  resizeElementTo(el, px, py, handle, renderer) {
    const b = renderer.getElementBounds(el);
    if (!b) return;

    if (el.type === 'shape' || el.type === 'image') {
      let newX = el.x;
      let newY = el.y;
      let newW = el.width;
      let newH = el.height;

      if (handle === 'se') {
        newW = px - newX;
        newH = py - newY;
      } else if (handle === 'sw') {
        newW = (newX + newW) - px;
        newX = px;
        newH = py - newY;
      } else if (handle === 'ne') {
        newW = px - newX;
        newH = (newY + newH) - py;
        newY = py;
      } else if (handle === 'nw') {
        newW = (newX + newW) - px;
        newH = (newY + newH) - py;
        newX = px;
        newY = py;
      }

      el.x = newX;
      el.y = newY;
      el.width = newW;
      el.height = newH;
    } else if (el.type === 'stamp') {
      el.size = Math.max(16, Math.hypot(px - el.x, py - el.y) * 1.5);
    }
  }

  snapshotElement(el) {
    return JSON.parse(JSON.stringify(el));
  }

  deleteSelected(doc, commandManager) {
    if (!this.selectedElement || !this.selectedLayerId) return false;

    const layer = doc.layers.find(l => l.id === this.selectedLayerId);
    if (!layer) return false;
    if (layer.locked) {
      events.emit('toast', { message: 'Cannot delete from locked layer', type: 'warning' });
      return false;
    }

    const el = this.selectedElement;
    const layerId = this.selectedLayerId;

    commandManager.execute({
      execute() {
        const l = doc.layers.find(lay => lay.id === layerId);
        if (l) l.removeElement(el.id);
        events.emit('document:changed');
      },
      undo() {
        const l = doc.layers.find(lay => lay.id === layerId);
        if (l) l.addElement(el);
        events.emit('document:changed');
      }
    });

    this.selectedElement = null;
    this.selectedLayerId = null;
    events.emit('element:selected', { element: null });
    return true;
  }

  cleanup() {
    this.selectedElement = null;
    this.selectedLayerId = null;
    this.isDragging = false;
    this.isResizing = false;
  }
}

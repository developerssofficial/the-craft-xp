/**
 * The Craft — Draw Command
 * Encapsulates adding vector elements to a layer with full undo/redo.
 */
import { events } from '../EventBus.js';

export class DrawCommand {
  constructor(document, layerId, elements) {
    this.document = document;
    this.layerId = layerId;
    this.elements = Array.isArray(elements) ? elements : [elements];
  }

  execute() {
    const layer = this.document.layers.find(l => l.id === this.layerId);
    if (!layer) return;

    this.elements.forEach(el => {
      layer.addElement(el);
    });
    events.emit('document:changed');
  }

  undo() {
    const layer = this.document.layers.find(l => l.id === this.layerId);
    if (!layer) return;

    this.elements.forEach(el => {
      layer.removeElement(el.id);
    });
    events.emit('document:changed');
  }
}

export class ClearLayerCommand {
  constructor(document, layerId) {
    this.document = document;
    this.layerId = layerId;
    this.previousElements = [];
  }

  execute() {
    const layer = this.document.layers.find(l => l.id === this.layerId);
    if (!layer) return;

    this.previousElements = [...layer.elements];
    layer.clear();
    events.emit('document:changed');
  }

  undo() {
    const layer = this.document.layers.find(l => l.id === this.layerId);
    if (!layer) return;

    layer.elements = [...this.previousElements];
    events.emit('document:changed');
  }
}

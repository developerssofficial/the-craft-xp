/**
 * The Craft — Transform Command
 * Encapsulates moving and resizing elements in a layer with undo/redo.
 */
import { events } from '../EventBus.js';

export class TransformCommand {
  constructor(document, layerId, elementId, oldState, newState) {
    this.document = document;
    this.layerId = layerId;
    this.elementId = elementId;
    this.oldState = JSON.parse(JSON.stringify(oldState));
    this.newState = JSON.parse(JSON.stringify(newState));
  }

  execute() {
    this.applyState(this.newState);
  }

  undo() {
    this.applyState(this.oldState);
  }

  applyState(state) {
    const layer = this.document.layers.find(l => l.id === this.layerId);
    if (!layer) return;

    const el = layer.elements.find(e => e.id === this.elementId);
    if (!el) return;

    Object.assign(el, state);
    events.emit('document:changed');
  }
}

/**
 * The Craft — Layer Commands
 * Reversible commands for layer operations: Add, Delete, Duplicate, Reorder, Merge, Property change.
 */
import { events } from '../EventBus.js';

export class AddLayerCommand {
  constructor(document, name = null, insertIndex = null) {
    this.document = document;
    this.name = name;
    this.insertIndex = insertIndex;
    this.createdLayer = null;
    this.previousActiveId = document.activeLayerId;
  }

  execute() {
    if (!this.createdLayer) {
      this.createdLayer = this.document.addLayer(this.name, this.insertIndex);
    } else {
      const idx = this.insertIndex !== null ? this.insertIndex : this.document.layers.length;
      this.document.layers.splice(idx, 0, this.createdLayer);
      this.document.setActiveLayer(this.createdLayer.id);
      events.emit('layer:added', { layer: this.createdLayer });
      events.emit('document:changed');
    }
  }

  undo() {
    if (!this.createdLayer) return;
    const idx = this.document.layers.findIndex(l => l.id === this.createdLayer.id);
    if (idx !== -1) {
      this.document.layers.splice(idx, 1);
      this.document.setActiveLayer(this.previousActiveId);
      events.emit('layer:removed', { layer: this.createdLayer });
      events.emit('document:changed');
    }
  }
}

export class DeleteLayerCommand {
  constructor(document, layerId) {
    this.document = document;
    this.layerId = layerId;
    this.deletedLayer = null;
    this.deletedIndex = -1;
    this.previousActiveId = document.activeLayerId;
  }

  execute() {
    this.deletedIndex = this.document.layers.findIndex(l => l.id === this.layerId);
    if (this.deletedIndex !== -1 && this.document.layers.length > 1) {
      this.deletedLayer = this.document.layers[this.deletedIndex];
      this.document.removeLayer(this.layerId);
    }
  }

  undo() {
    if (!this.deletedLayer || this.deletedIndex === -1) return;
    this.document.layers.splice(this.deletedIndex, 0, this.deletedLayer);
    this.document.setActiveLayer(this.deletedLayer.id);
    events.emit('layer:added', { layer: this.deletedLayer });
    events.emit('document:changed');
  }
}

export class DuplicateLayerCommand {
  constructor(document, layerId) {
    this.document = document;
    this.layerId = layerId;
    this.duplicatedLayer = null;
    this.previousActiveId = document.activeLayerId;
  }

  execute() {
    if (!this.duplicatedLayer) {
      this.duplicatedLayer = this.document.duplicateLayer(this.layerId);
    } else {
      const idx = this.document.layers.findIndex(l => l.id === this.layerId);
      this.document.layers.splice(idx + 1, 0, this.duplicatedLayer);
      this.document.setActiveLayer(this.duplicatedLayer.id);
      events.emit('layer:added', { layer: this.duplicatedLayer });
      events.emit('document:changed');
    }
  }

  undo() {
    if (!this.duplicatedLayer) return;
    const idx = this.document.layers.findIndex(l => l.id === this.duplicatedLayer.id);
    if (idx !== -1) {
      this.document.layers.splice(idx, 1);
      this.document.setActiveLayer(this.previousActiveId);
      events.emit('layer:removed', { layer: this.duplicatedLayer });
      events.emit('document:changed');
    }
  }
}

export class ReorderLayerCommand {
  constructor(document, fromIndex, toIndex) {
    this.document = document;
    this.fromIndex = fromIndex;
    this.toIndex = toIndex;
  }

  execute() {
    this.document.reorderLayers(this.fromIndex, this.toIndex);
  }

  undo() {
    this.document.reorderLayers(this.toIndex, this.fromIndex);
  }
}

export class MergeDownCommand {
  constructor(document, layerId) {
    this.document = document;
    this.layerId = layerId;
    this.mergedLayer = null;
    this.originalIndex = -1;
    this.targetLayerBeforeJson = null;
  }

  execute() {
    this.originalIndex = this.document.layers.findIndex(l => l.id === this.layerId);
    if (this.originalIndex > 0) {
      this.mergedLayer = this.document.layers[this.originalIndex];
      const target = this.document.layers[this.originalIndex - 1];
      this.targetLayerBeforeJson = target.toJSON();
      this.document.mergeDown(this.layerId);
    }
  }

  undo() {
    if (!this.mergedLayer || this.originalIndex <= 0) return;
    const targetIdx = this.originalIndex - 1;
    if (targetIdx >= 0 && targetIdx < this.document.layers.length) {
      // Restore target layer state
      const restored = this.document.layers[targetIdx];
      restored.elements = JSON.parse(JSON.stringify(this.targetLayerBeforeJson.elements));
      restored.opacity = this.targetLayerBeforeJson.opacity;
      restored.blendMode = this.targetLayerBeforeJson.blendMode;
      if (this.targetLayerBeforeJson.rasterDataUrl) {
        restored.loadRasterFromDataUrl(this.targetLayerBeforeJson.rasterDataUrl);
      }

      // Re-insert merged layer
      this.document.layers.splice(this.originalIndex, 0, this.mergedLayer);
      this.document.setActiveLayer(this.mergedLayer.id);
      events.emit('document:changed');
    }
  }
}

export class SetLayerPropertyCommand {
  constructor(document, layerId, property, newValue, explicitOldValue = undefined) {
    this.document = document;
    this.layerId = layerId;
    this.property = property;
    this.newValue = newValue;
    const layer = document.layers.find(l => l.id === layerId);
    this.oldValue = explicitOldValue !== undefined ? explicitOldValue : (layer ? layer[property] : null);
  }

  execute() {
    this.document.setLayerProperty(this.layerId, this.property, this.newValue);
  }

  undo() {
    this.document.setLayerProperty(this.layerId, this.property, this.oldValue);
  }
}


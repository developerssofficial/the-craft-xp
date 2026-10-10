/**
 * The Craft — Animation Frame Layers UI
 * Manages layer stack for the active frame: Add, Rename, Toggle Visibility,
 * Lock, Opacity Slider, Blend Modes, Reorder, and Delete Layer.
 */
import { events } from '../core/EventBus.js';

export class AnimationLayersUI {
  constructor(container, project, onLayerStateChanged) {
    this.container = container;
    this.project = project;
    this.onLayerStateChanged = onLayerStateChanged;

    this.draggedLayerIndex = null;
  }

  render() {
    if (!this.container) return;
    const currentFrame = this.project.getCurrentFrame();
    if (!currentFrame) {
      this.container.innerHTML = '<div class="no-layers">No active frame</div>';
      return;
    }

    const layers = currentFrame.layers;
    const activeLayerId = currentFrame.activeLayerId;
    const activeLayer = currentFrame.getActiveLayer();

    this.container.innerHTML = `
      <div class="layers-panel-header">
        <div class="panel-title-wrap">
          <span class="panel-title">Frame Layers</span>
          <span class="badge" id="frameLayerCountBadge">${layers.length}</span>
        </div>
        <button id="addFrameLayerBtn" class="btn primary-btn btn-sm" title="Add Layer to current frame">
          <i class="fa-solid fa-plus"></i>
          <span>Add Layer</span>
        </button>
      </div>

      <!-- Active Layer Properties -->
      ${activeLayer ? `
        <div class="active-layer-settings">
          <div class="prop-row">
            <span class="prop-label">Opacity: <strong id="layerOpacityVal">${Math.round((activeLayer.opacity ?? 1.0) * 100)}%</strong></span>
            <input type="range" id="frameLayerOpacitySlider" min="0" max="100" value="${Math.round((activeLayer.opacity ?? 1.0) * 100)}">
          </div>
          <div class="prop-row">
            <span class="prop-label">Blend:</span>
            <select id="frameLayerBlendSelect">
              <option value="source-over" ${activeLayer.blendMode === 'source-over' ? 'selected' : ''}>Normal</option>
              <option value="multiply" ${activeLayer.blendMode === 'multiply' ? 'selected' : ''}>Multiply</option>
              <option value="screen" ${activeLayer.blendMode === 'screen' ? 'selected' : ''}>Screen</option>
              <option value="overlay" ${activeLayer.blendMode === 'overlay' ? 'selected' : ''}>Overlay</option>
              <option value="difference" ${activeLayer.blendMode === 'difference' ? 'selected' : ''}>Difference</option>
            </select>
          </div>
        </div>
      ` : ''}

      <!-- Layer Cards Stack (Rendered Top to Bottom) -->
      <div class="layers-list" id="frameLayersList"></div>
    `;

    // Bind Add Layer
    const addBtn = this.container.querySelector('#addFrameLayerBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const newLayer = currentFrame.addLayer();
        this.render();
        this.notifyChange(`Added ${newLayer.name}`);
      });
    }

    // Bind Opacity & Blend
    const opacitySlider = this.container.querySelector('#frameLayerOpacitySlider');
    const opacityVal = this.container.querySelector('#layerOpacityVal');
    if (opacitySlider && activeLayer) {
      opacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) / 100;
        activeLayer.opacity = val;
        if (opacityVal) opacityVal.textContent = `${Math.round(val * 100)}%`;
        this.notifyChange();
      });
    }

    const blendSelect = this.container.querySelector('#frameLayerBlendSelect');
    if (blendSelect && activeLayer) {
      blendSelect.addEventListener('change', (e) => {
        activeLayer.blendMode = e.target.value;
        this.notifyChange();
      });
    }

    // Render Layer Items (top of stack is highest index)
    const listEl = this.container.querySelector('#frameLayersList');
    if (!listEl) return;

    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const isActive = layer.id === activeLayerId;

      const card = document.createElement('div');
      card.className = `layer-item-card ${isActive ? 'active' : ''}`;
      card.draggable = true;
      card.dataset.index = i;

      card.innerHTML = `
        <div class="layer-item-left">
          <button class="layer-action-icon toggle-vis" title="Toggle visibility">
            <i class="fa-solid ${layer.visible ? 'fa-eye' : 'fa-eye-slash text-muted'}"></i>
          </button>
          <button class="layer-action-icon toggle-lock" title="Toggle lock">
            <i class="fa-solid ${layer.locked ? 'fa-lock' : 'fa-lock-open text-muted'}"></i>
          </button>
          <span class="layer-name-label" title="Double click to rename">${layer.name}</span>
        </div>

        <div class="layer-item-right">
          <button class="layer-action-icon move-up" title="Move Up" ${i === layers.length - 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-up"></i>
          </button>
          <button class="layer-action-icon move-down" title="Move Down" ${i === 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <button class="layer-action-icon duplicate-layer" title="Duplicate Layer">
            <i class="fa-regular fa-copy"></i>
          </button>
          ${layers.length > 1 ? `
            <button class="layer-action-icon delete-layer danger" title="Delete Layer">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
      `;

      // Select Layer
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        currentFrame.setActiveLayer(layer.id);
        this.render();
        this.notifyChange();
      });

      // Double-click to rename
      const nameLabel = card.querySelector('.layer-name-label');
      nameLabel.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'layer-rename-input';
        input.value = layer.name;
        nameLabel.replaceWith(input);
        input.focus();
        input.select();

        const saveName = () => {
          const val = input.value.trim();
          if (val) layer.name = val;
          this.render();
          this.notifyChange();
        };

        input.addEventListener('blur', saveName);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') saveName();
          if (ke.key === 'Escape') this.render();
        });
      });

      // Visibility
      card.querySelector('.toggle-vis').addEventListener('click', () => {
        layer.visible = !layer.visible;
        this.render();
        this.notifyChange();
      });

      // Lock
      card.querySelector('.toggle-lock').addEventListener('click', () => {
        layer.locked = !layer.locked;
        this.render();
        this.notifyChange();
      });

      // Move Up
      card.querySelector('.move-up')?.addEventListener('click', () => {
        if (i < layers.length - 1) {
          currentFrame.reorderLayers(i, i + 1);
          this.render();
          this.notifyChange();
        }
      });

      // Move Down
      card.querySelector('.move-down')?.addEventListener('click', () => {
        if (i > 0) {
          currentFrame.reorderLayers(i, i - 1);
          this.render();
          this.notifyChange();
        }
      });

      // Duplicate Layer
      card.querySelector('.duplicate-layer')?.addEventListener('click', () => {
        const dup = currentFrame.duplicateLayer(layer.id);
        if (dup) {
          this.render();
          this.notifyChange(`Duplicated to ${dup.name}`);
        }
      });

      // Delete Layer
      card.querySelector('.delete-layer')?.addEventListener('click', () => {
        if (layers.length <= 1) return;
        if (confirm(`Delete "${layer.name}"?`)) {
          currentFrame.removeLayer(layer.id);
          this.render();
          this.notifyChange(`Deleted ${layer.name}`);
        }
      });

      // Drag and drop reorder
      card.addEventListener('dragstart', (e) => {
        this.draggedLayerIndex = i;
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.draggedLayerIndex = null;
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        if (this.draggedLayerIndex !== null && this.draggedLayerIndex !== i) {
          currentFrame.reorderLayers(this.draggedLayerIndex, i);
          this.render();
          this.notifyChange();
        }
      });

      listEl.appendChild(card);
    }
  }

  notifyChange(toastMsg = null) {
    if (this.onLayerStateChanged) {
      this.onLayerStateChanged();
    }
    if (toastMsg) {
      events.emit('toast', { message: toastMsg });
    }
  }
}

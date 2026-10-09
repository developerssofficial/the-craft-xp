/**
 * The Craft — Layers Panel UI
 * Professional Photoshop/Figma-style layer stack manager.
 * Supports add, delete, duplicate, drag-and-drop reorder, rename, show/hide,
 * lock, opacity, blend modes, and merge down with full undo/redo.
 */
import { events } from '../core/EventBus.js';
import {
  AddLayerCommand,
  DeleteLayerCommand,
  DuplicateLayerCommand,
  ReorderLayerCommand,
  MergeDownCommand,
  SetLayerPropertyCommand
} from '../core/commands/LayerCommands.js';

export class LayersPanel {
  constructor(containerEl, doc, renderer, commandManager) {
    this.container = containerEl;
    this.doc = doc;
    this.renderer = renderer;
    this.commandManager = commandManager;

    this.draggedLayerIndex = null;

    this.init();
    this.setupEventListeners();
  }

  init() {
    this.render();
  }

  setupEventListeners() {
    events.on('document:changed', () => this.render());
    events.on('layer:activated', () => this.render());
    events.on('layer:added', () => this.render());
    events.on('layer:removed', () => this.render());
    events.on('layer:updated', () => this.render());
  }

  render() {
    if (!this.container) return;

    const activeLayer = this.doc.getActiveLayer();
    const activeOpacityPct = Math.round((activeLayer.opacity ?? 1.0) * 100);

    const blendModes = [
      { id: 'source-over', label: 'Normal' },
      { id: 'multiply', label: 'Multiply' },
      { id: 'screen', label: 'Screen' },
      { id: 'overlay', label: 'Overlay' },
      { id: 'darken', label: 'Darken' },
      { id: 'lighten', label: 'Lighten' },
      { id: 'color-dodge', label: 'Color Dodge' },
      { id: 'color-burn', label: 'Color Burn' },
      { id: 'hard-light', label: 'Hard Light' },
      { id: 'soft-light', label: 'Soft Light' },
      { id: 'difference', label: 'Difference' },
      { id: 'exclusion', label: 'Exclusion' },
      { id: 'hue', label: 'Hue' },
      { id: 'saturation', label: 'Saturation' },
      { id: 'color', label: 'Color' },
      { id: 'luminosity', label: 'Luminosity' }
    ];

    this.container.innerHTML = `
      <!-- Layer Properties Top Bar -->
      <div class="layer-control-bar">
        <div class="layer-blend-wrapper">
          <label class="layer-field-label">Blend Mode</label>
          <select id="layerBlendSelect" class="layer-select" title="Layer Blend Mode">
            ${blendModes.map(bm => `
              <option value="${bm.id}" ${activeLayer.blendMode === bm.id ? 'selected' : ''}>${bm.label}</option>
            `).join('')}
          </select>
        </div>

        <div class="layer-opacity-wrapper">
          <div class="opacity-head">
            <label class="layer-field-label">Opacity</label>
            <span id="layerOpacityVal" class="layer-val-badge">${activeOpacityPct}%</span>
          </div>
          <input type="range" id="layerOpacitySlider" min="0" max="100" value="${activeOpacityPct}" class="glow-slider layer-slider">
        </div>
      </div>

      <!-- Scrollable Layer Items Stack (Top of stack = Top of canvas) -->
      <div class="layers-stack" id="layersStack">
        ${this.renderLayerCardsHtml()}
      </div>

      <!-- Bottom Action Bar -->
      <div class="layers-footer">
        <button id="addLayerBtn" class="layer-footer-btn" title="Create New Layer">
          <i class="fa-solid fa-plus"></i>
          <span>New</span>
        </button>
        <button id="dupLayerBtn" class="layer-footer-btn" title="Duplicate Layer">
          <i class="fa-solid fa-clone"></i>
          <span>Duplicate</span>
        </button>
        <button id="mergeLayerBtn" class="layer-footer-btn" title="Merge Down">
          <i class="fa-solid fa-layer-group"></i>
          <span>Merge</span>
        </button>
        <button id="delLayerBtn" class="layer-footer-btn danger-hover" title="Delete Layer" ${this.doc.layers.length <= 1 ? 'disabled' : ''}>
          <i class="fa-regular fa-trash-can"></i>
          <span>Delete</span>
        </button>
      </div>
    `;

    this.bindDomEvents();
  }

  renderLayerCardsHtml() {
    // Canvas renders layers bottom to top (index 0 to length-1).
    // In UI, the top-most layer is displayed at the top of the list.
    const reversedIndices = this.doc.layers.map((_, i) => i).reverse();

    return reversedIndices.map(docIdx => {
      const layer = this.doc.layers[docIdx];
      const isActive = layer.id === this.doc.activeLayerId;
      const thumb = this.renderer.getLayerThumbnail(layer);

      return `
        <div class="layer-card ${isActive ? 'active' : ''} ${layer.locked ? 'locked' : ''} ${!layer.visible ? 'hidden-layer' : ''}"
             data-layer-id="${layer.id}"
             data-doc-index="${docIdx}"
             draggable="true">
          
          <div class="layer-drag-handle" title="Drag to reorder">
            <i class="fa-solid fa-grip-vertical"></i>
          </div>

          <button class="layer-toggle-btn toggle-visibility" data-layer-id="${layer.id}" title="${layer.visible ? 'Hide layer' : 'Show layer'}">
            <i class="fa-regular ${layer.visible ? 'fa-eye' : 'fa-eye-slash text-muted'}"></i>
          </button>

          <div class="layer-thumb-preview">
            <img src="${thumb}" alt="thumb" />
          </div>

          <div class="layer-name-wrap" title="Double click to rename">
            <span class="layer-name-text">${this.escapeHtml(layer.name)}</span>
            <input type="text" class="layer-rename-input hidden" value="${this.escapeHtml(layer.name)}" />
          </div>

          <button class="layer-toggle-btn toggle-lock" data-layer-id="${layer.id}" title="${layer.locked ? 'Unlock layer' : 'Lock layer'}">
            <i class="fa-solid ${layer.locked ? 'fa-lock text-accent' : 'fa-lock-open text-muted'}"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  bindDomEvents() {
    const activeLayer = this.doc.getActiveLayer();

    // 1. Blend Mode Select
    const blendSelect = this.container.querySelector('#layerBlendSelect');
    if (blendSelect) {
      let initialBlend = activeLayer.blendMode;
      blendSelect.addEventListener('focus', () => {
        initialBlend = activeLayer.blendMode;
      });
      blendSelect.addEventListener('change', (e) => {
        this.commandManager.execute(
          new SetLayerPropertyCommand(this.doc, activeLayer.id, 'blendMode', e.target.value, initialBlend)
        );
        initialBlend = e.target.value;
      });
    }

    // 2. Opacity Slider
    const opacitySlider = this.container.querySelector('#layerOpacitySlider');
    const opacityVal = this.container.querySelector('#layerOpacityVal');
    if (opacitySlider) {
      let dragStartOpacity = activeLayer.opacity;

      const recordStart = () => {
        dragStartOpacity = activeLayer.opacity;
      };

      opacitySlider.addEventListener('pointerdown', recordStart);
      opacitySlider.addEventListener('mousedown', recordStart);
      opacitySlider.addEventListener('focus', recordStart);

      opacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        opacityVal.textContent = `${val}%`;
        activeLayer.opacity = val / 100;
        this.renderer.render();
      });

      opacitySlider.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10) / 100;
        const oldVal = dragStartOpacity !== null ? dragStartOpacity : activeLayer.opacity;
        this.commandManager.execute(
          new SetLayerPropertyCommand(this.doc, activeLayer.id, 'opacity', val, oldVal)
        );
        dragStartOpacity = val;
      });
    }

    // 3. Bottom Action Buttons
    const addBtn = this.container.querySelector('#addLayerBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.commandManager.execute(new AddLayerCommand(this.doc));
        events.emit('toast', { message: 'New Layer Created' });
      });
    }

    const dupBtn = this.container.querySelector('#dupLayerBtn');
    if (dupBtn) {
      dupBtn.addEventListener('click', () => {
        this.commandManager.execute(new DuplicateLayerCommand(this.doc, activeLayer.id));
        events.emit('toast', { message: 'Layer Duplicated' });
      });
    }

    const mergeBtn = this.container.querySelector('#mergeLayerBtn');
    if (mergeBtn) {
      mergeBtn.addEventListener('click', () => {
        const idx = this.doc.layers.findIndex(l => l.id === activeLayer.id);
        if (idx <= 0) {
          events.emit('toast', { message: 'Cannot merge bottom-most layer', type: 'warning' });
          return;
        }
        this.commandManager.execute(new MergeDownCommand(this.doc, activeLayer.id));
        events.emit('toast', { message: 'Merged Down' });
      });
    }

    const delBtn = this.container.querySelector('#delLayerBtn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (this.doc.layers.length <= 1) {
          events.emit('toast', { message: 'Cannot delete the only layer', type: 'warning' });
          return;
        }
        this.commandManager.execute(new DeleteLayerCommand(this.doc, activeLayer.id));
        events.emit('toast', { message: 'Layer Deleted' });
      });
    }

    // 4. Layer Card Item Interactions
    const layerCards = this.container.querySelectorAll('.layer-card');
    layerCards.forEach(card => {
      const layerId = card.dataset.layerId;
      const docIndex = parseInt(card.dataset.docIndex, 10);

      // Select Layer
      card.addEventListener('click', (e) => {
        if (e.target.closest('.layer-toggle-btn') || e.target.closest('.layer-rename-input')) return;
        this.doc.setActiveLayer(layerId);
      });

      // Toggle Visibility
      const visBtn = card.querySelector('.toggle-visibility');
      if (visBtn) {
        visBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const layer = this.doc.layers.find(l => l.id === layerId);
          if (layer) {
            this.commandManager.execute(
              new SetLayerPropertyCommand(this.doc, layerId, 'visible', !layer.visible)
            );
          }
        });
      }

      // Toggle Lock
      const lockBtn = card.querySelector('.toggle-lock');
      if (lockBtn) {
        lockBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const layer = this.doc.layers.find(l => l.id === layerId);
          if (layer) {
            this.commandManager.execute(
              new SetLayerPropertyCommand(this.doc, layerId, 'locked', !layer.locked)
            );
          }
        });
      }

      // Inline Rename (Double-Click)
      const nameWrap = card.querySelector('.layer-name-wrap');
      const nameText = card.querySelector('.layer-name-text');
      const renameInput = card.querySelector('.layer-rename-input');

      if (nameWrap && nameText && renameInput) {
        nameWrap.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          nameText.classList.add('hidden');
          renameInput.classList.remove('hidden');
          renameInput.focus();
          renameInput.select();
        });

        const commitRename = () => {
          const newName = renameInput.value.trim();
          if (newName && newName !== nameText.textContent) {
            this.commandManager.execute(
              new SetLayerPropertyCommand(this.doc, layerId, 'name', newName)
            );
          } else {
            renameInput.classList.add('hidden');
            nameText.classList.remove('hidden');
          }
        };

        renameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            commitRename();
          } else if (e.key === 'Escape') {
            renameInput.classList.add('hidden');
            nameText.classList.remove('hidden');
          }
        });

        renameInput.addEventListener('blur', commitRename);
      }

      // 5. Drag and Drop Reordering
      card.addEventListener('dragstart', (e) => {
        this.draggedLayerIndex = docIndex;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.draggedLayerIndex = null;
        this.container.querySelectorAll('.layer-card').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (this.draggedLayerIndex === null || this.draggedLayerIndex === docIndex) return;

        this.commandManager.execute(
          new ReorderLayerCommand(this.doc, this.draggedLayerIndex, docIndex)
        );
        events.emit('toast', { message: 'Layer Reordered' });
      });
    });
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
}

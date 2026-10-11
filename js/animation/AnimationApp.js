/**
 * The Craft — Animation Studio Orchestrator
 * Bootstraps the Animation Workspace, Canvas Stage, Timeline, Onion Skinning,
 * Multi-layer per Frame, Exporter, and Autosave Persistence.
 */
import { events } from '../core/EventBus.js';
import { Document } from '../core/Document.js';
import { CommandManager } from '../core/CommandManager.js';
import { CanvasRenderer } from '../renderer/CanvasRenderer.js';
import { Viewport } from '../renderer/Viewport.js';
import { ToolManager } from '../tools/ToolManager.js';
import { ToolDockUI } from '../ui/ToolDockUI.js';
import { PropertiesPanelUI } from '../ui/PropertiesPanelUI.js';
import { AnimationProject, AnimationFrame } from './AnimationModel.js';
import { AnimationStorage } from './AnimationStorage.js';
import { OnionSkinRenderer } from './OnionSkinRenderer.js';
import { TimelineUI } from './TimelineUI.js';
import { AnimationLayersUI } from './AnimationLayersUI.js';
import { AnimationExporter } from './AnimationExporter.js';

export class AnimationApp {
  constructor() {
    this.project = new AnimationProject({
      width: 1280,
      height: 720,
      backgroundColor: '#ffffff',
      fps: 12
    });

    this.doc = null;
    this.renderer = null;
    this.viewportModel = null;
    this.commandManager = null;
    this.toolManager = null;
    this.onionSkinRenderer = null;
    this.timelineUI = null;
    this.layersUI = null;
    this.exporter = null;
    this.storage = null;
    this.activeFrameIndex = 0;

    this.isRestoring = false;
  }

  async init() {
    // 1. DOM Canvas Elements
    const viewport = document.getElementById('canvasStage');
    const canvasBoard = document.getElementById('canvasBoard');
    const onionCanvas = document.getElementById('onionCanvas');
    const paintCanvas = document.getElementById('paintCanvas');
    const previewCanvas = document.getElementById('previewCanvas');
    const gridCanvas = document.getElementById('gridCanvas');
    const cursorCanvas = document.getElementById('cursorCanvas');
    const inlineTextInput = document.getElementById('inlineCanvasTextInput');
    const symmetryGuide = document.getElementById('symmetryGuide');
    const zoomLevelDisplay = document.getElementById('zoomLevel');

    // 2. Instantiate Exporter and Storage
    this.exporter = new AnimationExporter(this.project);
    this.storage = new AnimationStorage(this.project);

    const saveBadge = document.getElementById('saveStatusBadge');
    if (saveBadge) {
      this.storage.setStatusBadgeElement(saveBadge);
    }

    // Try restoring saved animation project from IndexedDB
    try {
      this.isRestoring = true;
      const savedProject = await this.storage.loadSession();
      if (savedProject && savedProject.frames && savedProject.frames.length > 0) {
        // Migrate old dark default background (#0f1117) to pure white (#ffffff)
        if (savedProject.backgroundColor === '#0f1117' || !savedProject.backgroundColor) {
          savedProject.backgroundColor = '#ffffff';
        }
        this.project = savedProject;
        this.exporter.project = this.project;
        this.storage.project = this.project;
        console.log(`[AnimationStudio] Restored autosaved project with ${this.project.frames.length} frames.`);
      }
    } catch (e) {
      console.warn('[AnimationStudio] Failed to restore session:', e);
    } finally {
      this.isRestoring = false;
    }

    // 3. Setup Initial Frame Document
    this.activeFrameIndex = this.project.currentFrameIndex || 0;
    const currentFrame = this.project.getCurrentFrame();
    this.doc = new Document({
      width: this.project.width,
      height: this.project.height,
      backgroundColor: 'transparent',
      layers: currentFrame.layers,
      activeLayerId: currentFrame.activeLayerId
    });

    this.commandManager = new CommandManager(50);

    this.renderer = new CanvasRenderer(
      { paintCanvas, previewCanvas, gridCanvas, cursorCanvas },
      this.doc
    );
    this.renderer.resize(this.project.width, this.project.height);
    this.exporter.renderer = this.renderer;

    this.viewportModel = new Viewport(
      { viewport, canvasBoard, symmetryGuide, zoomLevelDisplay },
      this.doc,
      this.renderer,
      { autoResize: false }
    );

    // Onion Skin Renderer
    this.onionSkinRenderer = new OnionSkinRenderer(onionCanvas, this.project, this.renderer);
    this.onionSkinRenderer.resize(this.project.width, this.project.height);

    // Canvas Background Preset & Custom Color Selector
    const animBgPreset = document.getElementById('animBgPreset');
    const animBgCustomPicker = document.getElementById('animBgCustomPicker');

    if (animBgPreset) {
      animBgPreset.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'custom') {
          animBgCustomPicker?.click();
        } else {
          this.applyCanvasBackground(val, true);
        }
      });
    }

    if (animBgCustomPicker) {
      animBgCustomPicker.addEventListener('input', (e) => {
        this.applyCanvasBackground(e.target.value, false);
      });
      animBgCustomPicker.addEventListener('change', (e) => {
        this.applyCanvasBackground(e.target.value, true);
      });
    }

    this.applyCanvasBackground(this.project.backgroundColor || '#ffffff', false);

    // 4. App Context for Tools
    const appContext = {
      viewport,
      canvasBoard,
      paintCanvas,
      previewCanvas,
      inlineTextInput,
      doc: this.doc,
      renderer: this.renderer,
      commandManager: this.commandManager,
      viewportModel: this.viewportModel
    };

    this.toolManager = new ToolManager(appContext);

    // 5. UI Sidebars & Docks
    const toolButtons = document.querySelectorAll('.tool-item');
    const quickButtons = document.querySelectorAll('.quick-btn');
    const quickDots = document.querySelectorAll('.quick-dot');

    const toolDockUI = new ToolDockUI(
      {
        toolDock: document.getElementById('toolDock'),
        toggleLeftDockBtn: document.getElementById('toggleLeftDockBtn'),
        collapseDockBtn: document.getElementById('collapseDockBtn'),
        leftEdgeTrigger: document.getElementById('leftEdgeTrigger'),
        toolButtons,
        quickButtons
      },
      this.toolManager
    );

    const propertiesPanelUI = new PropertiesPanelUI(
      {
        propertiesPanel: document.getElementById('propertiesPanel'),
        toggleRightPanelBtn: document.getElementById('toggleRightPanelBtn'),
        collapsePanelBtn: document.getElementById('collapsePanelBtn'),
        rightEdgeTrigger: document.getElementById('rightEdgeTrigger'),
        brushSizeSlider: document.getElementById('brushSize'),
        brushOpacitySlider: document.getElementById('brushOpacity'),
        pressureDynamicsCheck: document.getElementById('pressureDynamicsCheck'),
        sizeBadge: document.getElementById('sizeBadge'),
        opacityBadge: document.getElementById('opacityBadge'),
        pillButtons: document.querySelectorAll('.pill-btn'),
        swatchButtons: document.querySelectorAll('.swatch-btn'),
        nativeColorPicker: document.getElementById('nativeColorPicker'),
        bottomColorPicker: document.getElementById('bottomColorPicker'),
        headerColorPicker: document.getElementById('headerColorPicker'),
        headerColorIndicator: document.getElementById('headerColorIndicator'),
        activeColorSwatch: document.getElementById('activeColorSwatch'),
        hexCodeBadge: document.getElementById('hexCodeBadge'),
        brushDotPreview: document.getElementById('brushDotPreview'),
        shapeFillCheck: document.getElementById('shapeFillCheck'),
        shapeConfig: document.getElementById('shapeConfig'),
        stampConfig: document.getElementById('stampConfig'),
        stampChoices: document.querySelectorAll('.stamp-choice'),
        quickDots
      },
      this.toolManager
    );

    // 6. Frame Layers Panel UI
    const layersContainer = document.getElementById('frameLayersPanelContainer');
    this.layersUI = new AnimationLayersUI(layersContainer, this.project, () => {
      this.syncActiveFrameToDoc();
      this.renderer.render();
      this.timelineUI.updateActiveThumbnail();
      this.onionSkinRenderer.render(this.project.currentFrameIndex, this.timelineUI.isPlaying);
      this.storage.scheduleAutosave();
    });
    this.layersUI.render();

    // 7. Timeline UI Component
    const timelineContainer = document.getElementById('timelineContainer');
    this.timelineUI = new TimelineUI(timelineContainer, this.project, this.exporter, {
      onSelectFrame: (idx) => this.switchFrame(idx),
      onAddBlankFrame: () => this.addNewBlankFrame(),
      onDuplicateFrame: (idx) => this.duplicateFrame(idx),
      onDeleteFrame: (idx) => this.deleteFrame(idx),
      onCopyFrame: () => this.copyCurrentFrame(),
      onPasteFrame: () => this.pasteFrame(),
      onMoveFrame: (from, to) => this.moveFrame(from, to),
      onFrameChanged: () => {
        this.syncDocToFrame();
        this.layersUI.render();
        this.onionSkinRenderer.render(this.activeFrameIndex, this.timelineUI.isPlaying);
        this.storage.scheduleAutosave();
      },
      onPlaybackStateChange: (isPlaying) => {
        if (isPlaying) {
          this.saveActiveFrame();
          this.onionSkinRenderer.clear();
        } else {
          this.onionSkinRenderer.render(this.activeFrameIndex, false);
          this.layersUI.render();
        }
      },
      onToggleOnionSkin: () => {
        this.onionSkinRenderer.enabled = !this.onionSkinRenderer.enabled;
        if (this.onionSkinRenderer.enabled) {
          this.onionSkinRenderer.render(this.activeFrameIndex, this.timelineUI.isPlaying);
        } else {
          this.onionSkinRenderer.clear();
        }
        events.emit('toast', { message: `Onion Skin: ${this.onionSkinRenderer.enabled ? 'ON' : 'OFF'}` });
        return this.onionSkinRenderer.enabled;
      }
    });

    // 8. Pointer Events for Drawing
    const isInsideCanvas = (e) => {
      const rect = paintCanvas.getBoundingClientRect();
      return e.clientX >= rect.left && e.clientX <= rect.right &&
             e.clientY >= rect.top && e.clientY <= rect.bottom;
    };

    viewport.addEventListener('pointerdown', (e) => {
      if (this.timelineUI.isPlaying) this.timelineUI.pause();
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (!isInsideCanvas(e)) return;
      this.toolManager.handlePointerDown(e);
    });

    window.addEventListener('pointermove', (e) => {
      this.toolManager.handlePointerMove(e);
    });

    window.addEventListener('pointerup', (e) => {
      this.toolManager.handlePointerUp(e);
    });

    window.addEventListener('pointercancel', (e) => {
      this.toolManager.handlePointerUp(e);
    });

    viewport.addEventListener('pointerleave', (e) => {
      this.toolManager.handlePointerLeave(e);
    });

    // 9. Document Changed Events (Strokes committed)
    events.on('document:changed', () => {
      this.renderer.render();
      if (!this.isRestoring) {
        this.timelineUI.updateThumbnail(this.activeFrameIndex);
        this.onionSkinRenderer.render(this.activeFrameIndex, this.timelineUI.isPlaying);
        this.storage.scheduleAutosave();
      }
    });

    // 10. Undo / Redo
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.addEventListener('click', () => this.commandManager.undo());
    if (redoBtn) redoBtn.addEventListener('click', () => this.commandManager.redo());

    events.on('history:changed', ({ canUndo, canRedo }) => {
      if (undoBtn) undoBtn.disabled = !canUndo;
      if (redoBtn) redoBtn.disabled = !canRedo;
    });

    // Clear Active Layer on Frame
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const activeLayer = this.doc.getActiveLayer();
        if (!activeLayer) return;
        if (confirm(`Clear contents of "${activeLayer.name}" on current frame?`)) {
          activeLayer.clear();
          this.renderer.render();
          this.timelineUI.updateThumbnail(this.activeFrameIndex);
          this.onionSkinRenderer.render(this.activeFrameIndex, false);
          this.storage.scheduleAutosave();
          events.emit('toast', { message: `Cleared ${activeLayer.name}` });
        }
      });
    }

    // Zoom and Canvas View Controls
    document.getElementById('zoomInBtn')?.addEventListener('click', () => this.viewportModel.zoomIn());
    document.getElementById('zoomOutBtn')?.addEventListener('click', () => this.viewportModel.zoomOut());
    document.getElementById('zoomResetBtn')?.addEventListener('click', () => this.viewportModel.resetZoom());

    const gridToggleBtn = document.getElementById('gridToggleBtn');
    if (gridToggleBtn) {
      gridToggleBtn.addEventListener('click', () => {
        const active = this.viewportModel.toggleGrid();
        gridToggleBtn.classList.toggle('active', active);
      });
    }

    const zenModeBtn = document.getElementById('zenModeBtn');
    if (zenModeBtn) {
      zenModeBtn.addEventListener('click', () => {
        const active = this.viewportModel.toggleZenMode();
        zenModeBtn.classList.toggle('active', active);
      });
    }

    // Setup Modals & Action Menus
    this.initExportModal();
    this.initProjectSettingsModal();
    this.initImageImport();
    this.initProjectFileMenu();
    this.initShortcuts();
    this.initOnionSkinPanel();

    // Initial render
    this.renderer.render();
    this.onionSkinRenderer.render(this.activeFrameIndex, false);
    this.storage.updateStatusBadge('saved');
  }

  applyCanvasBackground(newBg, showToast = true) {
    this.project.backgroundColor = newBg;
    this.doc.backgroundColor = 'transparent';

    const canvasBoard = document.getElementById('canvasBoard');
    const animBgSwatchDot = document.getElementById('animBgSwatchDot');
    const animBgPreset = document.getElementById('animBgPreset');
    const animBgCustomPicker = document.getElementById('animBgCustomPicker');
    const settingsBgPreset = document.getElementById('settingsBgPreset');

    if (newBg === 'transparent') {
      canvasBoard?.classList.add('transparent-canvas');
      if (canvasBoard) canvasBoard.style.backgroundColor = 'transparent';
      if (animBgSwatchDot) {
        animBgSwatchDot.classList.add('checkerboard');
        animBgSwatchDot.style.backgroundColor = '';
      }
    } else {
      canvasBoard?.classList.remove('transparent-canvas');
      if (canvasBoard) {
        canvasBoard.style.backgroundColor = newBg;
        canvasBoard.style.backgroundImage = 'none';
      }
      if (animBgSwatchDot) {
        animBgSwatchDot.classList.remove('checkerboard');
        animBgSwatchDot.style.backgroundColor = newBg;
      }
    }

    if (animBgPreset) {
      let matched = false;
      for (const opt of animBgPreset.options) {
        if (opt.value === newBg) {
          animBgPreset.value = newBg;
          matched = true;
          break;
        }
      }
      if (!matched && newBg !== 'transparent') {
        let customOpt = animBgPreset.querySelector('option[data-custom="true"]');
        if (!customOpt) {
          customOpt = document.createElement('option');
          customOpt.dataset.custom = "true";
          animBgPreset.appendChild(customOpt);
        }
        customOpt.value = newBg;
        customOpt.textContent = `Custom (${newBg.toUpperCase()})`;
        animBgPreset.value = newBg;
      }
    }

    if (settingsBgPreset) {
      settingsBgPreset.value = newBg;
    }

    if (animBgCustomPicker && newBg !== 'transparent' && newBg.startsWith('#')) {
      animBgCustomPicker.value = newBg;
    }

    this.renderer.render();
    this.onionSkinRenderer.render(this.project.currentFrameIndex, this.timelineUI?.isPlaying || false);
    this.timelineUI?.updateActiveThumbnail();
    this.storage.scheduleAutosave();

    // Auto-contrast brush protection for animation
    const isDark = (hex) => {
      if (!hex || hex === 'transparent') return false;
      let c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map(x => x + x).join('');
      if (c.length !== 6) return false;
      const r = parseInt(c.substr(0, 2), 16);
      const g = parseInt(c.substr(2, 2), 16);
      const b = parseInt(c.substr(4, 2), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 < 128;
    };

    const activeColor = this.toolManager?.toolState?.color;
    if (isDark(newBg)) {
      if (isDark(activeColor)) {
        events.emit('color:selected', { color: '#ffffff' });
        events.emit('toast', { message: 'Switched brush to White for contrast against dark background' });
      }
    } else if (newBg !== 'transparent') {
      if (activeColor === '#ffffff' || activeColor?.toLowerCase() === '#fff') {
        events.emit('color:selected', { color: '#18181b' });
        events.emit('toast', { message: 'Switched brush to Charcoal for contrast against light background' });
      }
    }

    if (showToast) {
      const label = newBg === 'transparent' ? 'Transparent (PNG)' : newBg.toUpperCase();
      events.emit('toast', { message: `Canvas Background: ${label}` });
    }
  }

  // ==========================================
  // Frame Management & Switching Engine
  // ==========================================
  saveActiveFrame() {
    if (this.activeFrameIndex < 0 || this.activeFrameIndex >= this.project.frames.length) return;
    const curFrame = this.project.frames[this.activeFrameIndex];
    if (curFrame) {
      curFrame.layers = this.doc.layers;
      curFrame.activeLayerId = this.doc.activeLayerId;
      this.timelineUI?.updateThumbnail(this.activeFrameIndex);
    }
  }

  switchFrame(newIndex) {
    if (newIndex < 0 || newIndex >= this.project.frames.length) return;

    const isPlaying = this.timelineUI?.isPlaying || false;

    // 1. Sync outgoing frame from doc unless already saved, deleted, or in playback
    if (!isPlaying && this.activeFrameIndex >= 0 && this.activeFrameIndex < this.project.frames.length && this.activeFrameIndex !== newIndex) {
      this.saveActiveFrame();
    }

    // 2. Switch active frame index & project pointer
    this.activeFrameIndex = newIndex;
    this.project.setCurrentFrame(newIndex);
    const nextFrame = this.project.frames[newIndex];
    if (!nextFrame) return;

    // 3. Load next frame's layers into Doc
    this.doc.layers = nextFrame.layers;
    this.doc.activeLayerId = nextFrame.activeLayerId || nextFrame.layers[0]?.id;

    // 4. Update command history (clear undo/redo stack for fresh frame action)
    if (!isPlaying) {
      this.commandManager.clear();
    }

    // 5. Render Canvas & Layers UI & Onion Skin
    this.renderer.render();
    if (!isPlaying) {
      this.layersUI.render();
      this.onionSkinRenderer.render(newIndex, false);
    }

    // 6. Update timeline indicator and highlight
    this.timelineUI?.updateActiveCardHighlight();
    this.timelineUI?.updateFrameIndicator();
  }

  addNewBlankFrame(insertIndex = null) {
    // 1. Save active frame first (so Frame 1's drawing is stored and ready for onion skin ghosting)
    this.saveActiveFrame();

    // 2. Add brand new blank frame into project (contains its own blank Layer 1)
    const newFrame = this.project.addFrame(insertIndex);

    // 3. Re-render timeline cards
    this.timelineUI.render();

    // 4. Switch to newly added blank frame
    this.switchFrame(this.project.currentFrameIndex);

    // 5. User feedback & autosave
    events.emit('toast', { message: `Added ${newFrame.name}` });
    this.storage.scheduleAutosave();
  }

  duplicateFrame(targetIndex = null) {
    const idx = targetIndex !== null ? targetIndex : this.activeFrameIndex;
    if (idx < 0 || idx >= this.project.frames.length) return;

    this.saveActiveFrame();
    const cloned = this.project.duplicateFrame(idx);
    if (cloned) {
      this.timelineUI.render();
      this.switchFrame(this.project.currentFrameIndex);
      events.emit('toast', { message: `Duplicated to ${cloned.name}` });
      this.storage.scheduleAutosave();
    }
  }

  deleteFrame(targetIndex = null) {
    if (this.project.frames.length <= 1) {
      events.emit('toast', { message: 'Cannot delete the only frame in the animation', type: 'warning' });
      return;
    }

    const idx = targetIndex !== null ? targetIndex : this.activeFrameIndex;
    if (idx < 0 || idx >= this.project.frames.length) return;

    const frame = this.project.frames[idx];
    if (!confirm(`Are you sure you want to delete "${frame.name}"? This cannot be undone.`)) {
      return;
    }

    this.timelineUI.pause();

    // Invalidate activeFrameIndex if deleting currently active frame
    if (this.activeFrameIndex === idx) {
      this.activeFrameIndex = -1;
    } else if (this.activeFrameIndex > idx) {
      this.activeFrameIndex--;
    }

    this.project.deleteFrame(idx);
    const nextIndex = Math.min(Math.max(0, idx), this.project.frames.length - 1);
    this.timelineUI.render();
    this.switchFrame(nextIndex);

    events.emit('toast', { message: `Deleted ${frame.name}` });
    this.storage.scheduleAutosave();
  }

  copyCurrentFrame() {
    this.saveActiveFrame();
    const copied = this.project.copyFrame(this.activeFrameIndex);
    if (copied) {
      events.emit('toast', { message: `Copied ${copied.name}` });
    }
  }

  pasteFrame() {
    this.saveActiveFrame();
    const pasted = this.project.pasteFrame(this.activeFrameIndex + 1);
    if (pasted) {
      this.timelineUI.render();
      this.switchFrame(this.project.currentFrameIndex);
      events.emit('toast', { message: `Pasted ${pasted.name}` });
      this.storage.scheduleAutosave();
    } else {
      events.emit('toast', { message: 'Clipboard is empty. Copy a frame first.', type: 'warning' });
    }
  }

  moveFrame(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.project.frames.length || toIndex < 0 || toIndex >= this.project.frames.length) return;

    this.saveActiveFrame();
    this.project.moveFrame(fromIndex, toIndex);

    this.activeFrameIndex = toIndex;
    this.timelineUI.render();
    this.switchFrame(toIndex);
    this.storage.scheduleAutosave();
  }

  syncActiveFrameToDoc() {
    const curFrame = this.project.frames[this.activeFrameIndex];
    if (curFrame) {
      this.doc.layers = curFrame.layers;
      this.doc.activeLayerId = curFrame.activeLayerId;
    }
  }

  syncDocToFrame() {
    const curFrame = this.project.frames[this.activeFrameIndex];
    if (curFrame) {
      this.doc.layers = curFrame.layers;
      this.doc.activeLayerId = curFrame.activeLayerId;
      this.renderer.render();
    }
  }

  // ==========================================
  // Project Settings Modal & Canvas Resizing
  // ==========================================
  initProjectSettingsModal() {
    const settingsBtn = document.getElementById('projectSettingsBtn');
    const modal = document.getElementById('projectSettingsModal');
    const closeBtn = document.getElementById('settingsModalCloseBtn');
    const applyBtn = document.getElementById('applySettingsBtn');

    const nameInput = document.getElementById('settingsProjectName');
    const widthInput = document.getElementById('settingsCanvasWidth');
    const heightInput = document.getElementById('settingsCanvasHeight');
    const bgSelect = document.getElementById('settingsBgPreset');
    const presetSelect = document.getElementById('settingsSizePresets');

    if (!modal) return;

    const openModal = () => {
      nameInput.value = this.project.name;
      widthInput.value = this.project.width;
      heightInput.value = this.project.height;
      bgSelect.value = this.project.backgroundColor;
      modal.classList.remove('hidden');
    };

    const closeModal = () => modal.classList.add('hidden');

    if (settingsBtn) settingsBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Preset selector
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === '1920x1080') { widthInput.value = 1920; heightInput.value = 1080; }
        else if (val === '1280x720') { widthInput.value = 1280; heightInput.value = 720; }
        else if (val === '1080x1080') { widthInput.value = 1080; heightInput.value = 1080; }
        else if (val === '800x600') { widthInput.value = 800; heightInput.value = 600; }
        else if (val === '640x480') { widthInput.value = 640; heightInput.value = 480; }
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const newName = nameInput.value.trim() || 'Untitled Animation';
        const newW = parseInt(widthInput.value, 10) || 1280;
        const newH = parseInt(heightInput.value, 10) || 720;
        const newBg = bgSelect.value;

        this.project.name = newName;
        this.project.width = newW;
        this.project.height = newH;
        this.project.backgroundColor = newBg;

        this.doc.width = newW;
        this.doc.height = newH;
        this.doc.backgroundColor = 'transparent';

        const canvasBoard = document.getElementById('canvasBoard');
        if (canvasBoard) {
          canvasBoard.style.width = `${newW}px`;
          canvasBoard.style.height = `${newH}px`;
        }

        this.applyCanvasBackground(newBg, false);

        this.renderer.resize(newW, newH);
        this.onionSkinRenderer.resize(newW, newH);
        this.renderer.render();
        this.onionSkinRenderer.render(this.project.currentFrameIndex, this.timelineUI.isPlaying);
        this.timelineUI.render();
        this.storage.scheduleAutosave();

        closeModal();
        events.emit('toast', { message: 'Project settings applied' });
      });
    }
  }

  // ==========================================
  // Export Animation Modal
  // ==========================================
  initExportModal() {
    const exportBtn = document.getElementById('animExportBtn');
    const modal = document.getElementById('animExportModal');
    const closeBtn = document.getElementById('exportModalCloseBtn');
    const progressWrap = document.getElementById('exportProgressWrap');
    const progressFill = document.getElementById('exportProgressBar');
    const progressStatus = document.getElementById('exportProgressStatus');

    if (!modal) return;

    exportBtn?.addEventListener('click', () => {
      if (progressWrap) progressWrap.classList.add('hidden');
      modal.classList.remove('hidden');
    });

    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));

    const setProgress = (cur, total, msg) => {
      if (progressWrap) progressWrap.classList.remove('hidden');
      const pct = Math.round((cur / Math.max(1, total)) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressStatus) progressStatus.textContent = `${msg} (${pct}%)`;
    };

    // 1. Animated GIF
    document.getElementById('exportGifBtn')?.addEventListener('click', async () => {
      try {
        await this.exporter.exportAnimatedGIF(setProgress);
        setTimeout(() => modal.classList.add('hidden'), 800);
      } catch (err) {
        console.error('GIF export error:', err);
        events.emit('toast', { message: 'Failed to generate GIF', type: 'danger' });
      }
    });

    // 2. Video WebM / MP4
    document.getElementById('exportVideoBtn')?.addEventListener('click', async () => {
      try {
        await this.exporter.exportVideo(2, setProgress);
        setTimeout(() => modal.classList.add('hidden'), 800);
      } catch (err) {
        console.error('Video export error:', err);
        events.emit('toast', { message: 'Video recording error', type: 'danger' });
      }
    });

    // 3. PNG Sequence ZIP
    document.getElementById('exportZipBtn')?.addEventListener('click', async () => {
      try {
        await this.exporter.exportPNGSequenceZIP(setProgress);
        setTimeout(() => modal.classList.add('hidden'), 800);
      } catch (err) {
        console.error('ZIP export error:', err);
        events.emit('toast', { message: 'ZIP creation error', type: 'danger' });
      }
    });

    // 4. Spritesheet PNG
    document.getElementById('exportSpritesheetBtn')?.addEventListener('click', async () => {
      try {
        await this.exporter.exportSpritesheet();
        modal.classList.add('hidden');
      } catch (err) {
        console.error('Spritesheet export error:', err);
        events.emit('toast', { message: 'Spritesheet export error', type: 'danger' });
      }
    });

    // 5. Current Frame PNG
    document.getElementById('exportSingleFrameBtn')?.addEventListener('click', async () => {
      try {
        await this.exporter.exportCurrentFramePNG();
        modal.classList.add('hidden');
      } catch (err) {
        console.error('Frame PNG export error:', err);
      }
    });
  }

  // ==========================================
  // Project File (.craftanim) Menu & Image Import
  // ==========================================
  initProjectFileMenu() {
    const saveFileBtn = document.getElementById('saveAnimFileBtn');
    const openFileBtn = document.getElementById('openAnimFileBtn');
    const newProjectBtn = document.getElementById('newAnimProjectBtn');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.craftanim,application/json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    saveFileBtn?.addEventListener('click', () => {
      this.storage.downloadProjectFile();
    });

    openFileBtn?.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const loaded = await this.storage.openProjectFile(file);
      if (loaded) {
        this.project = loaded;
        this.exporter.project = this.project;
        this.storage.project = this.project;
        this.doc.width = this.project.width;
        this.doc.height = this.project.height;
        this.doc.backgroundColor = 'transparent';

        const canvasBoard = document.getElementById('canvasBoard');
        if (canvasBoard) {
          canvasBoard.style.width = `${this.project.width}px`;
          canvasBoard.style.height = `${this.project.height}px`;
        }

        this.applyCanvasBackground(this.project.backgroundColor || '#ffffff', false);

        this.renderer.resize(this.project.width, this.project.height);
        this.onionSkinRenderer.resize(this.project.width, this.project.height);

        this.activeFrameIndex = -1;
        this.switchFrame(0);
        this.timelineUI.render();
        this.layersUI.render();
        this.storage.scheduleAutosave();
        events.emit('toast', { message: `Loaded project: ${this.project.name}` });
      }
      fileInput.value = '';
    });

    // New Project with confirmation
    newProjectBtn?.addEventListener('click', () => {
      if (confirm('Create a new animation project? Unsaved changes in the current file will be reset.')) {
        this.project = new AnimationProject({
          name: 'New Animation',
          width: 1280,
          height: 720,
          backgroundColor: '#ffffff',
          fps: 12
        });
        this.exporter.project = this.project;
        this.storage.project = this.project;

        this.doc.width = this.project.width;
        this.doc.height = this.project.height;
        this.doc.backgroundColor = 'transparent';

        const canvasBoard = document.getElementById('canvasBoard');
        if (canvasBoard) {
          canvasBoard.style.width = `${this.project.width}px`;
          canvasBoard.style.height = `${this.project.height}px`;
        }

        this.applyCanvasBackground('#ffffff', false);

        this.activeFrameIndex = -1;
        this.switchFrame(0);
        this.timelineUI.render();
        this.layersUI.render();
        this.storage.scheduleAutosave();
        events.emit('toast', { message: 'New project created' });
      }
    });
  }

  initImageImport() {
    const importInput = document.getElementById('animImageUploadInput');
    if (!importInput) return;

    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (re) => {
        const img = new Image();
        img.onload = () => {
          // Add as new frame with image, or draw onto active layer
          const currentFrame = this.project.getCurrentFrame();
          const activeLayer = this.doc.getActiveLayer();

          activeLayer.ensureRasterCanvas(this.project.width, this.project.height);

          // Fit image centered
          const scale = Math.min(this.project.width / img.width, this.project.height / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          const dx = (this.project.width - dw) / 2;
          const dy = (this.project.height - dh) / 2;

          activeLayer.rasterCtx.drawImage(img, dx, dy, dw, dh);
          this.renderer.render();
          this.timelineUI.updateActiveThumbnail();
          this.storage.scheduleAutosave();
          events.emit('toast', { message: 'Image imported successfully' });
        };
        img.src = re.target.result;
      };
      reader.readAsDataURL(file);
      importInput.value = '';
    });
  }

  // ==========================================
  // Onion Skin Settings Panel Tab
  // ==========================================
  initOnionSkinPanel() {
    const prevCountInput = document.getElementById('onionPrevCount');
    const nextCountInput = document.getElementById('onionNextCount');
    const opacitySlider = document.getElementById('onionOpacitySlider');
    const opacityVal = document.getElementById('onionOpacityVal');
    const tintSelect = document.getElementById('onionTintSelect');

    if (tintSelect) {
      tintSelect.value = this.onionSkinRenderer.tintMode;
      tintSelect.addEventListener('change', (e) => {
        this.onionSkinRenderer.tintMode = e.target.value;
        this.onionSkinRenderer.render(this.activeFrameIndex, this.timelineUI.isPlaying);
      });
    }

    if (prevCountInput) {
      prevCountInput.addEventListener('change', (e) => {
        this.onionSkinRenderer.prevFramesCount = parseInt(e.target.value, 10) || 0;
        this.onionSkinRenderer.render(this.activeFrameIndex, this.timelineUI.isPlaying);
      });
    }

    if (nextCountInput) {
      nextCountInput.addEventListener('change', (e) => {
        this.onionSkinRenderer.nextFramesCount = parseInt(e.target.value, 10) || 0;
        this.onionSkinRenderer.render(this.activeFrameIndex, this.timelineUI.isPlaying);
      });
    }

    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) / 100;
        this.onionSkinRenderer.baseOpacity = val;
        if (opacityVal) opacityVal.textContent = `${Math.round(val * 100)}%`;
        this.onionSkinRenderer.render(this.activeFrameIndex, this.timelineUI.isPlaying);
      });
    }
  }

  // ==========================================
  // Keyboard Shortcuts for Animation
  // ==========================================
  initShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) this.commandManager.redo();
          else this.commandManager.undo();
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          this.commandManager.redo();
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          this.storage.downloadProjectFile();
        }
        return;
      }

      const key = e.key.toLowerCase();
      switch (key) {
        case ' ': // Space: Play / Pause
          e.preventDefault();
          this.timelineUI.togglePlayback();
          break;
        case 'arrowleft': // Step Back
          e.preventDefault();
          this.timelineUI.stepFrame(-1);
          break;
        case 'arrowright': // Step Forward
          e.preventDefault();
          this.timelineUI.stepFrame(1);
          break;
        case 'home': // First Frame
          e.preventDefault();
          this.timelineUI.goToFrame(0);
          break;
        case 'end': // Last Frame
          e.preventDefault();
          this.timelineUI.goToFrame(this.project.frames.length - 1);
          break;
        case 'o': // Onion Skin toggle
          e.preventDefault();
          const active = this.timelineUI.callbacks.onToggleOnionSkin();
          document.getElementById('animOnionToggleBtn')?.classList.toggle('active', active);
          break;
        case '+':
        case '=': // Add Blank Frame
          e.preventDefault();
          this.addNewBlankFrame();
          break;
        case 'v': this.toolManager.setActiveTool('select'); break;
        case 'b': this.toolManager.setActiveTool('brush'); break;
        case 'p': this.toolManager.setActiveTool('pencil'); break;
        case 'e': this.toolManager.setActiveTool('eraser'); break;
        case 'g': this.toolManager.setActiveTool('neon'); break;
        case 'r': this.toolManager.setActiveTool('rainbow'); break;
        case 'a': this.toolManager.setActiveTool('spray'); break;
        case 'f': this.toolManager.setActiveTool('fill'); break;
        case 'i': this.toolManager.setActiveTool('pipette'); break;
        case 't': this.toolManager.setActiveTool('text'); break;
      }
    });
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AnimationApp();
  app.init().catch(err => console.error('[AnimationApp] Boot error:', err));
});

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
    const currentFrame = this.project.getCurrentFrame();
    this.doc = new Document({
      width: this.project.width,
      height: this.project.height,
      backgroundColor: this.project.backgroundColor,
      layers: currentFrame.layers,
      activeLayerId: currentFrame.activeLayerId
    });

    this.commandManager = new CommandManager(50);

    this.renderer = new CanvasRenderer(
      { paintCanvas, previewCanvas, gridCanvas, cursorCanvas },
      this.doc
    );
    this.renderer.resize(this.project.width, this.project.height);

    this.viewportModel = new Viewport(
      { viewport, canvasBoard, symmetryGuide, zoomLevelDisplay },
      this.doc,
      this.renderer,
      { autoResize: false }
    );

    // Onion Skin Renderer
    this.onionSkinRenderer = new OnionSkinRenderer(onionCanvas, this.project);
    this.onionSkinRenderer.resize(this.project.width, this.project.height);

    // Ensure canvas board dimensions and background
    canvasBoard.style.width = `${this.project.width}px`;
    canvasBoard.style.height = `${this.project.height}px`;
    canvasBoard.style.backgroundColor = this.project.backgroundColor || '#ffffff';

    // Canvas Background Preset Dropdown in Header
    const animBgPreset = document.getElementById('animBgPreset');
    if (animBgPreset) {
      animBgPreset.value = this.project.backgroundColor || '#ffffff';
      animBgPreset.addEventListener('change', (e) => {
        const newBg = e.target.value;
        this.project.backgroundColor = newBg;
        this.doc.backgroundColor = newBg;
        canvasBoard.style.backgroundColor = newBg;
        this.renderer.render();
        this.onionSkinRenderer.render(this.project.currentFrameIndex, this.timelineUI.isPlaying);
        this.timelineUI.updateActiveThumbnail();
        this.storage.scheduleAutosave();
        events.emit('toast', { message: `Canvas Background: ${e.target.options[e.target.selectedIndex].text}` });
      });
    }

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
      onFrameChanged: () => {
        this.syncDocToFrame();
        this.layersUI.render();
        this.onionSkinRenderer.render(this.project.currentFrameIndex, this.timelineUI.isPlaying);
        this.storage.scheduleAutosave();
      },
      onPlaybackStateChange: (isPlaying) => {
        if (isPlaying) {
          this.onionSkinRenderer.clear();
        } else {
          this.onionSkinRenderer.render(this.project.currentFrameIndex, false);
        }
      },
      onToggleOnionSkin: () => {
        this.onionSkinRenderer.enabled = !this.onionSkinRenderer.enabled;
        this.onionSkinRenderer.render(this.project.currentFrameIndex, this.timelineUI.isPlaying);
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

    // 9. Document Changed Events (Strokes committed)
    events.on('document:changed', () => {
      this.renderer.render();
      if (!this.isRestoring) {
        this.timelineUI.updateActiveThumbnail();
        this.onionSkinRenderer.render(this.project.currentFrameIndex, this.timelineUI.isPlaying);
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
          this.timelineUI.updateActiveThumbnail();
          this.onionSkinRenderer.render(this.project.currentFrameIndex, false);
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
    this.onionSkinRenderer.render(this.project.currentFrameIndex, false);
    this.storage.updateStatusBadge('saved');
  }

  // ==========================================
  // Frame Switching Engine
  // ==========================================
  switchFrame(newIndex) {
    // 1. Sync current doc layers to active frame
    const curFrame = this.project.getCurrentFrame();
    if (curFrame) {
      curFrame.layers = this.doc.layers;
      curFrame.activeLayerId = this.doc.activeLayerId;
    }

    // 2. Select next frame
    this.project.setCurrentFrame(newIndex);
    const nextFrame = this.project.getCurrentFrame();
    if (!nextFrame) return;

    // 3. Load next frame's layers into Doc
    this.doc.layers = nextFrame.layers;
    this.doc.activeLayerId = nextFrame.activeLayerId || nextFrame.layers[0]?.id;

    // 4. Update command history (clear redo stack for fresh frame action)
    this.commandManager.clear();

    // 5. Render Canvas & Layers UI & Onion Skin
    this.renderer.render();
    this.layersUI.render();

    if (!this.timelineUI.isPlaying) {
      this.onionSkinRenderer.render(newIndex, false);
    }
  }

  syncActiveFrameToDoc() {
    const curFrame = this.project.getCurrentFrame();
    if (curFrame) {
      this.doc.layers = curFrame.layers;
      this.doc.activeLayerId = curFrame.activeLayerId;
    }
  }

  syncDocToFrame() {
    const curFrame = this.project.getCurrentFrame();
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
        this.doc.backgroundColor = newBg;

        const canvasBoard = document.getElementById('canvasBoard');
        if (canvasBoard) {
          canvasBoard.style.width = `${newW}px`;
          canvasBoard.style.height = `${newH}px`;
          canvasBoard.style.backgroundColor = newBg;
        }

        const animBgPreset = document.getElementById('animBgPreset');
        if (animBgPreset) {
          animBgPreset.value = newBg;
        }

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
        this.doc.backgroundColor = this.project.backgroundColor;

        const canvasBoard = document.getElementById('canvasBoard');
        if (canvasBoard) {
          canvasBoard.style.width = `${this.project.width}px`;
          canvasBoard.style.height = `${this.project.height}px`;
          canvasBoard.style.backgroundColor = this.project.backgroundColor || '#ffffff';
        }

        const animBgPreset = document.getElementById('animBgPreset');
        if (animBgPreset) {
          animBgPreset.value = this.project.backgroundColor || '#ffffff';
        }

        this.renderer.resize(this.project.width, this.project.height);
        this.onionSkinRenderer.resize(this.project.width, this.project.height);

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
        this.doc.backgroundColor = this.project.backgroundColor;

        const canvasBoard = document.getElementById('canvasBoard');
        if (canvasBoard) {
          canvasBoard.style.width = `${this.project.width}px`;
          canvasBoard.style.height = `${this.project.height}px`;
          canvasBoard.style.backgroundColor = '#ffffff';
        }

        const animBgPreset = document.getElementById('animBgPreset');
        if (animBgPreset) {
          animBgPreset.value = '#ffffff';
        }

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

    if (prevCountInput) {
      prevCountInput.addEventListener('change', (e) => {
        this.onionSkinRenderer.prevFramesCount = parseInt(e.target.value, 10) || 0;
        this.onionSkinRenderer.render(this.project.currentFrameIndex, this.timelineUI.isPlaying);
      });
    }

    if (nextCountInput) {
      nextCountInput.addEventListener('change', (e) => {
        this.onionSkinRenderer.nextFramesCount = parseInt(e.target.value, 10) || 0;
        this.onionSkinRenderer.render(this.project.currentFrameIndex, this.timelineUI.isPlaying);
      });
    }

    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) / 100;
        this.onionSkinRenderer.baseOpacity = val;
        if (opacityVal) opacityVal.textContent = `${Math.round(val * 100)}%`;
        this.onionSkinRenderer.render(this.project.currentFrameIndex, this.timelineUI.isPlaying);
      });
    }

    if (tintSelect) {
      tintSelect.addEventListener('change', (e) => {
        this.onionSkinRenderer.tintMode = e.target.value;
        this.onionSkinRenderer.render(this.project.currentFrameIndex, this.timelineUI.isPlaying);
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
          this.project.addFrame();
          this.timelineUI.render();
          this.switchFrame(this.project.currentFrameIndex);
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

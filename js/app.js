/**
 * The Craft — Application Orchestrator & Bootstrapper
 * Coordinates Document, CommandManager, CanvasRenderer, Viewport,
 * ToolManager, LayersPanel, and UI components.
 */
import { events } from './core/EventBus.js';
import { Document } from './core/Document.js';
import { CommandManager } from './core/CommandManager.js';
import { CanvasRenderer } from './renderer/CanvasRenderer.js';
import { Viewport } from './renderer/Viewport.js';
import { ToolManager } from './tools/ToolManager.js';
import { ToolDockUI } from './ui/ToolDockUI.js';
import { PropertiesPanelUI } from './ui/PropertiesPanelUI.js';
import { LayersPanel } from './ui/LayersPanel.js';
import { ExportModal } from './ui/ExportModal.js';
import { ClearLayerCommand } from './core/commands/DrawCommand.js';
import { Layer } from './layers/Layer.js';
import { StorageService } from './core/StorageService.js';
import { ProjectManager } from './ui/ProjectManager.js';

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. DOM References
  // ==========================================
  const viewport = document.getElementById('canvasStage');
  const canvasBoard = document.getElementById('canvasBoard');
  const gridCanvas = document.getElementById('gridCanvas');
  const paintCanvas = document.getElementById('paintCanvas');
  const previewCanvas = document.getElementById('previewCanvas');
  const cursorCanvas = document.getElementById('cursorCanvas');
  const inlineTextInput = document.getElementById('inlineCanvasTextInput');
  const symmetryGuide = document.getElementById('symmetryGuide');

  // Sidebars & Header
  const toolDock = document.getElementById('toolDock');
  const propertiesPanel = document.getElementById('propertiesPanel');
  const toggleLeftDockBtn = document.getElementById('toggleLeftDockBtn');
  const toggleRightPanelBtn = document.getElementById('toggleRightPanelBtn');
  const collapseDockBtn = document.getElementById('collapseDockBtn');
  const collapsePanelBtn = document.getElementById('collapsePanelBtn');
  const leftEdgeTrigger = document.getElementById('leftEdgeTrigger');
  const rightEdgeTrigger = document.getElementById('rightEdgeTrigger');
  const zenModeBtn = document.getElementById('zenModeBtn');

  // Tool buttons
  const toolButtons = document.querySelectorAll('.tool-item');
  const quickButtons = document.querySelectorAll('.quick-btn');
  const quickDots = document.querySelectorAll('.quick-dot');

  // Top header actions
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const bgPreset = document.getElementById('bgPreset');
  const gridToggleBtn = document.getElementById('gridToggleBtn');
  const symmetryToggleBtn = document.getElementById('symmetryToggleBtn');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');
  const zoomLevelDisplay = document.getElementById('zoomLevel');
  const toast = document.getElementById('toast');

  // Layers panel container
  const layersContainer = document.getElementById('layersPanelContent');

  // ==========================================
  // 2. Instantiate Core Models
  // ==========================================
  const doc = new Document({
    width: viewport.clientWidth || window.innerWidth,
    height: viewport.clientHeight || (window.innerHeight - 56),
    backgroundColor: '#0f1117'
  });

  const commandManager = new CommandManager(50);

  const renderer = new CanvasRenderer(
    { paintCanvas, previewCanvas, gridCanvas, cursorCanvas },
    doc
  );

  const viewportModel = new Viewport(
    { viewport, canvasBoard, symmetryGuide, zoomLevelDisplay },
    doc,
    renderer
  );

  // App Context for tools
  const appContext = {
    viewport,
    canvasBoard,
    paintCanvas,
    previewCanvas,
    inlineTextInput,
    doc,
    renderer,
    commandManager,
    viewportModel
  };

  const toolManager = new ToolManager(appContext);

  // ==========================================
  // 3. Initialize UI Components
  // ==========================================
  const toolDockUI = new ToolDockUI(
    { toolDock, toggleLeftDockBtn, collapseDockBtn, leftEdgeTrigger, toolButtons, quickButtons },
    toolManager
  );

  const propertiesPanelUI = new PropertiesPanelUI(
    {
      propertiesPanel,
      toggleRightPanelBtn,
      collapsePanelBtn,
      rightEdgeTrigger,
      brushSizeSlider: document.getElementById('brushSize'),
      brushOpacitySlider: document.getElementById('brushOpacity'),
      pressureDynamicsCheck: document.getElementById('pressureDynamicsCheck'),
      sizeBadge: document.getElementById('sizeBadge'),
      opacityBadge: document.getElementById('opacityBadge'),
      pillButtons: document.querySelectorAll('.pill-btn'),
      swatchButtons: document.querySelectorAll('.swatch-btn'),
      nativeColorPicker: document.getElementById('nativeColorPicker'),
      bottomColorPicker: document.getElementById('bottomColorPicker'),
      activeColorSwatch: document.getElementById('activeColorSwatch'),
      hexCodeBadge: document.getElementById('hexCodeBadge'),
      brushDotPreview: document.getElementById('brushDotPreview'),
      shapeFillCheck: document.getElementById('shapeFillCheck'),
      shapeConfig: document.getElementById('shapeConfig'),
      stampConfig: document.getElementById('stampConfig'),
      stampChoices: document.querySelectorAll('.stamp-choice'),
      quickDots
    },
    toolManager
  );

  const layersPanel = new LayersPanel(layersContainer, doc, renderer, commandManager);

  const exportModal = new ExportModal(
    {
      exportDropdownBtn: document.getElementById('exportDropdownBtn'),
      exportDropdownWrap: document.getElementById('exportDropdownWrap'),
      savePngBtn: document.getElementById('savePngBtn'),
      saveJpgBtn: document.getElementById('saveJpgBtn'),
      copyClipboardBtn: document.getElementById('copyClipboardBtn'),
      imageUploadInput: document.getElementById('imageUploadInput')
    },
    doc,
    renderer,
    commandManager
  );

  // Storage Service (IndexedDB Autosave)
  const storageService = new StorageService(doc, renderer, toolManager);
  const saveStatusBadge = document.getElementById('saveStatusBadge');
  if (saveStatusBadge) {
    storageService.setStatusBadgeElement(saveStatusBadge);
  }

  // Project Manager (.craft File Save / Open)
  const projectManager = new ProjectManager(doc, renderer, commandManager, toolManager, storageService);
  const openProjectBtn = document.getElementById('openProjectBtn');
  const saveProjectBtn = document.getElementById('saveProjectBtn');
  if (openProjectBtn) {
    openProjectBtn.addEventListener('click', () => projectManager.triggerOpenDialog());
  }
  if (saveProjectBtn) {
    saveProjectBtn.addEventListener('click', () => projectManager.saveProject());
  }

  // ==========================================
  // 4. Pointer Events Binding (Stylus, Touch, Mouse)
  // ==========================================
  viewport.addEventListener('pointerdown', (e) => {
    // Only process primary button or stylus touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    toolManager.handlePointerDown(e);
  });

  window.addEventListener('pointermove', (e) => {
    toolManager.handlePointerMove(e);
  });

  window.addEventListener('pointerup', (e) => {
    toolManager.handlePointerUp(e);
  });

  window.addEventListener('pointercancel', (e) => {
    toolManager.handlePointerUp(e);
  });

  viewport.addEventListener('pointerleave', (e) => {
    toolManager.handlePointerLeave(e);
  });

  // ==========================================
  // 5. Header Action Controls
  // ==========================================
  // Undo & Redo
  undoBtn.addEventListener('click', () => commandManager.undo());
  redoBtn.addEventListener('click', () => commandManager.redo());

  events.on('history:changed', ({ canUndo, canRedo }) => {
    undoBtn.disabled = !canUndo;
    redoBtn.disabled = !canRedo;
  });

  events.on('history:undo', () => commandManager.undo());
  events.on('history:redo', () => commandManager.redo());

  // Clear Active Layer
  clearBtn.addEventListener('click', () => {
    const activeLayer = doc.getActiveLayer();
    if (!activeLayer) return;
    if (activeLayer.elements.length === 0 && !activeLayer.rasterCanvas) return;

    if (confirm(`Clear all contents of "${activeLayer.name}"?`)) {
      commandManager.execute(new ClearLayerCommand(doc, activeLayer.id));
      showToastNotification(`Cleared ${activeLayer.name}`);
    }
  });

  // ==========================================
  // Background Preset & Custom Color Selector
  // ==========================================
  const bgSwatchDot = document.getElementById('bgSwatchDot');
  const bgCustomPicker = document.getElementById('bgCustomPicker');

  const isDarkColor = (hex) => {
    if (!hex || hex === 'transparent') return false;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return false;
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  };

  const applyCanvasBackground = (newBg, showToast = true) => {
    doc.backgroundColor = newBg;

    if (newBg === 'transparent') {
      canvasBoard?.classList.add('transparent-canvas');
      if (canvasBoard) canvasBoard.style.backgroundColor = 'transparent';
      if (bgSwatchDot) {
        bgSwatchDot.classList.add('checkerboard');
        bgSwatchDot.style.backgroundColor = '';
      }
    } else {
      canvasBoard?.classList.remove('transparent-canvas');
      if (canvasBoard) {
        canvasBoard.style.backgroundColor = newBg;
        canvasBoard.style.backgroundImage = 'none';
      }
      if (bgSwatchDot) {
        bgSwatchDot.classList.remove('checkerboard');
        bgSwatchDot.style.backgroundColor = newBg;
      }
    }

    if (bgPreset) {
      let matched = false;
      for (const opt of bgPreset.options) {
        if (opt.value === newBg) {
          bgPreset.value = newBg;
          matched = true;
          break;
        }
      }
      if (!matched && newBg !== 'transparent') {
        let customOpt = bgPreset.querySelector('option[data-custom="true"]');
        if (!customOpt) {
          customOpt = document.createElement('option');
          customOpt.dataset.custom = "true";
          bgPreset.appendChild(customOpt);
        }
        customOpt.value = newBg;
        customOpt.textContent = `Custom (${newBg.toUpperCase()})`;
        bgPreset.value = newBg;
      }
    }

    if (bgCustomPicker && newBg !== 'transparent' && newBg.startsWith('#')) {
      bgCustomPicker.value = newBg;
    }

    renderer.render();

    // Auto-contrast brush protection
    const activeColor = toolManager.toolState.color;
    if (isDarkColor(newBg)) {
      if (isDarkColor(activeColor)) {
        events.emit('color:selected', { color: '#ffffff' });
        showToastNotification('Switched brush to White for contrast against dark background');
      }
    } else if (newBg !== 'transparent') {
      if (activeColor === '#ffffff' || activeColor?.toLowerCase() === '#fff') {
        events.emit('color:selected', { color: '#18181b' });
        showToastNotification('Switched brush to Charcoal for contrast against light background');
      }
    }

    if (showToast) {
      const label = newBg === 'transparent' ? 'Transparent (PNG)' : newBg.toUpperCase();
      showToastNotification(`Canvas Background: ${label}`);
    }
  };

  if (bgPreset) {
    bgPreset.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'custom') {
        bgCustomPicker?.click();
      } else {
        applyCanvasBackground(val, true);
      }
    });
  }

  if (bgCustomPicker) {
    bgCustomPicker.addEventListener('input', (e) => {
      applyCanvasBackground(e.target.value, false);
    });
    bgCustomPicker.addEventListener('change', (e) => {
      applyCanvasBackground(e.target.value, true);
    });
  }

  // Initial background setup
  applyCanvasBackground(doc.backgroundColor || '#0f1117', false);

  // Grid Toggle
  gridToggleBtn.addEventListener('click', () => {
    const active = viewportModel.toggleGrid();
    gridToggleBtn.classList.toggle('active', active);
  });

  // Symmetry Toggle
  symmetryToggleBtn.addEventListener('click', () => {
    const active = viewportModel.toggleSymmetry();
    symmetryToggleBtn.classList.toggle('active', active);
  });

  // Zen Mode Toggle
  zenModeBtn.addEventListener('click', () => {
    const active = viewportModel.toggleZenMode();
    zenModeBtn.classList.toggle('active', active);
  });

  // Zoom buttons
  zoomInBtn.addEventListener('click', () => viewportModel.zoomIn());
  zoomOutBtn.addEventListener('click', () => viewportModel.zoomOut());
  zoomResetBtn.addEventListener('click', () => viewportModel.resetZoom());

  // ==========================================
  // 6. Right Sidebar Tabs (Properties vs Layers)
  // ==========================================
  const tabPropertiesBtn = document.getElementById('tabPropertiesBtn');
  const tabLayersBtn = document.getElementById('tabLayersBtn');
  const propertiesContent = document.getElementById('propertiesContent');
  const layersContentWrap = document.getElementById('layersPanelContent');
  const layersCountBadge = document.getElementById('layersCountBadge');

  function updateLayerCountBadge() {
    if (layersCountBadge) {
      layersCountBadge.textContent = doc.layers.length;
    }
  }
  updateLayerCountBadge();
  events.on('document:changed', updateLayerCountBadge);

  if (tabPropertiesBtn && tabLayersBtn && propertiesContent && layersContentWrap) {
    tabPropertiesBtn.addEventListener('click', () => {
      tabPropertiesBtn.classList.add('active');
      tabLayersBtn.classList.remove('active');
      propertiesContent.classList.remove('hidden');
      layersContentWrap.classList.add('hidden');
    });

    tabLayersBtn.addEventListener('click', () => {
      tabLayersBtn.classList.add('active');
      tabPropertiesBtn.classList.remove('active');
      layersContentWrap.classList.remove('hidden');
      propertiesContent.classList.add('hidden');
    });
  }

  // ==========================================
  // 7. Global Keyboard Shortcuts
  // ==========================================
  window.addEventListener('keydown', (e) => {
    // Ignore keystrokes when typing inside input or textarea
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          commandManager.redo();
        } else {
          commandManager.undo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        commandManager.redo();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        toolDockUI.toggleCollapse();
      }
      return;
    }

    const key = e.key.toLowerCase();
    switch (key) {
      case 'v': toolManager.setActiveTool('select'); break;
      case 'b': toolManager.setActiveTool('brush'); break;
      case 'p': toolManager.setActiveTool('pencil'); break;
      case 'e': toolManager.setActiveTool('eraser'); break;
      case 'g': toolManager.setActiveTool('neon'); break;
      case 'r': toolManager.setActiveTool('rainbow'); break;
      case 'a': toolManager.setActiveTool('spray'); break;
      case 'h': toolManager.setActiveTool('highlighter'); break;
      case 'l': toolManager.setActiveTool('line'); break;
      case 'f': toolManager.setActiveTool('fill'); break;
      case 'i': toolManager.setActiveTool('pipette'); break;
      case 't': toolManager.setActiveTool('text'); break;
      case 'delete':
      case 'backspace': {
        const selTool = toolManager.tools.get('select');
        if (selTool && selTool.selectedElement) {
          e.preventDefault();
          selTool.deleteSelected(doc, commandManager);
        }
        break;
      }
      case 'tab':
        e.preventDefault();
        viewportModel.toggleZenMode();
        break;
      case '+':
      case '=':
        e.preventDefault();
        viewportModel.zoomIn();
        break;
      case '-':
        e.preventDefault();
        viewportModel.zoomOut();
        break;
      case '0':
        e.preventDefault();
        viewportModel.resetZoom();
        break;
    }
  });

  // ==========================================
  // 8. Toast Notifications
  // ==========================================
  function showToastNotification(msg, type = 'info') {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast-popup show ${type}`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.className = 'toast-popup';
    }, 2400);
  }

  events.on('toast', ({ message, type }) => {
    showToastNotification(message, type || 'info');
  });

  // ==========================================
  // 9. Initial Canvas Render & Autosave Session Restore
  // ==========================================
  let isRestoringSession = false;

  events.on('document:changed', () => {
    renderer.render();
    if (!isRestoringSession) {
      storageService.scheduleAutosave();
    }
  });

  (async () => {
    try {
      isRestoringSession = true;
      const session = await storageService.loadSession();
      if (session && session.layers && session.layers.length > 0) {
        doc.backgroundColor = session.backgroundColor || '#0f1117';
        doc.nextLayerNumber = session.nextLayerNumber || (session.layers.length + 1);

        const restoredLayers = [];
        for (const lData of session.layers) {
          const layer = new Layer({
            id: lData.id,
            name: lData.name,
            visible: lData.visible !== false,
            locked: !!lData.locked,
            opacity: lData.opacity !== undefined ? lData.opacity : 1.0,
            blendMode: lData.blendMode || 'source-over',
            type: lData.type || 'vector',
            elements: Array.isArray(lData.elements) ? lData.elements : []
          });

          if (lData.rasterDataBitmap) {
            layer.ensureRasterCanvas(doc.width, doc.height);
            layer.rasterCtx.drawImage(lData.rasterDataBitmap, 0, 0);
          }
          restoredLayers.push(layer);
        }

        doc.layers = restoredLayers;
        doc.activeLayerId = session.activeLayerId && restoredLayers.some(l => l.id === session.activeLayerId)
          ? session.activeLayerId
          : restoredLayers[0].id;

        if (session.settings) {
          if (session.settings.color) toolManager.toolState.color = session.settings.color;
          if (session.settings.size) toolManager.toolState.size = session.settings.size;
          if (session.settings.opacity !== undefined) toolManager.toolState.opacity = session.settings.opacity;
          if (session.settings.fillShape !== undefined) toolManager.toolState.fillShape = session.settings.fillShape;
          if (session.settings.pressureDynamics !== undefined) toolManager.toolState.pressureDynamics = session.settings.pressureDynamics;
        }

        applyCanvasBackground(doc.backgroundColor || '#0f1117', false);

        renderer.render();
        events.emit('document:changed');
        storageService.updateStatusBadge('saved');
        console.log(`[The Craft] Restored autosaved project with ${restoredLayers.length} layers.`);
      } else {
        renderer.render();
      }
    } catch (err) {
      console.warn('[The Craft] Could not restore autosave session:', err);
      renderer.render();
    } finally {
      isRestoringSession = false;
    }
  })();
});

/**
 * The Craft — Properties Panel UI
 * Controls brush sizes, opacity, shape fill, stamp selectors, and color palettes.
 */
import { events } from '../core/EventBus.js';

export class PropertiesPanelUI {
  constructor(elements, toolManager) {
    this.panel = elements.propertiesPanel;
    this.toggleBtn = elements.toggleRightPanelBtn;
    this.collapseBtn = elements.collapsePanelBtn;
    this.edgeTrigger = elements.rightEdgeTrigger;

    this.brushSizeSlider = elements.brushSizeSlider;
    this.brushOpacitySlider = elements.brushOpacitySlider;
    this.sizeBadge = elements.sizeBadge;
    this.opacityBadge = elements.opacityBadge;
    this.pillButtons = elements.pillButtons;
    this.swatchButtons = elements.swatchButtons;
    this.nativeColorPicker = elements.nativeColorPicker;
    this.bottomColorPicker = elements.bottomColorPicker;
    this.activeColorSwatch = elements.activeColorSwatch;
    this.hexCodeBadge = elements.hexCodeBadge;
    this.brushDotPreview = elements.brushDotPreview;
    this.shapeFillCheck = elements.shapeFillCheck;
    this.shapeConfig = elements.shapeConfig;
    this.stampConfig = elements.stampConfig;
    this.stampChoices = elements.stampChoices;
    this.quickDots = elements.quickDots;

    this.toolManager = toolManager;
    this.isCollapsed = false;

    this.init();
  }

  init() {
    // 1. Brush Size Slider & Presets
    if (this.brushSizeSlider) {
      this.brushSizeSlider.addEventListener('input', (e) => {
        this.setSize(parseInt(e.target.value, 10));
      });
    }

    if (this.pillButtons) {
      this.pillButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const sz = parseInt(btn.dataset.size, 10);
          this.setSize(sz);
        });
      });
    }

    // 2. Brush Opacity Slider
    if (this.brushOpacitySlider) {
      this.brushOpacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setOpacity(val / 100);
      });
    }

    // 3. Shape Fill Checkbox
    if (this.shapeFillCheck) {
      this.shapeFillCheck.addEventListener('change', (e) => {
        this.toolManager.toolState.fillShape = e.target.checked;
      });
    }

    // 4. Color Pickers (Native, Bottom, Swatches)
    if (this.nativeColorPicker) {
      this.nativeColorPicker.addEventListener('input', (e) => this.setColor(e.target.value));
    }
    if (this.bottomColorPicker) {
      this.bottomColorPicker.addEventListener('input', (e) => this.setColor(e.target.value));
    }

    if (this.swatchButtons) {
      this.swatchButtons.forEach(btn => {
        btn.addEventListener('click', () => this.setColor(btn.dataset.color));
      });
    }

    if (this.quickDots) {
      this.quickDots.forEach(dot => {
        dot.addEventListener('click', () => this.setColor(dot.dataset.color));
      });
    }

    // 5. Stamp Choices
    if (this.stampChoices) {
      this.stampChoices.forEach(choice => {
        choice.addEventListener('click', () => {
          this.stampChoices.forEach(c => c.classList.remove('active'));
          choice.classList.add('active');
          this.toolManager.toolState.selectedStamp = choice.dataset.emoji;
        });
      });
    }

    // 6. Panel Collapse & Expand
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleCollapse());
    }
    if (this.collapseBtn) {
      this.collapseBtn.addEventListener('click', () => this.toggleCollapse());
    }
    if (this.edgeTrigger) {
      this.edgeTrigger.addEventListener('click', () => this.toggleCollapse(false));
    }

    // 7. Event listeners
    events.on('color:selected', ({ color }) => this.setColor(color));
    events.on('tool:changed', ({ toolId }) => this.onToolChanged(toolId));

    // Initial sync
    this.setSize(8);
    this.setColor('#6366f1');
    this.setOpacity(1.0);
  }

  setSize(size) {
    this.toolManager.toolState.size = size;
    if (this.brushSizeSlider) this.brushSizeSlider.value = size;
    if (this.sizeBadge) this.sizeBadge.textContent = `${size}px`;

    if (this.pillButtons) {
      this.pillButtons.forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.size, 10) === size);
      });
    }

    this.updatePreviewDot();
  }

  setColor(color) {
    this.toolManager.toolState.color = color;
    if (this.nativeColorPicker) this.nativeColorPicker.value = color;
    if (this.bottomColorPicker) this.bottomColorPicker.value = color;
    if (this.activeColorSwatch) this.activeColorSwatch.style.backgroundColor = color;
    if (this.hexCodeBadge) this.hexCodeBadge.textContent = color.toUpperCase();

    if (this.swatchButtons) {
      this.swatchButtons.forEach(b => {
        b.classList.toggle('active', b.dataset.color.toLowerCase() === color.toLowerCase());
      });
    }
    if (this.quickDots) {
      this.quickDots.forEach(d => {
        d.classList.toggle('active', d.dataset.color.toLowerCase() === color.toLowerCase());
      });
    }

    this.updatePreviewDot();
  }

  setOpacity(opacity) {
    this.toolManager.toolState.opacity = opacity;
    const pct = Math.round(opacity * 100);
    if (this.brushOpacitySlider) this.brushOpacitySlider.value = pct;
    if (this.opacityBadge) this.opacityBadge.textContent = `${pct}%`;
    this.updatePreviewDot();
  }

  updatePreviewDot() {
    if (!this.brushDotPreview) return;
    const s = Math.min(26, Math.max(3, this.toolManager.toolState.size));
    this.brushDotPreview.style.width = `${s}px`;
    this.brushDotPreview.style.height = `${s}px`;
    this.brushDotPreview.style.backgroundColor = this.toolManager.toolState.color;
    this.brushDotPreview.style.opacity = this.toolManager.toolState.opacity;
  }

  onToolChanged(toolId) {
    const isShape = ['rectangle', 'circle', 'star', 'heart', 'line', 'arrow'].includes(toolId);
    if (this.shapeConfig) {
      this.shapeConfig.classList.toggle('hidden', !isShape);
    }
    if (this.stampConfig) {
      this.stampConfig.classList.toggle('hidden', toolId !== 'stamp');
    }
  }

  toggleCollapse(forceState = null) {
    this.isCollapsed = forceState !== null ? forceState : !this.isCollapsed;
    this.panel.classList.toggle('collapsed', this.isCollapsed);
    if (this.edgeTrigger) {
      this.edgeTrigger.classList.toggle('active', this.isCollapsed);
    }
  }
}

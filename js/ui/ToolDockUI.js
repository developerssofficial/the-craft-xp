/**
 * The Craft — Tool Dock UI
 * Manages the floating left toolbar, tool selection buttons, and dock collapse.
 */
import { events } from '../core/EventBus.js';

export class ToolDockUI {
  constructor(elements, toolManager) {
    this.toolDock = elements.toolDock;
    this.toggleBtn = elements.toggleLeftDockBtn;
    this.collapseBtn = elements.collapseDockBtn;
    this.edgeTrigger = elements.leftEdgeTrigger;
    this.toolButtons = elements.toolButtons;
    this.quickButtons = elements.quickButtons;
    this.toolManager = toolManager;

    this.isCollapsed = false;

    this.init();
  }

  init() {
    // Tool buttons click
    this.toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const toolId = btn.dataset.tool;
        if (toolId) {
          this.toolManager.setActiveTool(toolId);
        }
      });
    });

    // Quick bar tool buttons
    if (this.quickButtons) {
      this.quickButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (action === 'undo') {
            events.emit('history:undo');
          } else if (action === 'redo') {
            events.emit('history:redo');
          } else if (action) {
            this.toolManager.setActiveTool(action);
          }
        });
      });
    }

    // Dock toggle & collapse
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleCollapse());
    }
    if (this.collapseBtn) {
      this.collapseBtn.addEventListener('click', () => this.toggleCollapse());
    }
    if (this.edgeTrigger) {
      this.edgeTrigger.addEventListener('click', () => this.toggleCollapse(false));
    }

    // Listen to tool change events
    events.on('tool:changed', ({ toolId }) => {
      this.setActiveButton(toolId);
    });
  }

  setActiveButton(toolId) {
    this.toolButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolId);
    });

    if (this.quickButtons) {
      this.quickButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.action === toolId);
      });
    }
  }

  toggleCollapse(forceState = null) {
    this.isCollapsed = forceState !== null ? forceState : !this.isCollapsed;
    this.toolDock.classList.toggle('collapsed', this.isCollapsed);
    if (this.edgeTrigger) {
      this.edgeTrigger.classList.toggle('active', this.isCollapsed);
    }
  }
}

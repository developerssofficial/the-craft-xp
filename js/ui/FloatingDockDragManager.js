/**
 * The Craft — Floating Quick Bar Drag & Minimize Manager
 * Enables smooth 360° freeform dragging in all directions (X & Y),
 * locks minimalist pill dimensions to prevent any vertical stretching or oval distortion,
 * isolates pointer events so canvas strokes never leak,
 * and allows dragging from the grip handle or anywhere on the bar (including swatches).
 */

export class FloatingDockDragManager {
  constructor(dockEl, dragHandleEl, collapseBtnEl) {
    this.dock = dockEl;
    this.handle = dragHandleEl;
    this.collapseBtn = collapseBtnEl;

    this.isDragging = false;
    this.isPotentialDrag = false;
    this.startX = 0;
    this.startY = 0;
    this.initialLeft = 0;
    this.initialTop = 0;
    this.hasMoved = false;

    this.storageKey = 'thecraft_floating_dock_pos_v1';

    this.init();
  }

  init() {
    this.restoreSavedPosition();

    // Prevent any pointer events inside the dock from bubbling up to the canvas viewport
    const isolateEvent = (e) => {
      e.stopPropagation();
    };

    this.dock.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.handlePointerDown(e);
    });

    this.dock.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    }, { passive: true });

    this.dock.addEventListener('touchmove', (e) => {
      if (this.isDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });

    // Global pointer move and up listeners for silky smooth drag tracking across entire window
    window.addEventListener('pointermove', (e) => this.handlePointerMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    window.addEventListener('pointercancel', (e) => this.handlePointerUp(e));

    // Double-click drag handle to reset dock back to default bottom-center position
    if (this.handle) {
      this.handle.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.resetPosition();
      });
    }

    // Collapse / Minimize toggle
    if (this.collapseBtn) {
      this.collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMinimize();
      });
    }

    // Clicking the minimized floating dock expands it back
    this.dock.addEventListener('click', (e) => {
      if (this.dock.classList.contains('minimized') && !this.hasMoved) {
        this.toggleMinimize(false);
      }
    });

    // Handle window resize to keep dock within viewport
    window.addEventListener('resize', () => {
      this.constrainToViewport();
    });
  }

  handlePointerDown(e) {
    // Only accept primary pointer (left mouse click or touch)
    if (e.button !== undefined && e.button !== 0) return;

    this.isPotentialDrag = true;
    this.isDragging = false;
    this.hasMoved = false;

    this.startX = e.clientX;
    this.startY = e.clientY;

    const rect = this.dock.getBoundingClientRect();
    this.initialLeft = rect.left;
    this.initialTop = rect.top;
    this.currentPointerId = e.pointerId;
  }

  handlePointerMove(e) {
    if (!this.isPotentialDrag && !this.isDragging) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const dist = Math.hypot(dx, dy);

    // Threshold of 4px movement activates 360° freeform drag
    if (this.isPotentialDrag && !this.isDragging && dist >= 4) {
      this.isDragging = true;
      this.hasMoved = true;
      this.dock.classList.add('is-dragging');

      if (this.handle) this.handle.style.cursor = 'grabbing';

      // Switch to position: fixed and remove bottom/transform to allow true unrestricted 360° motion
      this.dock.style.setProperty('position', 'fixed', 'important');
      this.dock.style.setProperty('bottom', 'auto', 'important');
      this.dock.style.setProperty('right', 'auto', 'important');
      this.dock.style.setProperty('transform', 'none', 'important');
      this.dock.style.setProperty('height', this.dock.classList.contains('minimized') ? '44px' : '48px', 'important');
      this.dock.style.setProperty('max-height', this.dock.classList.contains('minimized') ? '44px' : '48px', 'important');

      if (this.currentPointerId !== undefined && this.dock.setPointerCapture) {
        try { this.dock.setPointerCapture(this.currentPointerId); } catch (_) {}
      }
    }

    if (this.isDragging) {
      e.preventDefault();
      e.stopPropagation();

      let newLeft = this.initialLeft + dx;
      let newTop = this.initialTop + dy;

      // Keep dock within viewport boundaries with 8px safe margin
      const dockWidth = this.dock.offsetWidth;
      const dockHeight = this.dock.offsetHeight;
      const maxLeft = window.innerWidth - dockWidth - 8;
      const maxTop = window.innerHeight - dockHeight - 8;

      newLeft = Math.max(8, Math.min(newLeft, maxLeft));
      newTop = Math.max(50, Math.min(newTop, maxTop)); // Keep 50px below header

      this.dock.style.setProperty('left', `${newLeft}px`, 'important');
      this.dock.style.setProperty('top', `${newTop}px`, 'important');
    }
  }

  handlePointerUp(e) {
    if (this.isDragging) {
      this.isDragging = false;
      this.dock.classList.remove('is-dragging');
      if (this.handle) this.handle.style.cursor = 'grab';

      if (this.currentPointerId !== undefined && this.dock.releasePointerCapture) {
        try { this.dock.releasePointerCapture(this.currentPointerId); } catch (_) {}
      }

      this.savePosition();

      // Suppress immediate accidental click on swatch or button if user dragged
      const suppressClick = (ev) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        window.removeEventListener('click', suppressClick, true);
      };
      window.addEventListener('click', suppressClick, true);
      setTimeout(() => window.removeEventListener('click', suppressClick, true), 80);
    }

    this.isPotentialDrag = false;
  }

  toggleMinimize(force = null) {
    const isMin = force !== null ? force : !this.dock.classList.contains('minimized');
    this.dock.classList.toggle('minimized', isMin);
    if (this.collapseBtn) {
      this.collapseBtn.innerHTML = isMin ? '<i class="fa-solid fa-chevron-up"></i>' : '<i class="fa-solid fa-chevron-down"></i>';
      this.collapseBtn.title = isMin ? 'Expand Toolbar' : 'Minimize Toolbar';
    }
    const targetHeight = isMin ? '44px' : '48px';
    this.dock.style.setProperty('height', targetHeight, 'important');
    this.dock.style.setProperty('max-height', targetHeight, 'important');
    this.constrainToViewport();
  }

  savePosition() {
    const pos = {
      left: parseFloat(this.dock.style.left),
      top: parseFloat(this.dock.style.top)
    };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(pos));
    } catch (_) {}
  }

  restoreSavedPosition() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const pos = JSON.parse(saved);
        if (typeof pos.left === 'number' && typeof pos.top === 'number' && !isNaN(pos.left) && !isNaN(pos.top)) {
          this.dock.style.setProperty('position', 'fixed', 'important');
          this.dock.style.setProperty('bottom', 'auto', 'important');
          this.dock.style.setProperty('right', 'auto', 'important');
          this.dock.style.setProperty('transform', 'none', 'important');
          this.dock.style.setProperty('height', '48px', 'important');
          this.dock.style.setProperty('max-height', '48px', 'important');
          this.dock.style.setProperty('left', `${pos.left}px`, 'important');
          this.dock.style.setProperty('top', `${pos.top}px`, 'important');
          setTimeout(() => this.constrainToViewport(), 80);
          return;
        }
      }
    } catch (_) {}

    // Default pristine position: bottom center
    this.resetPosition();
  }

  constrainToViewport() {
    if (this.dock.style.top && this.dock.style.left && this.dock.style.top !== 'auto') {
      const dockWidth = this.dock.offsetWidth;
      const dockHeight = this.dock.offsetHeight;
      const maxLeft = window.innerWidth - dockWidth - 8;
      const maxTop = window.innerHeight - dockHeight - 8;

      let curLeft = parseFloat(this.dock.style.left);
      let curTop = parseFloat(this.dock.style.top);

      curLeft = Math.max(8, Math.min(curLeft, maxLeft));
      curTop = Math.max(50, Math.min(curTop, maxTop));

      this.dock.style.setProperty('left', `${curLeft}px`, 'important');
      this.dock.style.setProperty('top', `${curTop}px`, 'important');
    }
  }

  resetPosition() {
    try { localStorage.removeItem(this.storageKey); } catch (_) {}
    this.dock.style.setProperty('position', 'fixed', 'important');
    this.dock.style.setProperty('left', '50%', 'important');
    this.dock.style.setProperty('bottom', '22px', 'important');
    this.dock.style.setProperty('top', 'auto', 'important');
    this.dock.style.setProperty('right', 'auto', 'important');
    this.dock.style.setProperty('transform', 'translateX(-50%)', 'important');
    this.dock.style.setProperty('height', '48px', 'important');
    this.dock.style.setProperty('max-height', '48px', 'important');
  }
}

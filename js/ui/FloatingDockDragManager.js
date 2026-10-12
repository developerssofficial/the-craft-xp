/**
 * The Craft — Floating Quick Bar Drag & Minimize Manager
 * Enables smart freeform dragging, boundary snapping, dock minimization,
 * and localStorage position persistence for optimal drawing workspace ergonomics.
 */

export class FloatingDockDragManager {
  constructor(dockEl, dragHandleEl, collapseBtnEl) {
    this.dock = dockEl;
    this.handle = dragHandleEl;
    this.collapseBtn = collapseBtnEl;

    this.isDragging = false;
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

    // Pointer drag handling
    const startDrag = (e) => {
      // Do not initiate drag if user clicked directly on tool buttons, color swatches, or inputs
      if (e.target.closest('button:not(#quickBarCollapseBtn), input, label, .quick-dot')) {
        return;
      }

      this.isDragging = true;
      this.hasMoved = false;
      this.dock.classList.add('is-dragging');
      if (this.handle) this.handle.style.cursor = 'grabbing';

      const rect = this.dock.getBoundingClientRect();
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.initialLeft = rect.left;
      this.initialTop = rect.top;

      // Switch from bottom/left:50% CSS transforms to fixed top/left coordinates
      this.dock.style.bottom = 'auto';
      this.dock.style.transform = 'none';
      this.dock.style.left = `${this.initialLeft}px`;
      this.dock.style.top = `${this.initialTop}px`;

      e.preventDefault();
      if (e.pointerId && this.dock.setPointerCapture) {
        try { this.dock.setPointerCapture(e.pointerId); } catch (_) {}
      }
    };

    const onDrag = (e) => {
      if (!this.isDragging) return;
      this.hasMoved = true;

      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;

      let newLeft = this.initialLeft + dx;
      let newTop = this.initialTop + dy;

      // Keep dock within viewport boundaries with 8px safe margin
      const dockWidth = this.dock.offsetWidth;
      const dockHeight = this.dock.offsetHeight;
      const maxLeft = window.innerWidth - dockWidth - 8;
      const maxTop = window.innerHeight - dockHeight - 8;

      newLeft = Math.max(8, Math.min(newLeft, maxLeft));
      newTop = Math.max(50, Math.min(newTop, maxTop)); // 50px below top header

      this.dock.style.left = `${newLeft}px`;
      this.dock.style.top = `${newTop}px`;
    };

    const stopDrag = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.dock.classList.remove('is-dragging');
      if (this.handle) this.handle.style.cursor = 'grab';

      if (e.pointerId && this.dock.releasePointerCapture) {
        try { this.dock.releasePointerCapture(e.pointerId); } catch (_) {}
      }

      if (this.hasMoved) {
        this.savePosition();
      }
    };

    // Attach listeners
    if (this.handle) {
      this.handle.addEventListener('pointerdown', startDrag);
    }

    this.dock.addEventListener('pointerdown', (e) => {
      // Allow dragging anywhere on the dock bar body that isn't a tool button or swatch
      if (!e.target.closest('button, input, label, .quick-dot, .quick-tools, .quick-colors')) {
        startDrag(e);
      }
    });

    window.addEventListener('pointermove', onDrag);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

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

  toggleMinimize(force = null) {
    const isMin = force !== null ? force : !this.dock.classList.contains('minimized');
    this.dock.classList.toggle('minimized', isMin);
    if (this.collapseBtn) {
      this.collapseBtn.innerHTML = isMin ? '<i class="fa-solid fa-chevron-up"></i>' : '<i class="fa-solid fa-chevron-down"></i>';
      this.collapseBtn.title = isMin ? 'Expand Toolbar' : 'Minimize Toolbar';
    }
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
        if (typeof pos.left === 'number' && typeof pos.top === 'number') {
          this.dock.style.bottom = 'auto';
          this.dock.style.transform = 'none';
          this.dock.style.left = `${pos.left}px`;
          this.dock.style.top = `${pos.top}px`;
          setTimeout(() => this.constrainToViewport(), 80);
        }
      }
    } catch (_) {}
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

      this.dock.style.left = `${curLeft}px`;
      this.dock.style.top = `${curTop}px`;
    }
  }

  resetPosition() {
    try { localStorage.removeItem(this.storageKey); } catch (_) {}
    this.dock.style.left = '50%';
    this.dock.style.bottom = '22px';
    this.dock.style.top = 'auto';
    this.dock.style.transform = 'translateX(-50%)';
  }
}

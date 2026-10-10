/**
 * The Craft — Timeline UI Component
 * Provides horizontal frame strip, thumbnail previews, playback controls,
 * frame reordering, duplicate, delete, copy/paste, and onion skin toggles.
 */
import { events } from '../core/EventBus.js';

export class TimelineUI {
  constructor(container, project, exporter, callbacks = {}) {
    this.container = container;
    this.project = project;
    this.exporter = exporter;
    this.callbacks = callbacks; // onSelectFrame, onFrameChanged, onPlaybackStateChange

    this.isPlaying = false;
    this.playbackTimer = null;
    this.lastFrameTime = 0;

    this.draggedFrameIndex = null;

    this.initDOM();
    this.render();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="timeline-bar">
        <!-- Playback & Frame Navigation -->
        <div class="timeline-playback-controls">
          <button id="animFirstFrameBtn" class="timeline-btn" title="First Frame (Home)">
            <i class="fa-solid fa-backward-step"></i>
          </button>
          <button id="animPrevFrameBtn" class="timeline-btn" title="Previous Frame (Left Arrow)">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <button id="animPlayPauseBtn" class="timeline-btn play-btn" title="Play / Pause (Space)">
            <i class="fa-solid fa-play"></i>
          </button>
          <button id="animNextFrameBtn" class="timeline-btn" title="Next Frame (Right Arrow)">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
          <button id="animLastFrameBtn" class="timeline-btn" title="Last Frame (End)">
            <i class="fa-solid fa-forward-step"></i>
          </button>

          <div class="timeline-separator"></div>

          <!-- Loop Toggle -->
          <button id="animLoopBtn" class="timeline-btn toggle-btn active" title="Toggle Loop Playback">
            <i class="fa-solid fa-repeat"></i>
            <span>Loop</span>
          </button>

          <!-- FPS Selector -->
          <div class="fps-control" title="Frames Per Second (Playback Speed)">
            <label for="animFpsInput"><i class="fa-solid fa-gauge-high"></i></label>
            <input type="number" id="animFpsInput" min="1" max="60" value="${this.project.fps}">
            <span class="fps-unit">FPS</span>
          </div>

          <!-- Frame Counter Indicator -->
          <span id="animFrameIndicator" class="frame-indicator">Frame 1 / 1</span>
        </div>

        <!-- Frame Action Buttons -->
        <div class="timeline-action-controls">
          <!-- Onion Skin Toggle & Popover Trigger -->
          <button id="animOnionToggleBtn" class="timeline-btn toggle-btn active" title="Toggle Onion Skin Overlay (O)">
            <i class="fa-solid fa-layer-group"></i>
            <span>Onion Skin</span>
          </button>

          <div class="timeline-separator"></div>

          <!-- Frame Operations -->
          <button id="animNewBlankFrameBtn" class="timeline-btn highlight" title="Add New Blank Frame (+)">
            <i class="fa-solid fa-plus"></i>
            <span>New Frame</span>
          </button>
          <button id="animDuplicateFrameBtn" class="timeline-btn" title="Duplicate Active Frame">
            <i class="fa-regular fa-copy"></i>
            <span>Duplicate</span>
          </button>
          <button id="animCopyFrameBtn" class="timeline-btn" title="Copy Frame">
            <i class="fa-solid fa-paste"></i>
            <span>Copy</span>
          </button>
          <button id="animPasteFrameBtn" class="timeline-btn" title="Paste Frame">
            <i class="fa-solid fa-file-import"></i>
            <span>Paste</span>
          </button>
          <button id="animMoveLeftBtn" class="timeline-btn" title="Move Frame Left">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <button id="animMoveRightBtn" class="timeline-btn" title="Move Frame Right">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
          <button id="animDeleteFrameBtn" class="timeline-btn danger" title="Delete Active Frame (Del)">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>

      <!-- Frames Track Strip -->
      <div class="timeline-track-wrapper">
        <div class="timeline-track" id="timelineTrack"></div>
      </div>
    `;

    this.bindControls();
  }

  bindControls() {
    const playPauseBtn = this.container.querySelector('#animPlayPauseBtn');
    const firstFrameBtn = this.container.querySelector('#animFirstFrameBtn');
    const prevFrameBtn = this.container.querySelector('#animPrevFrameBtn');
    const nextFrameBtn = this.container.querySelector('#animNextFrameBtn');
    const lastFrameBtn = this.container.querySelector('#animLastFrameBtn');
    const loopBtn = this.container.querySelector('#animLoopBtn');
    const fpsInput = this.container.querySelector('#animFpsInput');
    const onionToggleBtn = this.container.querySelector('#animOnionToggleBtn');

    const newBlankBtn = this.container.querySelector('#animNewBlankFrameBtn');
    const duplicateBtn = this.container.querySelector('#animDuplicateFrameBtn');
    const copyBtn = this.container.querySelector('#animCopyFrameBtn');
    const pasteBtn = this.container.querySelector('#animPasteFrameBtn');
    const moveLeftBtn = this.container.querySelector('#animMoveLeftBtn');
    const moveRightBtn = this.container.querySelector('#animMoveRightBtn');
    const deleteBtn = this.container.querySelector('#animDeleteFrameBtn');

    // Playback
    playPauseBtn.addEventListener('click', () => this.togglePlayback());
    firstFrameBtn.addEventListener('click', () => this.goToFrame(0));
    prevFrameBtn.addEventListener('click', () => this.stepFrame(-1));
    nextFrameBtn.addEventListener('click', () => this.stepFrame(1));
    lastFrameBtn.addEventListener('click', () => this.goToFrame(this.project.frames.length - 1));

    // Loop
    loopBtn.addEventListener('click', () => {
      this.project.loop = !this.project.loop;
      loopBtn.classList.toggle('active', this.project.loop);
      events.emit('toast', { message: `Loop playback: ${this.project.loop ? 'ON' : 'OFF'}` });
    });

    // FPS
    fpsInput.addEventListener('change', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 60) val = 60;
      this.project.fps = val;
      e.target.value = val;
      if (this.isPlaying) {
        this.restartPlaybackTimer();
      }
    });

    // Onion Skin
    onionToggleBtn.addEventListener('click', () => {
      if (this.callbacks.onToggleOnionSkin) {
        const active = this.callbacks.onToggleOnionSkin();
        onionToggleBtn.classList.toggle('active', active);
      }
    });

    // Frame Operations
    newBlankBtn.addEventListener('click', () => {
      this.pause();
      const newFrame = this.project.addFrame();
      this.render();
      if (this.callbacks.onSelectFrame) {
        this.callbacks.onSelectFrame(this.project.currentFrameIndex);
      }
      events.emit('toast', { message: `Added ${newFrame.name}` });
      if (this.callbacks.onFrameChanged) this.callbacks.onFrameChanged();
    });

    duplicateBtn.addEventListener('click', () => {
      this.pause();
      const cloned = this.project.duplicateFrame();
      if (cloned) {
        this.render();
        if (this.callbacks.onSelectFrame) {
          this.callbacks.onSelectFrame(this.project.currentFrameIndex);
        }
        events.emit('toast', { message: `Duplicated to ${cloned.name}` });
        if (this.callbacks.onFrameChanged) this.callbacks.onFrameChanged();
      }
    });

    copyBtn.addEventListener('click', () => {
      const copied = this.project.copyFrame();
      if (copied) {
        events.emit('toast', { message: `Copied ${copied.name}` });
      }
    });

    pasteBtn.addEventListener('click', () => {
      this.pause();
      const pasted = this.project.pasteFrame();
      if (pasted) {
        this.render();
        if (this.callbacks.onSelectFrame) {
          this.callbacks.onSelectFrame(this.project.currentFrameIndex);
        }
        events.emit('toast', { message: `Pasted ${pasted.name}` });
        if (this.callbacks.onFrameChanged) this.callbacks.onFrameChanged();
      } else {
        events.emit('toast', { message: 'Clipboard is empty. Copy a frame first.', type: 'warning' });
      }
    });

    moveLeftBtn.addEventListener('click', () => {
      const cur = this.project.currentFrameIndex;
      if (cur > 0) {
        this.project.moveFrame(cur, cur - 1);
        this.render();
        if (this.callbacks.onSelectFrame) {
          this.callbacks.onSelectFrame(this.project.currentFrameIndex);
        }
        if (this.callbacks.onFrameChanged) this.callbacks.onFrameChanged();
      }
    });

    moveRightBtn.addEventListener('click', () => {
      const cur = this.project.currentFrameIndex;
      if (cur < this.project.frames.length - 1) {
        this.project.moveFrame(cur, cur + 1);
        this.render();
        if (this.callbacks.onSelectFrame) {
          this.callbacks.onSelectFrame(this.project.currentFrameIndex);
        }
        if (this.callbacks.onFrameChanged) this.callbacks.onFrameChanged();
      }
    });

    deleteBtn.addEventListener('click', () => {
      this.confirmDeleteFrame();
    });
  }

  confirmDeleteFrame() {
    if (this.project.frames.length <= 1) {
      events.emit('toast', { message: 'Cannot delete the only frame in the animation', type: 'warning' });
      return;
    }

    const cur = this.project.currentFrameIndex;
    const frame = this.project.frames[cur];

    // Confirmation dialog before deleting
    if (confirm(`Are you sure you want to delete "${frame.name}"? This cannot be undone.`)) {
      this.pause();
      this.project.deleteFrame(cur);
      this.render();
      if (this.callbacks.onSelectFrame) {
        this.callbacks.onSelectFrame(this.project.currentFrameIndex);
      }
      events.emit('toast', { message: `Deleted ${frame.name}` });
      if (this.callbacks.onFrameChanged) this.callbacks.onFrameChanged();
    }
  }

  render() {
    const track = this.container.querySelector('#timelineTrack');
    if (!track) return;

    track.innerHTML = '';
    const frames = this.project.frames;
    const currentIdx = this.project.currentFrameIndex;

    this.updateFrameIndicator();

    frames.forEach((frame, idx) => {
      const card = document.createElement('div');
      card.className = `frame-card ${idx === currentIdx ? 'active' : ''}`;
      card.draggable = true;
      card.dataset.index = idx;

      // Header with frame number
      const header = document.createElement('div');
      header.className = 'frame-card-header';
      header.innerHTML = `
        <span class="frame-number">#${idx + 1}</span>
        <div class="frame-mini-actions">
          <button class="mini-btn duplicate-mini" title="Duplicate frame"><i class="fa-regular fa-copy"></i></button>
          ${frames.length > 1 ? '<button class="mini-btn delete-mini" title="Delete frame"><i class="fa-regular fa-trash-can"></i></button>' : ''}
        </div>
      `;

      // Mini actions handlers
      const dupMini = header.querySelector('.duplicate-mini');
      if (dupMini) {
        dupMini.addEventListener('click', (e) => {
          e.stopPropagation();
          this.project.duplicateFrame(idx);
          this.render();
          if (this.callbacks.onSelectFrame) this.callbacks.onSelectFrame(this.project.currentFrameIndex);
          if (this.callbacks.onFrameChanged) this.callbacks.onFrameChanged();
        });
      }

      const delMini = header.querySelector('.delete-mini');
      if (delMini) {
        delMini.addEventListener('click', (e) => {
          e.stopPropagation();
          this.project.setCurrentFrame(idx);
          this.confirmDeleteFrame();
        });
      }

      // Thumbnail Canvas
      const thumb = document.createElement('canvas');
      thumb.className = 'frame-thumb';
      thumb.width = 112;
      thumb.height = 68;
      this.drawThumbnail(thumb, frame);

      card.appendChild(header);
      card.appendChild(thumb);

      // Select frame on click
      card.addEventListener('click', () => {
        if (this.isPlaying) this.pause();
        this.goToFrame(idx);
      });

      // Drag and Drop reordering
      card.addEventListener('dragstart', (e) => {
        this.draggedFrameIndex = idx;
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.draggedFrameIndex = null;
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        if (this.draggedFrameIndex !== null && this.draggedFrameIndex !== idx) {
          this.project.moveFrame(this.draggedFrameIndex, idx);
          this.render();
          if (this.callbacks.onSelectFrame) this.callbacks.onSelectFrame(this.project.currentFrameIndex);
          if (this.callbacks.onFrameChanged) this.callbacks.onFrameChanged();
        }
      });

      track.appendChild(card);
    });

    // Scroll active frame card into view smoothly
    const activeCard = track.querySelector('.frame-card.active');
    if (activeCard) {
      activeCard.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }

  drawThumbnail(canvas, frame) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Background checkerboard or solid color
    ctx.fillStyle = this.project.backgroundColor === 'transparent' ? '#1a1d2d' : this.project.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    const scaleX = w / Math.max(1, this.project.width);
    const scaleY = h / Math.max(1, this.project.height);
    const scale = Math.min(scaleX, scaleY);

    ctx.save();
    ctx.scale(scale, scale);

    frame.layers.forEach(l => {
      if (!l.visible) return;
      ctx.save();
      ctx.globalAlpha = l.opacity !== undefined ? l.opacity : 1.0;
      ctx.globalCompositeOperation = l.blendMode || 'source-over';

      if (l.rasterCanvas) {
        ctx.drawImage(l.rasterCanvas, 0, 0);
      }
      if (l.elements && l.elements.length > 0) {
        l.elements.forEach(el => this.exporter.renderElement(ctx, el));
      }
      ctx.restore();
    });

    ctx.restore();
  }

  updateActiveThumbnail() {
    const cur = this.project.currentFrameIndex;
    const track = this.container.querySelector('#timelineTrack');
    if (!track) return;
    const card = track.querySelector(`.frame-card[data-index="${cur}"]`);
    if (card) {
      const thumb = card.querySelector('canvas.frame-thumb');
      if (thumb) {
        this.drawThumbnail(thumb, this.project.getCurrentFrame());
      }
    }
  }

  updateFrameIndicator() {
    const el = this.container.querySelector('#animFrameIndicator');
    if (el) {
      el.textContent = `Frame ${this.project.currentFrameIndex + 1} / ${this.project.frames.length}`;
    }
  }

  goToFrame(index) {
    if (this.project.setCurrentFrame(index)) {
      this.updateActiveCardHighlight();
      this.updateFrameIndicator();
      if (this.callbacks.onSelectFrame) {
        this.callbacks.onSelectFrame(index);
      }
    }
  }

  stepFrame(delta) {
    const total = this.project.frames.length;
    let next = this.project.currentFrameIndex + delta;
    if (next < 0) {
      next = this.project.loop ? total - 1 : 0;
    } else if (next >= total) {
      next = this.project.loop ? 0 : total - 1;
    }
    this.goToFrame(next);
  }

  updateActiveCardHighlight() {
    const track = this.container.querySelector('#timelineTrack');
    if (!track) return;

    track.querySelectorAll('.frame-card').forEach((card, idx) => {
      if (idx === this.project.currentFrameIndex) {
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      } else {
        card.classList.remove('active');
      }
    });
  }

  // ==========================================
  // Real-Time Playback Engine
  // ==========================================
  togglePlayback() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    const btn = this.container.querySelector('#animPlayPauseBtn');
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      btn.classList.add('playing');
    }

    if (this.callbacks.onPlaybackStateChange) {
      this.callbacks.onPlaybackStateChange(true);
    }

    this.startPlaybackLoop();
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    const btn = this.container.querySelector('#animPlayPauseBtn');
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-play"></i>';
      btn.classList.remove('playing');
    }

    if (this.callbacks.onPlaybackStateChange) {
      this.callbacks.onPlaybackStateChange(false);
    }

    // Restore full editor state and onion skinning on current frame
    if (this.callbacks.onSelectFrame) {
      this.callbacks.onSelectFrame(this.project.currentFrameIndex);
    }
  }

  startPlaybackLoop() {
    if (!this.isPlaying) return;

    const fps = Math.max(1, this.project.fps);
    const delayMs = 1000 / fps;

    const tick = () => {
      if (!this.isPlaying) return;

      const total = this.project.frames.length;
      let next = this.project.currentFrameIndex + 1;

      if (next >= total) {
        if (this.project.loop) {
          next = 0;
        } else {
          this.pause();
          return;
        }
      }

      this.goToFrame(next);
      this.playbackTimer = setTimeout(tick, delayMs);
    };

    this.playbackTimer = setTimeout(tick, delayMs);
  }

  restartPlaybackTimer() {
    if (!this.isPlaying) return;
    if (this.playbackTimer) clearTimeout(this.playbackTimer);
    this.startPlaybackLoop();
  }
}

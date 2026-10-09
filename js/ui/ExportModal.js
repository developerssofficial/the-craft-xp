/**
 * The Craft — Export & Import Manager
 * Handles composite export (PNG, JPG, Clipboard) and image imports onto the active layer.
 */
import { events } from '../core/EventBus.js';
import { DrawCommand } from '../core/commands/DrawCommand.js';

export class ExportModal {
  constructor(elements, doc, renderer, commandManager) {
    this.exportDropdownBtn = elements.exportDropdownBtn;
    this.exportDropdownWrap = elements.exportDropdownWrap;
    this.savePngBtn = elements.savePngBtn;
    this.saveJpgBtn = elements.saveJpgBtn;
    this.copyClipboardBtn = elements.copyClipboardBtn;
    this.imageUploadInput = elements.imageUploadInput;

    this.doc = doc;
    this.renderer = renderer;
    this.commandManager = commandManager;

    this.init();
  }

  init() {
    // 1. Export Dropdown toggle
    if (this.exportDropdownBtn && this.exportDropdownWrap) {
      this.exportDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exportDropdownWrap.classList.toggle('active');
      });

      document.addEventListener('click', (e) => {
        if (!this.exportDropdownWrap.contains(e.target)) {
          this.exportDropdownWrap.classList.remove('active');
        }
      });
    }

    // 2. Export as PNG
    if (this.savePngBtn) {
      this.savePngBtn.addEventListener('click', () => {
        this.exportDropdownWrap.classList.remove('active');
        this.exportImage('png');
      });
    }

    // 3. Export as JPG
    if (this.saveJpgBtn) {
      this.saveJpgBtn.addEventListener('click', () => {
        this.exportDropdownWrap.classList.remove('active');
        this.exportImage('jpeg');
      });
    }

    // 4. Copy to Clipboard
    if (this.copyClipboardBtn) {
      this.copyClipboardBtn.addEventListener('click', () => {
        this.exportDropdownWrap.classList.remove('active');
        this.copyToClipboard();
      });
    }

    // 5. Image Upload / Import
    if (this.imageUploadInput) {
      this.imageUploadInput.addEventListener('change', (e) => this.handleImageImport(e));
    }
  }

  async exportImage(format = 'png') {
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await this.renderer.exportCompositeBlob(mime, 0.95, this.doc.backgroundColor === 'transparent');
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `TheCraft_${Date.now()}.${format === 'jpeg' ? 'jpg' : 'png'}`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);

    events.emit('toast', { message: `${format.toUpperCase()} Exported successfully` });
  }

  async copyToClipboard() {
    try {
      const blob = await this.renderer.exportCompositeBlob('image/png', 1.0, true);
      if (!blob) return;

      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        events.emit('toast', { message: 'Copied to clipboard! (Ctrl+V to paste)' });
      } else {
        events.emit('toast', { message: 'Clipboard API not supported in this browser', type: 'warning' });
      }
    } catch (err) {
      console.error('Clipboard copy error:', err);
      events.emit('toast', { message: 'Failed to copy to clipboard', type: 'danger' });
    }
  }

  handleImageImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = this.doc.width * 0.7;
        const maxHeight = this.doc.height * 0.7;
        let w = img.width;
        let h = img.height;

        if (w > maxWidth || h > maxHeight) {
          const ratio = Math.min(maxWidth / w, maxHeight / h);
          w *= ratio;
          h *= ratio;
        }

        const x = (this.doc.width - w) / 2;
        const y = (this.doc.height - h) / 2;

        const imgEl = {
          type: 'image',
          src: event.target.result,
          imgElement: img,
          x,
          y,
          width: w,
          height: h,
          opacity: 1.0
        };

        const activeLayer = this.doc.getActiveLayer();
        this.commandManager.execute(new DrawCommand(this.doc, activeLayer.id, imgEl));
        events.emit('toast', { message: 'Image imported to active layer' });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  }
}

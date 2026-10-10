/**
 * The Craft — Animation Exporter Engine
 * Provides genuine, client-side export for:
 * 1. Animated GIF (native GIF89a encoder)
 * 2. WebM / MP4 Video (MediaRecorder + canvas.captureStream)
 * 3. PNG Sequence ZIP (pure JS PKZIP packager)
 * 4. Spritesheet PNG (stitched grid of all frames)
 * 5. Current Frame PNG (lossless snapshot)
 */
import { events } from '../core/EventBus.js';

export class AnimationExporter {
  constructor(project) {
    this.project = project;
  }

  /**
   * Renders a specific frame to an offscreen canvas
   * (Does NOT include onion skinning)
   */
  renderFrameToCanvas(frame, width = this.project.width, height = this.project.height, transparentBg = false) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Background
    if (!transparentBg && this.project.backgroundColor !== 'transparent') {
      ctx.fillStyle = this.project.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Visible layers
    const layerBuffer = document.createElement('canvas');
    layerBuffer.width = width;
    layerBuffer.height = height;
    const lbCtx = layerBuffer.getContext('2d');

    frame.layers.forEach(layer => {
      if (!layer.visible) return;

      lbCtx.clearRect(0, 0, width, height);

      if (layer.rasterCanvas) {
        lbCtx.drawImage(layer.rasterCanvas, 0, 0, width, height);
      }
      if (layer.elements && layer.elements.length > 0) {
        layer.elements.forEach(el => this.renderElement(lbCtx, el));
      }

      ctx.save();
      ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
      ctx.globalCompositeOperation = layer.blendMode || 'source-over';
      ctx.drawImage(layerBuffer, 0, 0);
      ctx.restore();
    });

    return canvas;
  }

  renderElement(ctx, el) {
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1.0;

    switch (el.type) {
      case 'stroke':
        this.renderStroke(ctx, el);
        break;
      case 'shape':
        this.renderShape(ctx, el);
        break;
      case 'text':
        this.renderText(ctx, el);
        break;
      case 'stamp':
        this.renderStamp(ctx, el);
        break;
    }
    ctx.restore();
  }

  renderStroke(ctx, el) {
    if (!el.points || el.points.length === 0) return;
    const pts = el.points;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = el.color || '#6366f1';
    ctx.lineWidth = el.size || 6;

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, (el.size || 6) / 2, 0, Math.PI * 2);
      ctx.fillStyle = el.color || '#6366f1';
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  renderShape(ctx, el) {
    ctx.save();
    ctx.strokeStyle = el.color || '#6366f1';
    ctx.lineWidth = el.size || 4;
    ctx.fillStyle = el.fillColor || el.color;

    const { startX, startY, endX, endY, shape } = el;
    const w = endX - startX;
    const h = endY - startY;

    ctx.beginPath();
    if (shape === 'rectangle') {
      if (el.filled) ctx.fillRect(startX, startY, w, h);
      ctx.strokeRect(startX, startY, w, h);
    } else if (shape === 'circle') {
      const rx = Math.abs(w / 2);
      const ry = Math.abs(h / 2);
      const cx = startX + w / 2;
      const cy = startY + h / 2;
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (el.filled) ctx.fill();
      ctx.stroke();
    } else if (shape === 'line') {
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderText(ctx, el) {
    ctx.save();
    ctx.fillStyle = el.color || '#ffffff';
    ctx.font = `${el.fontSize || 32}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(el.text, el.x, el.y);
    ctx.restore();
  }

  renderStamp(ctx, el) {
    ctx.save();
    ctx.font = `${el.size || 48}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.stamp || '⭐', el.x, el.y);
    ctx.restore();
  }

  // ==========================================
  // 1. Export Current Frame as PNG
  // ==========================================
  async exportCurrentFramePNG(frameIndex = this.project.currentFrameIndex) {
    const frame = this.project.frames[frameIndex];
    if (!frame) return;

    const canvas = this.renderFrameToCanvas(frame);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const filename = `${this.project.name}_frame_${frameIndex + 1}.png`;
    this.downloadBlob(blob, filename);
    events.emit('toast', { message: `Exported ${filename}` });
  }

  // ==========================================
  // 2. Export All Frames as PNG Sequence ZIP
  // ==========================================
  async exportPNGSequenceZIP(progressCallback = null) {
    const frames = this.project.frames;
    const files = [];

    for (let i = 0; i < frames.length; i++) {
      if (progressCallback) progressCallback(i + 1, frames.length, 'Rendering PNG frames...');
      const canvas = this.renderFrameToCanvas(frames[i]);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const buffer = await blob.arrayBuffer();
      const numStr = String(i + 1).padStart(3, '0');
      files.push({
        name: `frame_${numStr}.png`,
        data: new Uint8Array(buffer)
      });
    }

    if (progressCallback) progressCallback(frames.length, frames.length, 'Packing ZIP archive...');
    const zipBlob = this.createZipArchive(files);
    const filename = `${this.project.name}_frames.zip`;
    this.downloadBlob(zipBlob, filename);
    events.emit('toast', { message: `Exported PNG Sequence (${frames.length} frames)` });
  }

  // ==========================================
  // 3. Export as Spritesheet PNG
  // ==========================================
  async exportSpritesheet(columns = null) {
    const frames = this.project.frames;
    const count = frames.length;
    const cols = columns || Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    const fw = this.project.width;
    const fh = this.project.height;

    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = cols * fw;
    sheetCanvas.height = rows * fh;
    const sCtx = sheetCanvas.getContext('2d');

    // Optional background
    if (this.project.backgroundColor !== 'transparent') {
      sCtx.fillStyle = this.project.backgroundColor;
      sCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
    }

    for (let i = 0; i < count; i++) {
      const frameCanvas = this.renderFrameToCanvas(frames[i]);
      const col = i % cols;
      const row = Math.floor(i / cols);
      sCtx.drawImage(frameCanvas, col * fw, row * fh);
    }

    const blob = await new Promise(res => sheetCanvas.toBlob(res, 'image/png'));
    const filename = `${this.project.name}_spritesheet_${cols}x${rows}.png`;
    this.downloadBlob(blob, filename);
    events.emit('toast', { message: `Exported Spritesheet (${cols}x${rows})` });
  }

  // ==========================================
  // 4. Export as WebM / MP4 Video via MediaRecorder
  // ==========================================
  async exportVideo(loops = 2, progressCallback = null) {
    const frames = this.project.frames;
    const fps = Math.max(1, this.project.fps);
    const frameDurationMs = 1000 / fps;

    const recordCanvas = document.createElement('canvas');
    recordCanvas.width = this.project.width;
    recordCanvas.height = this.project.height;
    const rCtx = recordCanvas.getContext('2d');

    // Check supported MIME type
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4';
        }
      }
    }

    const stream = recordCanvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const completionPromise = new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: mimeType });
        resolve(videoBlob);
      };
      recorder.onerror = (err) => reject(err);
    });

    recorder.start();

    // Render frames sequentially
    const totalSteps = frames.length * loops;
    let step = 0;

    for (let l = 0; l < loops; l++) {
      for (let f = 0; f < frames.length; f++) {
        step++;
        if (progressCallback) {
          progressCallback(step, totalSteps, `Recording video frame ${f + 1}/${frames.length}...`);
        }
        const fc = this.renderFrameToCanvas(frames[f]);
        rCtx.clearRect(0, 0, recordCanvas.width, recordCanvas.height);
        rCtx.drawImage(fc, 0, 0);

        // Wait one frame duration
        await new Promise(r => setTimeout(r, frameDurationMs));
      }
    }

    // Allow recorder buffer to flush
    await new Promise(r => setTimeout(r, 200));
    recorder.stop();

    const blob = await completionPromise;
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const filename = `${this.project.name}_${fps}fps.${ext}`;
    this.downloadBlob(blob, filename);
    events.emit('toast', { message: `Exported Video (${ext.toUpperCase()})` });
  }

  // ==========================================
  // 5. Genuine Client-Side Animated GIF Export
  // ==========================================
  async exportAnimatedGIF(progressCallback = null) {
    const frames = this.project.frames;
    const fps = Math.max(1, this.project.fps);
    // Delay in centiseconds (1/100 sec)
    const delayCenti = Math.max(2, Math.round(100 / fps));

    const width = this.project.width;
    const height = this.project.height;

    // Render each frame image data
    const frameDataList = [];
    for (let i = 0; i < frames.length; i++) {
      if (progressCallback) progressCallback(i + 1, frames.length + 2, `Preparing frame ${i + 1}/${frames.length}...`);
      const fc = this.renderFrameToCanvas(frames[i]);
      const imgData = fc.getContext('2d').getImageData(0, 0, width, height);
      frameDataList.push(imgData);
    }

    if (progressCallback) progressCallback(frames.length + 1, frames.length + 2, 'Encoding GIF stream...');

    const gifBytes = this.encodeGIF89a(frameDataList, width, height, delayCenti);
    const blob = new Blob([gifBytes], { type: 'image/gif' });
    const filename = `${this.project.name}_${fps}fps.gif`;
    this.downloadBlob(blob, filename);

    if (progressCallback) progressCallback(frames.length + 2, frames.length + 2, 'Done!');
    events.emit('toast', { message: `Exported Animated GIF (${frames.length} frames)` });
  }

  /**
   * Pure JavaScript GIF89a Multi-Frame Encoder
   * Builds valid GIF binary with Graphic Control Blocks, Netscape 2.0 loop, and LZW.
   */
  encodeGIF89a(frameDataList, width, height, delayCenti) {
    const bytes = [];
    const writeByte = (b) => bytes.push(b & 0xff);
    const writeShort = (s) => {
      bytes.push(s & 0xff);
      bytes.push((s >> 8) & 0xff);
    };
    const writeString = (str) => {
      for (let i = 0; i < str.length; i++) writeByte(str.charCodeAt(i));
    };

    // 1. GIF89a Header
    writeString('GIF89a');

    // 2. Logical Screen Descriptor
    writeShort(width);
    writeShort(height);
    // Packed fields: Global Color Table Flag = 0 (we use local color tables for best per-frame palette fidelity)
    writeByte(0x70); // 8-bit color resolution, no GCT
    writeByte(0x00); // Background Color Index
    writeByte(0x00); // Pixel Aspect Ratio

    // 3. Netscape 2.0 Looping Application Extension
    writeByte(0x21); // Extension Introducer
    writeByte(0xff); // App Extension Label
    writeByte(0x0b); // Block Size (11)
    writeString('NETSCAPE2.0');
    writeByte(0x03); // Sub-block data size
    writeByte(0x01); // Sub-block ID
    writeShort(0x0000); // Infinite loop (0 = forever)
    writeByte(0x00); // Block Terminator

    // 4. Encode Each Frame
    for (let f = 0; f < frameDataList.length; f++) {
      const imgData = frameDataList[f];
      const { palette, indexedPixels, transparentIndex } = this.quantizeFrame(imgData.data, width, height);

      // Graphic Control Extension (Delay, Disposal, Transparency)
      writeByte(0x21); // Extension Introducer
      writeByte(0xf9); // Graphic Control Label
      writeByte(0x04); // Byte Size (4)
      const hasTransparent = transparentIndex !== -1;
      const packedFields = (2 << 2) | (hasTransparent ? 1 : 0); // Disposal = 2 (Restore to background)
      writeByte(packedFields);
      writeShort(delayCenti); // Delay Time in 1/100s
      writeByte(hasTransparent ? transparentIndex : 0); // Transparent Color Index
      writeByte(0x00); // Block Terminator

      // Image Descriptor
      writeByte(0x2c); // Image Separator
      writeShort(0);   // Image Left
      writeShort(0);   // Image Top
      writeShort(width);
      writeShort(height);
      // Local Color Table Flag = 1, Interlace = 0, Sorted = 0, Size = 7 (2^(7+1) = 256 colors)
      writeByte(0x87);

      // Local Color Table (256 * 3 bytes)
      for (let c = 0; c < 256; c++) {
        if (c < palette.length) {
          writeByte(palette[c][0]);
          writeByte(palette[c][1]);
          writeByte(palette[c][2]);
        } else {
          writeByte(0);
          writeByte(0);
          writeByte(0);
        }
      }

      // LZW Raster Data
      const lzwMinCodeSize = 8;
      writeByte(lzwMinCodeSize);
      this.lzwEncode(indexedPixels, lzwMinCodeSize, writeByte);
      writeByte(0x00); // Block Terminator
    }

    // 5. GIF Trailer
    writeByte(0x3b);

    return new Uint8Array(bytes);
  }

  /**
   * Color Quantizer & Palette Generator for a frame
   */
  quantizeFrame(rgba, width, height) {
    const totalPixels = width * height;
    const colorMap = new Map();
    const palette = [];
    const indexedPixels = new Uint8Array(totalPixels);
    let transparentIndex = -1;

    // Check if image has transparency
    for (let i = 0; i < totalPixels; i++) {
      const a = rgba[i * 4 + 3];
      if (a < 128) {
        transparentIndex = 0;
        palette.push([0, 0, 0]); // transparent color slot
        break;
      }
    }

    // Fast median / frequency sampling
    for (let i = 0; i < totalPixels; i++) {
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      const a = rgba[i * 4 + 3];

      if (a < 128 && transparentIndex !== -1) {
        indexedPixels[i] = transparentIndex;
        continue;
      }

      // Quantize to 5-bit color space for fast palette fitting
      const qr = (r >> 3) << 3;
      const qg = (g >> 3) << 3;
      const qb = (b >> 3) << 3;
      const key = (qr << 16) | (qg << 8) | qb;

      let idx = colorMap.get(key);
      if (idx === undefined) {
        if (palette.length < 256) {
          idx = palette.length;
          palette.push([r, g, b]);
          colorMap.set(key, idx);
        } else {
          // Find nearest color in palette
          let minDist = Infinity;
          let bestIdx = 0;
          for (let p = 0; p < palette.length; p++) {
            const dr = r - palette[p][0];
            const dg = g - palette[p][1];
            const db = b - palette[p][2];
            const dist = dr * dr + dg * dg + db * db;
            if (dist < minDist) {
              minDist = dist;
              bestIdx = p;
            }
          }
          idx = bestIdx;
        }
      }
      indexedPixels[i] = idx;
    }

    // Pad palette to 256 colors
    while (palette.length < 256) {
      palette.push([0, 0, 0]);
    }

    return { palette, indexedPixels, transparentIndex };
  }

  /**
   * LZW Encoder for GIF raster data
   */
  lzwEncode(pixels, minCodeSize, writeByte) {
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let maxCode = 1 << codeSize;
    let nextCode = eoiCode + 1;

    const dict = new Map();

    const resetDict = () => {
      dict.clear();
      codeSize = minCodeSize + 1;
      maxCode = 1 << codeSize;
      nextCode = eoiCode + 1;
    };

    const buffer = [];
    let curBit = 0;
    let curVal = 0;

    const writeCode = (code) => {
      curVal |= code << curBit;
      curBit += codeSize;
      while (curBit >= 8) {
        buffer.push(curVal & 0xff);
        curVal >>= 8;
        curBit -= 8;
      }
    };

    const flushBuffer = () => {
      if (curBit > 0) {
        buffer.push(curVal & 0xff);
        curBit = 0;
        curVal = 0;
      }
      // Write sub-blocks of at most 254 bytes
      let pos = 0;
      while (pos < buffer.length) {
        const chunk = Math.min(254, buffer.length - pos);
        writeByte(chunk);
        for (let i = 0; i < chunk; i++) {
          writeByte(buffer[pos + i]);
        }
        pos += chunk;
      }
      buffer.length = 0;
    };

    writeCode(clearCode);

    if (pixels.length > 0) {
      let cur = pixels[0];
      for (let i = 1; i < pixels.length; i++) {
        const next = pixels[i];
        const key = (cur << 16) | next;
        if (dict.has(key)) {
          cur = dict.get(key);
        } else {
          writeCode(cur);
          if (nextCode < 4096) {
            dict.set(key, nextCode++);
            if (nextCode >= maxCode && codeSize < 12) {
              codeSize++;
              maxCode = 1 << codeSize;
            }
          } else {
            writeCode(clearCode);
            resetDict();
          }
          cur = next;
        }
      }
      writeCode(cur);
    }

    writeCode(eoiCode);
    flushBuffer();
  }

  /**
   * Lightweight pure JS PKZIP Packager (STORE mode)
   */
  createZipArchive(files) {
    const parts = [];
    const cdEntries = [];
    let offset = 0;

    const writeU16 = (val) => new Uint8Array([val & 0xff, (val >> 8) & 0xff]);
    const writeU32 = (val) => new Uint8Array([val & 0xff, (val >> 8) & 0xff, (val >> 16) & 0xff, (val >> 24) & 0xff]);

    for (const f of files) {
      const nameBytes = new TextEncoder().encode(f.name);
      const data = f.data;
      const crc = this.computeCRC32(data);
      const fileOffset = offset;

      // Local File Header (30 bytes + name + data)
      const lfh = new Uint8Array(30);
      lfh.set([0x50, 0x4b, 0x03, 0x04], 0); // signature
      lfh.set(writeU16(20), 4);              // version needed
      lfh.set(writeU16(0), 6);               // flags
      lfh.set(writeU16(0), 8);               // compression (0 = store)
      lfh.set(writeU16(0), 10);              // mod time
      lfh.set(writeU16(0), 12);              // mod date
      lfh.set(writeU32(crc), 14);            // crc32
      lfh.set(writeU32(data.length), 18);    // compressed size
      lfh.set(writeU32(data.length), 22);    // uncompressed size
      lfh.set(writeU16(nameBytes.length), 26);// name length
      lfh.set(writeU16(0), 28);              // extra field length

      parts.push(lfh);
      parts.push(nameBytes);
      parts.push(data);

      offset += lfh.length + nameBytes.length + data.length;

      // Central Directory Header
      const cdh = new Uint8Array(46);
      cdh.set([0x50, 0x4b, 0x01, 0x02], 0); // signature
      cdh.set(writeU16(20), 4);              // version made by
      cdh.set(writeU16(20), 6);              // version needed
      cdh.set(writeU16(0), 8);               // flags
      cdh.set(writeU16(0), 10);              // compression (0 = store)
      cdh.set(writeU16(0), 12);              // mod time
      cdh.set(writeU16(0), 14);              // mod date
      cdh.set(writeU32(crc), 16);            // crc32
      cdh.set(writeU32(data.length), 20);    // compressed size
      cdh.set(writeU32(data.length), 24);    // uncompressed size
      cdh.set(writeU16(nameBytes.length), 28);// name length
      cdh.set(writeU16(0), 30);              // extra length
      cdh.set(writeU16(0), 32);              // comment length
      cdh.set(writeU16(0), 34);              // disk start
      cdh.set(writeU16(0), 36);              // internal attrs
      cdh.set(writeU32(0), 38);              // external attrs
      cdh.set(writeU32(fileOffset), 42);     // relative offset of lfh

      cdEntries.push(cdh);
      cdEntries.push(nameBytes);
    }

    const cdStartOffset = offset;
    let cdSize = 0;
    for (const p of cdEntries) {
      parts.push(p);
      cdSize += p.length;
    }

    // End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    eocd.set([0x50, 0x4b, 0x05, 0x06], 0); // signature
    eocd.set(writeU16(0), 4);              // disk number
    eocd.set(writeU16(0), 6);              // start disk
    eocd.set(writeU16(files.length), 8);    // records on this disk
    eocd.set(writeU16(files.length), 10);   // total records
    eocd.set(writeU32(cdSize), 12);         // central dir size
    eocd.set(writeU32(cdStartOffset), 16);  // central dir offset
    eocd.set(writeU16(0), 20);             // comment length

    parts.push(eocd);

    return new Blob(parts, { type: 'application/zip' });
  }

  computeCRC32(data) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ this.getCRC32Table()[(crc ^ data[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  getCRC32Table() {
    if (!this._crcTable) {
      this._crcTable = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
          c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        this._crcTable[i] = c >>> 0;
      }
    }
    return this._crcTable;
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }
}

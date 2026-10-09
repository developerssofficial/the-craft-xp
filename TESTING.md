# The Craft — Manual Testing Checklist (TESTING.md)

Use this checklist to manually verify all features and stability enhancements across layers, tools, history, persistence, and export in **The Craft** (`https://thecraft.dev.cv`).

---

## 1. Layer Stack Operations
- [ ] **Add Layer**: Click `+ Add Layer` in the Layers panel. A new layer (e.g. `Layer 2`) appears at the top and becomes active.
- [ ] **Rename Layer**: Double-click any layer name. Type a new name and press Enter or click outside. Verify the name updates and can be undone with `Ctrl+Z`.
- [ ] **Visibility Toggle**: Click the eye icon (`fa-eye` / `fa-eye-slash`). The layer's content disappears from the canvas. Click again to restore. Verify hidden layers are not exported.
- [ ] **Lock Layer**: Click the padlock icon (`fa-lock-open` / `fa-lock`). While locked:
  - Brushes and tools show a warning toast: *"Layer is locked"*.
  - Objects cannot be selected, dragged, or deleted.
- [ ] **Opacity Slider**:
  - Drag the opacity slider on an active layer. The layer smoothly fades.
  - Press `Ctrl+Z` (Undo). Opacity returns to its initial value prior to dragging (not one step backwards on the slider).
- [ ] **Blend Modes**: Change blend mode from `Normal` to `Multiply`, `Screen`, `Overlay`, or `Difference`. Verify colors interact accurately with layers underneath.
- [ ] **Reorder Layers (Drag & Drop)**:
  - Drag a layer card upwards or downwards. A visual cyan drop indicator line appears between layers.
  - Drop the card. The layer order updates on both the panel and canvas rendering stack.
  - Press `Ctrl+Z` to undo the reorder.
- [ ] **Duplicate Layer**: Click the duplicate button (`fa-copy`). A clone of the active layer with all vector shapes and raster pixels is created directly above it.
- [ ] **Merge Down**: Click merge down (`fa-layer-group`) on an upper layer. The active layer merges into the layer below it, combining vector and raster contents.
- [ ] **Delete Layer**: Click trash on a layer. If multiple layers exist, it is deleted. Verify the last remaining layer cannot be deleted.

---

## 2. Tools & Active Layer Isolation
- [ ] **Active Layer Eraser**:
  - Draw a red stroke on Layer 1.
  - Add Layer 2 and draw a blue stroke over the red stroke.
  - Switch to Eraser (`E`) and erase over the blue stroke on Layer 2.
  - **Verify**: The blue stroke on Layer 2 is erased, but the red stroke on Layer 1 remains completely untouched.
- [ ] **Active Layer Flood Fill**:
  - Add Layer 1 and draw a closed circle outline.
  - Add Layer 2 and use Bucket Fill (`F`) inside Layer 2.
  - **Verify**: Fill occurs exclusively within Layer 2's raster buffer and does not leak or conflict with Layer 1.
- [ ] **Brush & Tool Dynamics**:
  - Test Freehand Brush (`B`), Pencil (`P`), Neon (`G`), Rainbow (`R`), Spray (`A`), Highlighter (`H`).
  - Test Shapes: Line (`L`), Arrow, Rectangle, Circle, Star, Heart.
  - Test Text Tool (`T`): click canvas, type, blur to commit text.
  - Test Stamp Tool: click canvas to stamp selected emoji.
  - Test Symmetry: toggle symmetry guide, verify mirrored strokes render on the active layer.
  - Test Eyedropper (`I`): click any pixel to sample the exact composite color.
- [ ] **Stylus Pen Pressure Dynamics**:
  - Open Properties panel. Toggle **"Stylus Pressure Dynamics"** checkbox.
  - With a pressure-sensitive stylus (Apple Pencil / Wacom / Surface Pen / Samsung S-Pen):
    - Light pressure = thin, translucent stroke.
    - Heavy pressure = thick, opaque stroke.
  - When unchecked, strokes maintain fixed size and opacity regardless of stylus pressure.

---

## 3. Undo / Redo (Full Layer Command Integration)
- [ ] **Draw / Erase**: Press `Ctrl+Z` to undo stroke, `Ctrl+Y` to redo.
- [ ] **Layer Add / Delete**: Undo adding a layer; redo restores it.
- [ ] **Layer Reorder**: Undo layer dragging reorder.
- [ ] **Layer Rename**: Undo renaming restores previous name.
- [ ] **Layer Opacity**: Undo slider change restores exact pre-drag opacity.
- [ ] **Layer Blend Mode**: Undo dropdown change restores previous blend mode.
- [ ] **Merge Down**: Undo merge down cleanly separates the two layers back into their original state.
- [ ] **Clear Layer**: Click trash icon in header to clear active layer; press `Ctrl+Z` to restore all cleared contents.

---

## 4. Multi-Layer Composite Export
- [ ] **PNG Export**: Export -> Download PNG. Output file contains composite of all visible layers with correct opacity and blend modes.
- [ ] **Hidden Layer Exclusion**: Hide a layer (eye icon) and export PNG. Verify the hidden layer is completely omitted from the exported image.
- [ ] **Transparent Background**: Set canvas background to "Transparent (PNG)" in the top bar. Export PNG. Verify transparent background is preserved.
- [ ] **JPG Export**: Export -> Download JPG. Verify high-resolution composite with solid background.
- [ ] **Copy to Clipboard**: Click Export -> Copy to Clipboard. Paste into Discord, Slack, or image viewer (`Ctrl+V`).

---

## 5. IndexedDB Autosave & Session Restore
- [ ] **Autosave Trigger**:
  - Draw several strokes, add a layer, and adjust opacity.
  - Watch the header badge: changes from *"Unsaved changes"* to *"Saving..."* to *"Autosaved"*.
- [ ] **Page Refresh**:
  - Refresh the browser (`F5` / `Ctrl+R`).
  - **Verify**: The document restores all layers, layer names, opacities, blend modes, vector elements, and raster drawings seamlessly.
  - Header badge displays *"Autosaved"*.

---

## 6. Portable Project Files (.craft)
- [ ] **Save Project**:
  - Click **"Save"** in the top header.
  - A `.craft` project file (e.g. `TheCraft_Project_1740000000.craft`) downloads.
- [ ] **Open Project**:
  - Clear canvas or refresh into a blank project.
  - Click **"Open"** in the top header and select the saved `.craft` file.
  - **Verify**: Entire multi-layer composition loads with full raster/vector elements, layer names, opacities, blend modes, and active layer intact.

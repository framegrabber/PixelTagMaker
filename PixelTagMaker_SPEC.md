# PixelTagMaker — Pixel Art Keyring Generator

A browser-based tool for designing pixel art characters on a grid and exporting them as 3D-printable STL keyrings. Fully static — no backend, deployable to GitHub Pages or any static host.


---

## Core Concept

Draw pixel art on a 2D grid. Each pixel becomes a 3D block. Export as a manifold STL file ready for FDM/resin 3D printing. One pixel type produces a keyring loop attachment. Characters are stored in a JSON library file that can be loaded/saved in the browser.

---

## Pixel Types

| Value | Name    | 3D Geometry | Editor Color |
|-------|---------|-------------|-------------|
| 0     | Empty   | No geometry | Dark/transparent |
| 1     | Raised  | Full-height block with chamfered top edges | Bright cyan (#4cc2ff) |
| 2     | Flat    | Shorter block (flush with base, no protrusion) | Muted blue (#2a8ab8) |
| 3     | Keyring | Full-height block + protruding loop with hole for a keyring/jump ring | Amber (#e8a735) |

---

## Architecture

### Tech Stack

- **Build**: Vite (static output, fast HMR)
- **UI**: React (lightweight, component-based)
- **CSG Engine**: [manifold-3d](https://www.npmjs.com/package/manifold-3d) — WebAssembly Manifold library, runs fully client-side. Guaranteed manifold output (no naked edges, no repair needed). This is the same engine OpenSCAD uses with `--enable=manifold`.
- **3D Preview**: [Three.js](https://www.npmjs.com/package/three) with OrbitControls for interactive rotation/zoom
- **STL Export**: Three.js `STLExporter` or manual binary STL serialization from Manifold mesh
- **File I/O**: JSON files loaded/saved via File System Access API or download/upload fallback
- **Hosting**: Static files — `vite build` → deploy `dist/` to GitHub Pages, Netlify, etc.

### File Structure

```
src/
  app/
    App.jsx              # Root — file management + layout
    GridEditor.jsx       # 2D pixel grid with click-to-paint
    Viewer.jsx           # Three.js 3D preview with OrbitControls
    ExportButton.jsx     # STL download button
    style.css            # Minimal dark theme
    main.jsx             # Entry point
    index.html           # Shell
  core/
    pixelTypes.js        # Pixel type definitions (colors, labels)
    generator.js         # Grid → 3D mesh via Manifold
    keyringGeometry.js   # Keyring loop attachment geometry
    stlExport.js         # Manifold mesh → binary STL buffer
  index.html
package.json
vite.config.js
```

---

## Key Components

### Grid Editor (`GridEditor.jsx`)

Reuse the proven grid editor pattern from `apc-invaders/src/app/GridEditor.jsx`:

- 2D grid of clickable cells, colored by pixel type
- Click to paint, drag to paint multiple cells (pointer events)
- Right-click to erase (set to 0)
- Pixel type palette with 4 swatches (0-3)
- Grid resize controls (rows × cols number inputs)
- Clear button

**Differences from apc-invaders:**
- Only 4 pixel types (not 10)
- Fixed cell size (e.g. 32px) for clean rendering
- No character load/save in the editor itself (managed by App)

### 3D Viewer (`Viewer.jsx`)

Three.js scene with:
- `PerspectiveCamera` + `OrbitControls` (rotate, pan, zoom)
- Directional light + ambient light for depth perception
- Dark background (#141416)
- Grid helper (toggleable)
- Receives a Three.js `BufferGeometry` or `Mesh` from the generator
- Updates when geometry changes (debounced, not on every cell paint)

**Key learnings from apc-invaders to apply:**
- Do NOT allocate objects in the render loop (caused OOM crash)
- Do NOT auto-fit camera on every geometry update (only on first load + explicit button)
- Use refs for mutable state, not React state (avoids re-renders)
- Debounce generation by 300ms+ to handle rapid painting

### 3D Generator (`generator.js`)

Converts a 2D grid + parameters into a Manifold mesh:

```
Input:  { grid: number[][], pixelSize: number, pixelHeight: number, baseHeight: number }
Output: Manifold mesh (convertible to Three.js geometry and STL)
```

**Algorithm:**
1. For each non-zero cell in the grid, create a box primitive:
   - Type 1 (Raised): `pixelSize × pixelSize × (baseHeight + pixelHeight)` with chamfered top
   - Type 2 (Flat): `pixelSize × pixelSize × baseHeight` (no protrusion)
   - Type 3 (Keyring): Same as Type 1 + keyring loop attachment
2. Union all boxes (Manifold handles this efficiently)
3. Add diagonal bridges between pixels that only touch at corners (same algorithm as apc-invaders `findDiagonalBridges`)
4. For Type 3 pixels: union the keyring loop geometry

**Chamfered top edges:**
Use Manifold's `smooth()` or build the chamfer explicitly as a hull of two boxes (base + inset cap), same as the apc-invaders approach.

**Keyring loop geometry (Type 3):**
- A torus-like loop protruding from the pixel's outer edge
- Oriented outward from the nearest grid edge (auto-detect which side faces out)
- Loop outer diameter: ~8mm, hole diameter: ~4mm (fits standard jump rings)
- Connected to the pixel block with a short neck
- Built as: cylinder (neck) + torus (ring), or revolve a circle profile

Implementation in `keyringGeometry.js`:
```javascript
function keyringLoop(pixelSize, baseHeight, pixelHeight, direction) {
  // direction: 'top' | 'bottom' | 'left' | 'right' — which edge to attach to
  // Returns a Manifold solid positioned relative to pixel origin
}
```

**Direction auto-detection:** For each Type 3 pixel, check which adjacent cells are empty. Pick the edge with the most open space. If ambiguous, prefer top, then right, then bottom, then left.

### STL Export (`stlExport.js`)

Manifold provides `.getMesh()` which returns vertices and triangle indices. Convert to binary STL:

```javascript
function manifoldToStl(manifoldMesh) → Uint8Array
```

Binary STL format: 80-byte header + uint32 triangle count + 50 bytes per triangle (normal + 3 vertices + attribute). No repair step needed — Manifold guarantees manifold output.

### Character Library

**File format:** JSON

```json
{
  "version": 1,
  "characters": [
    {
      "name": "invader",
      "grid": [
        [0,0,1,0,0,0,0,0,1,0,0],
        [0,0,0,1,0,0,0,1,0,0,0],
        [0,0,1,1,1,1,1,1,1,0,0],
        [0,1,1,0,1,1,1,0,1,1,0],
        [1,1,1,1,1,1,1,1,1,1,1],
        [1,0,1,1,1,1,1,1,1,0,1],
        [1,0,1,0,0,0,0,0,1,0,1],
        [0,0,0,1,1,0,1,1,0,0,0]
      ]
    }
  ]
}
```

**Loading/Saving:**
- "Open" button: `showOpenFilePicker()` for File System Access API, with `<input type="file">` fallback for browsers that don't support it (Firefox, Safari)
- "Save" button: write back to file handle if available, otherwise `URL.createObjectURL()` + download
- Ship a default character library as a bundled JSON import for first-time users

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  PixelTagMaker                          [Open] [Save] [Export]   │
├────────────┬────────────────────────────────────────────────┤
│  invader   │  ┌──────────────────┐  ┌────────────────────┐ │
│  ghost     │  │  Grid Editor     │  │  3D Preview        │ │
│  monster   │  │  · · 1 · · · 1 · │  │                    │ │
│            │  │  · 1 1 1 1 1 1 · │  │    [3D model]      │ │
│  [+ New]   │  │  1 1 0 1 1 0 1 1 │  │                    │ │
│            │  │  ...              │  │                    │ │
│            │  └──────────────────┘  └────────────────────┘ │
│            │  Size: 11 × 8    [palette: 0 1 2 3]          │
│            │  Pixel size: [10] mm                          │
└────────────┴────────────────────────────────────────────────┘
```

- **Left sidebar**: Character list with selection, add/delete
- **Center**: Grid editor (resizable)
- **Right**: 3D preview (Three.js canvas)
- **Top bar**: File operations + STL export
- **Bottom of editor area**: Palette + size control

Responsive: On narrow screens, stack editor above preview.

---

## Parameters (user-adjustable)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| Pixel size | 4mm | 2-10mm | Width/depth of each pixel block |
| Pixel height | 2mm | 0.5-5mm | How much raised pixels protrude above base |
| Base height | 2mm | 1-5mm | Thickness of the flat base layer |
| Chamfer | 0.2mm | 0-0.5mm | 45-degree chamfer on raised pixel top edges |

These should be in a small collapsible settings panel, not cluttering the main UI.

---

## Implementation Hints & Lessons Learned

These come from the apc-invaders JSCAD porting effort and should save significant debugging time:

### Manifold-3d Usage

```javascript
import Module from 'manifold-3d';

const wasm = await Module();
const { Manifold, Mesh } = wasm;

// Create a box
const box = Manifold.cube([width, depth, height]);

// Translate
const moved = box.translate([x, y, z]);

// Boolean union (guaranteed manifold!)
const unioned = Manifold.union([mesh1, mesh2, mesh3]);

// Get triangle mesh for Three.js / STL export
const mesh = result.getMesh();
// mesh.vertProperties: Float32Array (x,y,z per vertex)
// mesh.triVerts: Uint32Array (3 indices per triangle)
```

### Diagonal Bridges

Pixels that only touch at corners (diagonal neighbors with no shared-edge neighbor) need small connecting geometry. Without this, the model falls apart at diagonal junctions.

Algorithm (from `apc-invaders/src/utils/gridUtils.js`):
```
For each cell (row, col) where row < gridRows-1:
  Check (row,col) ↘ (row+1,col+1):
    if both filled AND neither (row,col+1) nor (row+1,col) filled → bridge needed
  Check (row,col) ↙ (row+1,col-1):
    if both filled AND neither (row,col-1) nor (row+1,col) filled → bridge needed
```

Bridge geometry: a small 45-degree rotated square extruded to the base height, placed at the corner point.

### Chamfered Pixel Blocks

For a pixel block with chamfered top edges, use hull of two boxes:
- Base: full pixel size, height = totalHeight - chamfer
- Cap: pixel size minus 2×chamfer on each side, height = chamfer, positioned at top

In Manifold, `hull()` is available. Alternatively, build the chamfer as a truncated pyramid via `Manifold.extrude()` of a polygon with inset top.

### Three.js Preview Performance

From the apc-invaders viewer crashes:
- **Never allocate objects in the animation loop** — create grid/axis/light entities once, reuse every frame
- **Don't auto-fit camera on every geometry update** — only on first load and explicit user action
- **Use `useRef` for Three.js state** — React state causes re-renders which fight with requestAnimationFrame
- **Debounce geometry regeneration** — 300ms minimum when the user is actively painting

### STL Export

Manifold's `getMesh()` returns vertices and triangle indices. Convert to binary STL:

```javascript
function toStl(mesh) {
  const { vertProperties, triVerts } = mesh;
  const triCount = triVerts.length / 3;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buf);
  view.setUint32(80, triCount, true);
  let offset = 84;
  for (let t = 0; t < triCount; t++) {
    const i0 = triVerts[t*3], i1 = triVerts[t*3+1], i2 = triVerts[t*3+2];
    // compute normal, write normal + 3 vertices + attribute (50 bytes per tri)
    // ... (straightforward binary packing)
    offset += 50;
  }
  return new Uint8Array(buf);
}
```

No repair step needed — Manifold guarantees manifold, watertight output. This was the main reason for choosing it (JSCAD's CSG produced non-manifold meshes that required post-processing repair).

### File I/O for Static Hosting

For browsers with File System Access API (Chrome/Edge):
```javascript
const [handle] = await window.showOpenFilePicker({ types: [...] });
const file = await handle.getFile();
const text = await file.text();
// Save back:
const writable = await handle.createWritable();
await writable.write(newContent);
await writable.close();
```

Fallback for Firefox/Safari:
```javascript
// Load: <input type="file" accept=".json">
// Save: create Blob → URL.createObjectURL → download link
```

### Dark Theme Colors (reusable)

```css
--bg-primary: #141416;
--bg-secondary: #1a1a1e;
--bg-input: #222226;
--border: #2a2a2e;
--text-primary: #e0e0e0;
--text-secondary: #aaa;
--text-muted: #666;
--accent: #4cc2ff;
--danger: #e84535;
```

---

## What NOT to Do (Lessons from apc-invaders)

1. **Don't use JSCAD for CSG** — produces non-manifold meshes with naked edges. Manifold is the correct choice.
2. **Don't use `@jscad/regl-renderer`** — fragile API, caused OOM from per-frame allocations. Three.js is simpler and more reliable.
3. **Don't put `JSON.stringify(largeObject)` in React useEffect deps** — causes performance issues. Use a version counter or ref instead.
4. **Don't union touching volumes with different cross-sections** — even with overlap, CSG engines can produce artifacts at zone boundaries. Manifold handles this correctly but it's good practice to keep booleans simple.
5. **Don't forget diagonal bridges** — without them, diagonally-connected pixels produce disconnected geometry that falls apart during printing.

---

## Stretch Goals (not for v1)

- Color per pixel (multi-filament printing)
- Mirror/symmetry mode for the grid editor
- Undo/redo
- Import pixel art from images (quantize to grid)
- Batch export all characters as STLs
- Share characters via URL (grid encoded in URL hash)

# Coaster Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global "coaster" mode that generates a flat coaster with a filleted circular mug recess from the same pixel grid.

**Architecture:** Separate `coasterGenerator.js` handles all coaster CSG — the existing `generator.js` is untouched. A global `mode` state in `App.jsx` selects which generator to call and which params/palette to show. The mug recess is carved by splitting pixel geometry into inner (pushed down), fillet zone (curved cut), and outer (unchanged) regions using Manifold boolean ops.

**Tech Stack:** React, manifold-3d (WASM CSG), Three.js, Vite

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/App.jsx` | Modify | Mode state, toggle button, param defaults per mode, conditional generator call, coaster sliders |
| `src/app/GridEditor.jsx` | Modify | Accept `mode` prop, filter palette and hotkeys to types 0–2 in coaster mode |
| `src/core/coasterGenerator.js` | Create | Full coaster generation: base plate, pixel blocks, diagonal bridges, fillet mug recess |

---

## Task 1: Mode state + toggle button in App.jsx

**Files:**
- Modify: `src/app/App.jsx`

- [ ] **Step 1: Rename DEFAULT_PARAMS and add coaster defaults**

In `src/app/App.jsx`, replace line 11:
```js
const DEFAULT_PARAMS = { pixelSize: 4, pixelHeight: 0.5, thickness: 2, chamfer: 0.2, holeSize: 2 }
```
With:
```js
const KEYRING_DEFAULT_PARAMS = { pixelSize: 4, pixelHeight: 0.5, thickness: 2, chamfer: 0.2, holeSize: 2 }
const COASTER_DEFAULT_PARAMS = { pixelSize: 6, pixelHeight: 1, thickness: 4, chamfer: 0.3, recessDiameter: 70, recessDepth: 1.5, filletRadius: 3 }
```

- [ ] **Step 2: Add mode state and update useState for params**

Inside `App()`, replace:
```js
const [params, setParams] = useState(DEFAULT_PARAMS)
```
With:
```js
const [mode, setMode] = useState('keyring')
const [params, setParams] = useState(KEYRING_DEFAULT_PARAMS)
```

- [ ] **Step 3: Add handleModeSwitch**

Add this function inside `App()`, after the existing state declarations:
```js
function handleModeSwitch() {
  setMode(prev => {
    const next = prev === 'keyring' ? 'coaster' : 'keyring'
    setParams(next === 'coaster' ? COASTER_DEFAULT_PARAMS : KEYRING_DEFAULT_PARAMS)
    return next
  })
}
```

- [ ] **Step 4: Add toggle button to header**

In the JSX, inside `<div className="header-actions">`, add the toggle button as the first child (before the Open button):
```jsx
<button className="btn btn-ghost" onClick={handleModeSwitch}>
  {mode === 'keyring' ? 'Keyring' : 'Coaster'}
</button>
```

- [ ] **Step 5: Pass mode to GridEditor**

Find the `<GridEditor` JSX block and add the `mode` prop:
```jsx
<GridEditor
  grid={grid}
  onGridChange={handleGridChange}
  raisedColor={characterColors.raised}
  flatColor={characterColors.flat}
  mode={mode}
/>
```

- [ ] **Step 6: Verify in browser**

Run: `npm run dev`

Open the app. You should see a "Keyring" button in the header. Click it — it should change to "Coaster" and back. No generator changes yet, so the 3D preview is unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/app/App.jsx
git commit -m "feat: add global mode state and Keyring/Coaster toggle button"
```

---

## Task 2: Filter GridEditor by mode

**Files:**
- Modify: `src/app/GridEditor.jsx`

- [ ] **Step 1: Add mode prop with default**

Change the function signature at line 27 from:
```js
export default function GridEditor({ grid, onGridChange, raisedColor, flatColor }) {
```
To:
```js
export default function GridEditor({ grid, onGridChange, raisedColor, flatColor, mode = 'keyring' }) {
```

- [ ] **Step 2: Reset activeType when switching to coaster mode with an invalid type selected**

Add this `useEffect` after the existing state declarations (after the `hoverCell` state line):
```js
useEffect(() => {
  if (mode === 'coaster' && activeType > 2) setActiveType(1)
}, [mode])
```

- [ ] **Step 3: Limit hotkeys to the active mode's range**

Find the hotkey `useEffect` (currently at line ~138). Replace:
```js
if (e.key >= '0' && e.key <= '4') setActiveType(+e.key)
```
With:
```js
const maxKey = mode === 'coaster' ? '2' : '4'
if (e.key >= '0' && e.key <= maxKey) setActiveType(+e.key)
```

Also add `mode` to the `useEffect` dependency array:
```js
}, [mode])
```

- [ ] **Step 4: Filter palette to visible types**

Find the `{/* Palette */}` section. Replace:
```jsx
{PIXEL_TYPES.map(pt => {
```
With:
```jsx
{PIXEL_TYPES.filter(pt => mode === 'coaster' ? pt.value <= 2 : true).map(pt => {
```

- [ ] **Step 5: Update hint text**

Find:
```jsx
<p className="ge-hint">Click to paint &middot; Right-click to erase &middot; Keys 0–4 select type</p>
```
Replace with:
```jsx
<p className="ge-hint">Click to paint &middot; Right-click to erase &middot; Keys 0–{mode === 'coaster' ? '2' : '4'} select type</p>
```

- [ ] **Step 6: Verify in browser**

Run: `npm run dev`

Switch to Coaster mode. The palette should show only Empty, Raised, and Flat. Keyring and 2×2 Hole should be gone. Pressing `3` or `4` should do nothing. Pressing `0`, `1`, `2` should work. Switch back to Keyring — all 5 types should reappear.

- [ ] **Step 7: Commit**

```bash
git add src/app/GridEditor.jsx
git commit -m "feat: filter palette and hotkeys to types 0-2 in coaster mode"
```

---

## Task 3: Coaster param sliders in App.jsx

**Files:**
- Modify: `src/app/App.jsx`

- [ ] **Step 1: Conditionally show holeSize slider**

Find in the settings panel JSX:
```jsx
<ParamSlider label="Hole size" unit="mm" value={params.holeSize} min={0.5} max={params.pixelSize * 1.8} step={0.1} onChange={v => updateParam('holeSize', v)} />
```
Wrap it:
```jsx
{mode === 'keyring' && (
  <ParamSlider label="Hole size" unit="mm" value={params.holeSize} min={0.5} max={params.pixelSize * 1.8} step={0.1} onChange={v => updateParam('holeSize', v)} />
)}
```

- [ ] **Step 2: Add coaster-specific sliders**

Immediately after the wrapped holeSize slider, add:
```jsx
{mode === 'coaster' && (
  <>
    <ParamSlider label="Recess diameter" unit="mm" value={params.recessDiameter} min={40} max={100} step={1} onChange={v => updateParam('recessDiameter', v)} />
    <ParamSlider label="Recess depth" unit="mm" value={params.recessDepth} min={0.5} max={4} step={0.1} onChange={v => updateParam('recessDepth', v)} />
    <ParamSlider label="Fillet radius" unit="mm" value={params.filletRadius} min={1} max={8} step={0.1} onChange={v => updateParam('filletRadius', v)} />
  </>
)}
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`

Open Print Settings. In Keyring mode: Hole size should be visible, recess sliders absent. Switch to Coaster mode: Hole size gone, three recess sliders appear. Sliders should be draggable.

- [ ] **Step 4: Commit**

```bash
git add src/app/App.jsx
git commit -m "feat: add coaster param sliders, hide holeSize in coaster mode"
```

---

## Task 4: Create coasterGenerator.js (no recess yet)

**Files:**
- Create: `src/core/coasterGenerator.js`

- [ ] **Step 1: Create the file**

Create `src/core/coasterGenerator.js` with this full content:

```js
import { getManifold } from './manifold.js'
import * as THREE from 'three'

function isOn(grid, row, col) {
  if (row < 0 || row >= grid.length) return false
  if (col < 0 || col >= grid[0].length) return false
  return grid[row][col] > 0
}

function findDiagonalBridges(grid) {
  const rows = grid.length
  const cols = grid[0]?.length || 0
  const bridges = []
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols; col++) {
      if (col < cols - 1) {
        if (isOn(grid, row, col) && isOn(grid, row + 1, col + 1) &&
            !isOn(grid, row, col + 1) && !isOn(grid, row + 1, col)) {
          bridges.push({ x: col + 1, y: rows - 1 - row })
        }
      }
      if (col > 0) {
        if (isOn(grid, row, col) && isOn(grid, row + 1, col - 1) &&
            !isOn(grid, row, col - 1) && !isOn(grid, row + 1, col)) {
          bridges.push({ x: col, y: rows - 1 - row })
        }
      }
    }
  }
  return bridges
}

function createChamferedBlock(Manifold, ps, totalHeight, chamfer) {
  if (chamfer <= 0 || chamfer >= totalHeight * 0.5) {
    return Manifold.cube([ps, ps, totalHeight])
  }
  const base = Manifold.cube([ps, ps, totalHeight - chamfer])
  const cap = Manifold.cube([ps - 2 * chamfer, ps - 2 * chamfer, chamfer])
    .translate([chamfer, chamfer, totalHeight - chamfer])
  return Manifold.hull([base, cap])
}

function partsToThreeGeometry(parts, Manifold) {
  if (parts.length === 0) return null
  const result = parts.length === 1 ? parts[0] : Manifold.union(parts)
  const { vertProperties, triVerts, numProp } = result.getMesh()
  const vertCount = vertProperties.length / numProp
  const positions = new Float32Array(vertCount * 3)
  for (let i = 0; i < vertCount; i++) {
    positions[i * 3]     = vertProperties[i * numProp]
    positions[i * 3 + 1] = vertProperties[i * numProp + 1]
    positions[i * 3 + 2] = vertProperties[i * numProp + 2]
  }
  const indexed = new THREE.BufferGeometry()
  indexed.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  indexed.setIndex(new THREE.BufferAttribute(new Uint32Array(triVerts), 1))
  const geometry = indexed.toNonIndexed()
  geometry.computeVertexNormals()
  if (parts.length > 1) result.delete()
  return geometry
}

/**
 * Generate a Manifold mesh from a 2D pixel grid in coaster mode.
 * Returns { mesh, raisedGeometry, flatGeometry } or null if grid is empty.
 * raisedGeometry covers type 1 pixels and diagonal bridges.
 * flatGeometry covers type 2 pixels and the base plate.
 */
export async function generateCoaster(grid, params) {
  const {
    pixelSize: ps = 6,
    pixelHeight = 1,
    thickness = 4,
    chamfer = 0.3,
  } = params

  const wasm = await getManifold()
  const { Manifold, CrossSection } = wasm

  const rows = grid.length
  const cols = grid[0]?.length || 0
  const totalHeight = thickness + pixelHeight

  // Bounding box of non-empty pixels
  let minR = rows, maxR = -1, minC = cols, maxC = -1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== 0) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r)
        minC = Math.min(minC, c); maxC = Math.max(maxC, c)
      }
    }
  }
  if (maxR === -1) return null

  const bboxW = (maxC - minC + 1) * ps
  const bboxH = (maxR - minR + 1) * ps
  const originX = minC * ps
  const originY = (rows - 1 - maxR) * ps

  // Solid base plate covering the full bounding box
  const basePlate = Manifold.cube([bboxW, bboxH, thickness]).translate([originX, originY, 0])

  const raisedParts = []
  const flatParts = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = grid[r][c]
      if (val === 0 || val > 2) continue
      const x = c * ps
      const y = (rows - 1 - r) * ps
      if (val === 2) {
        flatParts.push(Manifold.cube([ps, ps, thickness]).translate([x, y, 0]))
      } else {
        raisedParts.push(
          createChamferedBlock(Manifold, ps, totalHeight, chamfer).translate([x, y, 0])
        )
      }
    }
  }

  // Diagonal bridges (into raisedParts — mandatory for manifold output)
  const bridges = findDiagonalBridges(grid)
  const bridgeW = ps * 0.3
  const half = bridgeW / 2
  for (const b of bridges) {
    const diamond = new CrossSection([[[half, 0], [0, half], [-half, 0], [0, -half]]])
    raisedParts.push(
      Manifold.extrude(diamond, thickness).translate([b.x * ps, b.y * ps, 0])
    )
  }

  // Three.js geometries for two-tone rendering
  const raisedGeometry = partsToThreeGeometry(raisedParts, Manifold)
  const flatGeometry = partsToThreeGeometry([...flatParts, basePlate], Manifold)

  // Combined STL mesh
  const allParts = [...raisedParts, ...flatParts, basePlate]
  const combined = allParts.length === 1 ? allParts[0] : Manifold.union(allParts)
  const mesh = combined.getMesh()

  for (const p of [...raisedParts, ...flatParts]) p.delete()
  basePlate.delete()
  if (allParts.length > 1) combined.delete()

  return { mesh, raisedGeometry, flatGeometry }
}
```

- [ ] **Step 2: Verify file saved**

Run: `npm run dev`

The app should compile with no errors (the file is created but not imported yet).

---

## Task 5: Wire coasterGenerator into App.jsx

**Files:**
- Modify: `src/app/App.jsx`

- [ ] **Step 1: Import generateCoaster**

At the top of `src/app/App.jsx`, after the existing `generateMesh` import:
```js
import { generateCoaster } from '../core/coasterGenerator'
```

- [ ] **Step 2: Add mode to the mesh generation useEffect deps and call the right generator**

Find the debounced mesh generation `useEffect`. Its dependency array currently is `[grid, params, wasmReady]`. Update it to include `mode`:
```js
}, [grid, params, wasmReady, mode])
```

Inside the `useEffect`, find:
```js
const result = await generateMesh(grid, params)
```
Replace with:
```js
const result = await (mode === 'coaster' ? generateCoaster(grid, params) : generateMesh(grid, params))
```

- [ ] **Step 3: Verify end-to-end in browser**

Run: `npm run dev`

Draw some pixels. Switch to Coaster mode — the 3D preview should update to show a flat coaster with a solid rectangular base plate beneath the pixel art. No mug recess yet. Switch back to Keyring — should return to normal keyring geometry.

- [ ] **Step 4: Commit**

```bash
git add src/core/coasterGenerator.js src/app/App.jsx
git commit -m "feat: add coasterGenerator.js with base plate and wire into App.jsx"
```

---

## Task 6: Add fillet mug recess to coasterGenerator.js

**Files:**
- Modify: `src/core/coasterGenerator.js`

- [ ] **Step 1: Add the applyRecess helper function**

Add this function to `src/core/coasterGenerator.js`, after `partsToThreeGeometry` and before `generateCoaster`:

```js
/**
 * Split a Manifold solid into three zones relative to a circular recess and recombine:
 *   inner zone  → translated down by recessDepth
 *   fillet zone → cut by the curved fillet surface
 *   outer zone  → unchanged
 * innerCyl, outerCyl, filletCutter must be full-height columns centered on the recess.
 * Returns a new Manifold. Caller is responsible for deleting the returned value.
 * Does NOT delete geom, innerCyl, outerCyl, or filletCutter.
 */
function applyRecess(geom, innerCyl, outerCyl, filletCutter, recessDepth, Manifold) {
  const inner = geom.intersect(innerCyl).translate([0, 0, -recessDepth])
  const filletZoneRaw = geom.intersect(outerCyl).subtract(innerCyl)
  const filletZone = filletZoneRaw.subtract(filletCutter)
  filletZoneRaw.delete()
  const outer = geom.subtract(outerCyl)
  const result = Manifold.union([inner, filletZone, outer])
  inner.delete()
  filletZone.delete()
  outer.delete()
  return result
}
```

- [ ] **Step 2: Replace generateCoaster with a version that uses the recess**

Replace the entire `export async function generateCoaster` with this updated version:

```js
export async function generateCoaster(grid, params) {
  const {
    pixelSize: ps = 6,
    pixelHeight = 1,
    thickness = 4,
    chamfer = 0.3,
    recessDiameter = 70,
    recessDepth = 1.5,
    filletRadius = 3,
  } = params
  const fr = Math.min(filletRadius, recessDepth) // fillet can't exceed recess depth

  const wasm = await getManifold()
  const { Manifold, CrossSection } = wasm

  const rows = grid.length
  const cols = grid[0]?.length || 0
  const totalHeight = thickness + pixelHeight

  // Bounding box of non-empty pixels
  let minR = rows, maxR = -1, minC = cols, maxC = -1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== 0) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r)
        minC = Math.min(minC, c); maxC = Math.max(maxC, c)
      }
    }
  }
  if (maxR === -1) return null

  const bboxW = (maxC - minC + 1) * ps
  const bboxH = (maxR - minR + 1) * ps
  const originX = minC * ps
  const originY = (rows - 1 - maxR) * ps
  const cx = originX + bboxW / 2
  const cy = originY + bboxH / 2

  // Base plate
  const basePlate = Manifold.cube([bboxW, bboxH, thickness]).translate([originX, originY, 0])

  const raisedParts = []
  const flatParts = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = grid[r][c]
      if (val === 0 || val > 2) continue
      const x = c * ps
      const y = (rows - 1 - r) * ps
      if (val === 2) {
        flatParts.push(Manifold.cube([ps, ps, thickness]).translate([x, y, 0]))
      } else {
        raisedParts.push(
          createChamferedBlock(Manifold, ps, totalHeight, chamfer).translate([x, y, 0])
        )
      }
    }
  }

  // Diagonal bridges
  const bridges = findDiagonalBridges(grid)
  const bridgeW = ps * 0.3
  const half = bridgeW / 2
  for (const b of bridges) {
    const diamond = new CrossSection([[[half, 0], [0, half], [-half, 0], [0, -half]]])
    raisedParts.push(
      Manifold.extrude(diamond, thickness).translate([b.x * ps, b.y * ps, 0])
    )
  }

  // --- Recess geometry ---
  const SEGS = 128  // circle smoothness for inner/outer cylinders
  const N = 16      // steps for fillet arc hull
  const innerRadius = recessDiameter / 2 - fr
  const outerRadius = recessDiameter / 2
  const bigH = totalHeight * 4  // tall enough to split all geometry

  // Full-height splitting cylinders
  const innerCyl = Manifold.cylinder(bigH, innerRadius, innerRadius, SEGS)
    .translate([cx, cy, -bigH / 2])
  const outerCyl = Manifold.cylinder(bigH, outerRadius, outerRadius, SEGS)
    .translate([cx, cy, -bigH / 2])

  // Fillet cutter: hull of arc discs + floor disc for clean subtraction
  // Arc center is at (innerRadius, thickness) in (r, Z) space.
  // Disc i: r = innerRadius + fr*sin(i/N * π/2), Z = thickness - fr*cos(i/N * π/2)
  const arcDiscs = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const discR = innerRadius + fr * Math.sin(t * Math.PI / 2)
    const discZ = thickness - fr * Math.cos(t * Math.PI / 2)
    arcDiscs.push(Manifold.cylinder(0.001, discR, discR, SEGS).translate([cx, cy, discZ]))
  }
  arcDiscs.push(Manifold.cylinder(0.001, innerRadius, innerRadius, SEGS).translate([cx, cy, 0]))
  const filletCutter = Manifold.hull(arcDiscs)
  for (const d of arcDiscs) d.delete()

  // Apply recess to raised pixel geometry
  let raisedGeom = null, processedRaised = null
  if (raisedParts.length > 0) {
    raisedGeom = Manifold.union(raisedParts)
    processedRaised = applyRecess(raisedGeom, innerCyl, outerCyl, filletCutter, recessDepth, Manifold)
    raisedGeom.delete()
  }

  // Apply recess to flat pixel geometry
  let flatGeom = null, processedFlat = null
  if (flatParts.length > 0) {
    flatGeom = Manifold.union(flatParts)
    processedFlat = applyRecess(flatGeom, innerCyl, outerCyl, filletCutter, recessDepth, Manifold)
    flatGeom.delete()
  }

  // Apply recess to base plate: subtract the inner cylinder at recessDepth + fillet cutter
  const recessVol = Manifold.cylinder(recessDepth, innerRadius, innerRadius, SEGS)
    .translate([cx, cy, thickness - recessDepth])
  const baseMinusInner = basePlate.subtract(recessVol)
  recessVol.delete()
  const processedBase = baseMinusInner.subtract(filletCutter)
  baseMinusInner.delete()

  // Clean up splitting tools
  innerCyl.delete()
  outerCyl.delete()
  filletCutter.delete()

  // Three.js geometries for two-tone rendering
  const raisedGeometry = processedRaised
    ? partsToThreeGeometry([processedRaised], Manifold)
    : null
  const flatAndBase = []
  if (processedFlat) flatAndBase.push(processedFlat)
  flatAndBase.push(processedBase)
  const flatGeometry = partsToThreeGeometry(flatAndBase, Manifold)

  // Combined STL mesh
  const allForMesh = []
  if (processedRaised) allForMesh.push(processedRaised)
  if (processedFlat) allForMesh.push(processedFlat)
  allForMesh.push(processedBase)
  const combined = allForMesh.length === 1 ? allForMesh[0] : Manifold.union(allForMesh)
  const mesh = combined.getMesh()

  // Cleanup
  for (const p of [...raisedParts, ...flatParts]) p.delete()
  basePlate.delete()
  if (processedRaised) processedRaised.delete()
  if (processedFlat) processedFlat.delete()
  processedBase.delete()
  if (allForMesh.length > 1) combined.delete()

  return { mesh, raisedGeometry, flatGeometry }
}
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`

Draw at least a 10×10 grid of pixels in Coaster mode. The 3D preview should show:
- The pixel art raised on the coaster surface
- A circular depression in the center where a mug would sit
- The boundary between the depression and the flat surface should be a smooth curve (fillet), not a sharp step
- Pixels inside the depression should be visible but lowered, not cut off
- Pixels crossing the fillet boundary should be cut along the curved surface

Try adjusting Recess diameter, Recess depth, and Fillet radius sliders — the 3D preview should update after the 300ms debounce.

Try Export — the downloaded STL should open in a slicer showing the same geometry.

- [ ] **Step 4: Commit**

```bash
git add src/core/coasterGenerator.js
git commit -m "feat: add filleted mug recess to coaster generator using CSG split"
```

# Coaster Mode Design

**Date:** 2026-04-20
**Status:** Approved

## Overview

Add a global "coaster" mode to PixelTagMaker alongside the existing "keyring" mode. In coaster mode, the pixel grid generates a flat coaster with a circular mug recess instead of a keyring attachment. The mug recess is a smooth circular depression with a filleted rim — pixels inside the recess are pushed down (not removed), pixels in the fillet transition zone are cut along the curved surface.

## Mode Switching

- A global `mode` state (`'keyring' | 'coaster'`) lives in `App.jsx`.
- A toggle button in the header switches between modes.
- Switching resets params to the mode's default values.
- Mode is not persisted — resets to `'keyring'` on page reload.

## Architecture

Approach: **separate `coasterGenerator.js`** — the keyring generator (`generator.js`) is untouched. `App.jsx` calls the appropriate generator based on `mode`.

Both generators return the same shape: `{ mesh, raisedGeometry, flatGeometry }`.

## coasterGenerator.js

### Pipeline — `generateCoaster(grid, params)`

1. **Bounding box** — compute `minR/maxR/minC/maxC` of all non-empty pixels. Derive `bboxW`, `bboxH`, and recess center `(cx, cy)`.

2. **Base plate** — solid `Manifold.cube([bboxW, bboxH, thickness])` covering the full bounding box. Goes into `flatGeometry` for two-tone rendering.

3. **Pixel blocks** — raised (type 1) and flat (type 2) blocks only. No keyring holes, no 2×2 quad groups. Same chamfered block logic as `generator.js`.

4. **Diagonal bridges** — same `findDiagonalBridges()` logic as `generator.js` (mandatory for manifold output).

5. **Fillet cutter** — a hull of 16 coaxial discs tracing a quarter-circle arc, plus one disc at Z=0 to extend the solid downward for clean subtraction:
   - `innerRadius = recessDiameter/2 - filletRadius`
   - `outerRadius = recessDiameter/2`
   - The arc is centered at `(innerRadius, thickness)` in (r, Z) space
   - Disc `i`: radius `= innerRadius + filletRadius * sin(i/N * π/2)`, Z `= thickness - filletRadius * cos(i/N * π/2)`
   - At i=0: `(innerRadius, thickness - filletRadius)` — base of fillet (top of vertical inner wall)
   - At i=N: `(outerRadius, thickness)` — surface level, where fillet meets the flat
   - Plus one extra disc at `(innerRadius, Z=0)` to close the subtractive solid downward
   - Center: `(cx, cy)`
   - Note: a flat vertical inner wall exists from `Z = thickness - recessDepth` to `Z = thickness - filletRadius` when `recessDepth > filletRadius`

6. **Recess split** — applied independently to raised geometry and flat geometry (to preserve two-tone separation):
   ```
   innerCylinder = full-height cylinder at innerRadius, centered at (cx, cy)
   outerCylinder = full-height cylinder at outerRadius, centered at (cx, cy)

   inner  = geom.intersect(innerCylinder).translate([0, 0, -recessDepth])
   fillet = geom.intersect(outerCylinder).subtract(innerCylinder).subtract(filletCutter)
   outer  = geom.subtract(outerCylinder)
   processed = union(inner, fillet, outer)
   ```

7. **Base plate recess** — subtract the inner cylinder (height=`recessDepth`, at top of plate) and the fillet cutter from the base plate. This creates the matching contoured surface the pushed-down pixels sit on.

8. **Output** — union all processed geometry for the STL `mesh`. `raisedGeometry` = processed raised parts (Three.js). `flatGeometry` = processed flat parts + contoured base plate (Three.js).

### Cylinder segment count

Use 128 segments for inner/outer cutters, 16 steps for the fillet hull. This gives smooth-looking circles at typical coaster scales without excessive polygon count.

## Params

### Keyring defaults (unchanged)

| Param | Default |
|-------|---------|
| pixelSize | 4 mm |
| pixelHeight | 0.5 mm |
| thickness | 2 mm |
| chamfer | 0.2 mm |
| holeSize | 2 mm |

### Coaster defaults (new)

| Param | Default | Range |
|-------|---------|-------|
| pixelSize | 6 mm | 2–10 mm |
| pixelHeight | 1 mm | 0.5–5 mm |
| thickness | 4 mm | 2–8 mm |
| chamfer | 0.3 mm | 0–1 mm |
| recessDiameter | 70 mm | 40–100 mm |
| recessDepth | 1.5 mm | 0.5–4 mm |
| filletRadius | 3 mm | 1–8 mm |

`holeSize` is not used in coaster mode and is not shown in the settings panel.

**Constraint:** `filletRadius` must be ≤ `recessDepth` (the fillet can't be taller than the recess). Clamp silently in the generator.

## GridEditor Changes

`GridEditor` receives a `mode` prop.

- **Palette:** in coaster mode, render only types 0–2 (Empty, Raised, Flat). Types 3 (Keyring) and 4 (2×2 Hole) are hidden.
- **Hotkeys:** in coaster mode, only `0`, `1`, `2` are active.
- **Hint text:** `"Keys 0–2 select type"` in coaster mode.

## App.jsx Changes

- Add `mode` state, default `'keyring'`.
- Add mode toggle button to header (between Share and Export, or after Export).
- On mode switch: call `setParams(mode === 'coaster' ? COASTER_DEFAULT_PARAMS : KEYRING_DEFAULT_PARAMS)`.
- Settings panel: in coaster mode, hide `holeSize` slider, show `recessDiameter`, `recessDepth`, `filletRadius` sliders.
- Generator call: `mode === 'coaster' ? generateCoaster(grid, params) : generateMesh(grid, params)`.
- Pass `mode` prop to `GridEditor`.

## Files

| File | Change |
|------|--------|
| `src/core/coasterGenerator.js` | **New** — full coaster generation pipeline |
| `src/app/App.jsx` | **Edit** — mode state, toggle, conditional generator, coaster sliders |
| `src/app/GridEditor.jsx` | **Edit** — mode prop, filtered palette + hotkeys |

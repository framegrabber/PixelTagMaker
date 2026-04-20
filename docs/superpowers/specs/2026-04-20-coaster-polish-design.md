# Coaster Polish — Design Spec

**Date:** 2026-04-20
**Status:** Approved

## Overview

Seven incremental improvements to the coaster/keyring mode system. The key architectural change is moving `mode` from global app state to a per-character property, which enables save/share and sidebar distinction. All other items are self-contained.

---

## 1. Fillet radius = recess depth (remove slider)

`filletRadius` is removed as a separate param. The fillet always equals `recessDepth`.

**Changes:**
- Remove `filletRadius` from `COASTER_DEFAULT_PARAMS`
- Remove the Fillet radius `ParamSlider` from the settings panel in coaster mode
- Remove the fillet-clamping `onChange` on the Recess depth slider (the inline arrow function that called `updateParam('filletRadius', ...)`)
- In `coasterGenerator.js`: replace `const fr = Math.min(filletRadius, recessDepth)` with `const fr = recessDepth`
- Guard in generator: `const fr = Math.min(recessDepth, recessDiameter / 2 - 1)` to ensure `innerRadius > 1mm` even if the user sets a huge recessDepth relative to recessDiameter

---

## 2. X/Y offset sliders for recess position

Two new params let the user shift the mug recess away from the bounding-box center.

**Changes to `COASTER_DEFAULT_PARAMS`:**
```js
recessOffsetX: 0,
recessOffsetY: 0,
```

**New sliders** (coaster mode only, added after Recess depth):
- "Recess X" — min: -50, max: 50, step: 1, unit: mm
- "Recess Y" — min: -50, max: 50, step: 1, unit: mm

**In `coasterGenerator.js`:**
```js
const cx = originX + bboxW / 2 + (recessOffsetX ?? 0)
const cy = originY + bboxH / 2 + (recessOffsetY ?? 0)
```

Positive X moves recess right; positive Y moves recess up (matches the generator's Y-up coordinate system). No clamping — if the recess shifts off the design the geometry remains valid.

---

## 3. Mode toggle — segmented control

Replace the single toggle button with a two-segment pill control.

**Before:** one `<button className="btn btn-ghost">` showing current mode name

**After:**
```jsx
<div className="mode-toggle">
  <button
    className={`mode-toggle__btn${mode === 'keyring' ? ' active' : ''}`}
    onClick={() => mode !== 'keyring' && handleModeSwitch()}
  >Keyring</button>
  <button
    className={`mode-toggle__btn${mode === 'coaster' ? ' active' : ''}`}
    onClick={() => mode !== 'coaster' && handleModeSwitch()}
  >Coaster</button>
</div>
```

**New CSS in `style.css`:**
```css
.mode-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.mode-toggle__btn {
  padding: 4px 12px;
  background: transparent;
  color: var(--text-muted);
  border: none;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s, color 0.15s;
}
.mode-toggle__btn.active {
  background: var(--accent);
  color: var(--bg);
}
.mode-toggle__btn:hover:not(.active) {
  background: var(--hover);
  color: var(--text);
}
```

---

## 4. Pixel size max: 10mm → 20mm

Change the Pixel size `ParamSlider` `max` from `10` to `20` in `App.jsx`. This slider is shared between both modes.

Also bump `COASTER_DEFAULT_PARAMS.pixelSize` from `6` to `8` so the default coaster grid is large enough to comfortably contain an 80mm recess.

---

## 5. Per-character mode — data model, save, share

### Character shape

```js
{ name: string, grid: number[][], mode: 'keyring' | 'coaster' }
```

`mode` defaults to `'keyring'` if absent on load (backward compat for old files — no version bump needed).

### Selecting a character

In `selectCharacter(idx)`:
```js
function selectCharacter(idx) {
  const ch = characters[idx]
  setSelectedIdx(idx)
  setGrid(ch.grid)
  const chMode = ch.mode ?? 'keyring'
  if (chMode !== mode) {
    setMode(chMode)
    setParams(chMode === 'coaster' ? COASTER_DEFAULT_PARAMS : KEYRING_DEFAULT_PARAMS)
  }
}
```

### Saving

`handleSave` serializes `{ version: 1, characters }`. Since `characters` now include `mode` per entry, nothing changes in `handleSave` itself.

### Sharing

`encodeShare` gains a `mode` parameter:
```js
function encodeShare(name, grid, params, mode) {
  const payload = JSON.stringify({ name, grid, params, mode })
  ...
}
```

Call site in `handleShare`: `encodeShare(selected?.name, grid, params, mode)`

On URL decode:
```js
const data = decodeShare(encoded)
if (!data?.grid) return
// ... existing character append logic ...
if (data.mode) setMode(data.mode)
if (data.params) setParams(prev => ({ ...prev, ...data.params }))
```

### New character

`addCharacter()` inherits current mode:
```js
const newChar = { name: 'untitled', grid: makeGrid(8, 8), mode }
```

### Existing `defaultCharacters.json` entries

All existing entries get `"mode": "keyring"` added explicitly (no silent fallback dependency).

---

## 6. Sidebar mode indicator

Each `char-item` row gets a small badge between the name and the `char-dims` span.

```jsx
<span className={`char-mode-badge char-mode-badge--${ch.mode ?? 'keyring'}`}>
  {(ch.mode ?? 'keyring') === 'keyring' ? 'K' : 'C'}
</span>
```

**New CSS:**
```css
.char-mode-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}
.char-mode-badge--keyring {
  background: #1a3a4a;
  color: #4cc2ff;
}
.char-mode-badge--coaster {
  background: #3a2a08;
  color: #e8a735;
}
```

---

## 7. Default coaster characters

Add `"mode": "keyring"` to all existing entries in `defaultCharacters.json`. Add 2 coaster entries after them.

### "sun" — 13×13, radial motif

Type 1 = raised rays, type 2 = flat centre disc.

```json
{
  "name": "sun",
  "mode": "coaster",
  "grid": [
    [0,0,0,0,0,0,1,0,0,0,0,0,0],
    [0,1,0,0,0,0,1,0,0,0,0,1,0],
    [0,0,1,0,0,0,1,0,0,0,1,0,0],
    [0,0,0,0,0,1,2,1,0,0,0,0,0],
    [0,0,0,0,2,2,2,2,2,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,1,0,0,0],
    [1,1,1,2,2,2,2,2,2,2,1,1,1],
    [0,0,0,1,2,2,2,2,2,1,0,0,0],
    [0,0,0,0,2,2,2,2,2,0,0,0,0],
    [0,0,0,0,0,1,2,1,0,0,0,0,0],
    [0,0,1,0,0,0,1,0,0,0,1,0,0],
    [0,1,0,0,0,0,1,0,0,0,0,1,0],
    [0,0,0,0,0,0,1,0,0,0,0,0,0]
  ]
}
```

At 8mm pixelSize: 104mm × 104mm design.

### "checkered" — 12×12, alternating raised/flat

Pattern: `(row + col) % 2 === 0 → type 1 (raised), else → type 2 (flat)`.

```json
{
  "name": "checkered",
  "mode": "coaster",
  "grid": [
    [1,2,1,2,1,2,1,2,1,2,1,2],
    [2,1,2,1,2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2,1,2,1,2],
    [2,1,2,1,2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2,1,2,1,2],
    [2,1,2,1,2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2,1,2,1,2],
    [2,1,2,1,2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2,1,2,1,2],
    [2,1,2,1,2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2,1,2,1,2],
    [2,1,2,1,2,1,2,1,2,1,2,1]
  ]
}
```

At 8mm pixelSize: 96mm × 96mm design. Showcases two-tone rendering.

---

## Files touched

| File | Change |
|------|--------|
| `src/app/App.jsx` | Remove filletRadius param/slider/clamping; add recessOffsetX/Y params+sliders; pixelSize max 20; replace toggle with segmented control; per-character mode in selectCharacter/addCharacter/encodeShare; update COASTER_DEFAULT_PARAMS |
| `src/app/style.css` | Add `.mode-toggle` and `.mode-toggle__btn` styles; add `.char-mode-badge` styles |
| `src/core/coasterGenerator.js` | `fr = min(recessDepth, recessDiameter/2 - 1)`; use recessOffsetX/Y in cx/cy |
| `src/core/defaultCharacters.json` | Add `"mode": "keyring"` to all existing entries; add sun and checkered coaster entries |

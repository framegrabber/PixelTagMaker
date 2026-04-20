# Coaster Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seven incremental improvements: simplify fillet param, add recess offset sliders, better mode toggle, higher pixel size cap, per-character mode for save/share, sidebar badges, and built-in coaster designs.

**Architecture:** `mode` moves from global-only state to a per-character field `{ name, grid, mode }`. All character manipulation functions (select, add, delete, open, share) now propagate mode. The coaster generator drops `filletRadius` and gains `recessOffsetX/Y`. UI gets a segmented pill toggle and per-character mode badges.

**Tech Stack:** React, Vite, manifold-3d WASM, Three.js

---

## File Map

| File | Change |
|------|--------|
| `src/core/coasterGenerator.js` | Remove `filletRadius`, `fr = min(recessDepth, recessDiameter/2-1)`, add `recessOffsetX/Y` to cx/cy |
| `src/app/App.jsx` | COASTER_DEFAULT_PARAMS, sliders, selectCharacter, addCharacter, deleteCharacter, handleOpen, encodeShare, handleShare, share-URL decode, mode toggle JSX, sidebar badge JSX |
| `src/app/style.css` | `.mode-toggle` segmented control, `.char-mode-badge` |
| `src/core/defaultCharacters.json` | Add `"mode": "keyring"` to all existing; add sun + checkered coaster designs |

---

## Task 1: Simplify fillet + add recess offset in coasterGenerator.js

**Files:**
- Modify: `src/core/coasterGenerator.js`

- [ ] **Step 1: Update param destructuring**

Find the destructuring block at the top of `generateCoaster` (lines starting `const { pixelSize: ps`). Replace it with:

```js
  const {
    pixelSize: ps = 6,
    pixelHeight = 1,
    thickness = 4,
    chamfer = 0.3,
    recessDiameter = 70,
    recessDepth = 1.5,
    recessOffsetX = 0,
    recessOffsetY = 0,
  } = params
  // fillet equals recess depth, clamped so innerRadius stays > 1mm
  const fr = Math.min(recessDepth, recessDiameter / 2 - 1)
```

- [ ] **Step 2: Apply offsets to cx/cy**

Find:
```js
  const cx = originX + bboxW / 2
  const cy = originY + bboxH / 2
```
Replace with:
```js
  const cx = originX + bboxW / 2 + recessOffsetX
  const cy = originY + bboxH / 2 + recessOffsetY
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `✓ built` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/core/coasterGenerator.js
git commit -m "feat: fillet=recessDepth, add recessOffsetX/Y to coaster generator"
```

---

## Task 2: Update COASTER_DEFAULT_PARAMS and sliders in App.jsx

**Files:**
- Modify: `src/app/App.jsx`

- [ ] **Step 1: Update COASTER_DEFAULT_PARAMS**

Find line 13:
```js
const COASTER_DEFAULT_PARAMS = { pixelSize: 6, pixelHeight: 1, thickness: 4, chamfer: 0.3, recessDiameter: 70, recessDepth: 1.5, filletRadius: 3 }
```
Replace with:
```js
const COASTER_DEFAULT_PARAMS = { pixelSize: 8, pixelHeight: 1, thickness: 4, chamfer: 0.3, recessDiameter: 70, recessDepth: 1.5, recessOffsetX: 0, recessOffsetY: 0 }
```

- [ ] **Step 2: Update the Pixel size slider max**

Find:
```jsx
<ParamSlider label="Pixel size" unit="mm" value={params.pixelSize} min={2} max={10} step={0.5} onChange={v => updateParam('pixelSize', v)} />
```
Replace with:
```jsx
<ParamSlider label="Pixel size" unit="mm" value={params.pixelSize} min={2} max={20} step={0.5} onChange={v => updateParam('pixelSize', v)} />
```

- [ ] **Step 3: Replace coaster sliders block**

Find the entire coaster sliders block:
```jsx
                  {mode === 'coaster' && (
                    <>
                      <ParamSlider label="Recess diameter" unit="mm" value={params.recessDiameter} min={40} max={100} step={1} onChange={v => updateParam('recessDiameter', v)} />
                      <ParamSlider label="Recess depth" unit="mm" value={params.recessDepth} min={0.5} max={4} step={0.1} onChange={v => {
                        updateParam('recessDepth', v)
                        if (params.filletRadius > v) updateParam('filletRadius', v)
                      }} />
                      <ParamSlider label="Fillet radius" unit="mm" value={params.filletRadius} min={1} max={params.recessDepth} step={0.1} onChange={v => updateParam('filletRadius', v)} />
                    </>
                  )}
```
Replace with:
```jsx
                  {mode === 'coaster' && (
                    <>
                      <ParamSlider label="Recess diameter" unit="mm" value={params.recessDiameter} min={40} max={100} step={1} onChange={v => updateParam('recessDiameter', v)} />
                      <ParamSlider label="Recess depth" unit="mm" value={params.recessDepth} min={0.5} max={4} step={0.1} onChange={v => updateParam('recessDepth', v)} />
                      <ParamSlider label="Recess X" unit="mm" value={params.recessOffsetX ?? 0} min={-50} max={50} step={1} onChange={v => updateParam('recessOffsetX', v)} />
                      <ParamSlider label="Recess Y" unit="mm" value={params.recessOffsetY ?? 0} min={-50} max={50} step={1} onChange={v => updateParam('recessOffsetY', v)} />
                    </>
                  )}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: `✓ built` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.jsx
git commit -m "feat: update coaster params (remove filletRadius, add offsets, pixelSize max 20)"
```

---

## Task 3: Per-character mode — all character manipulation functions

**Files:**
- Modify: `src/app/App.jsx`

- [ ] **Step 1: Update `encodeShare`**

Find:
```js
function encodeShare(name, grid, params) {
  const payload = JSON.stringify({ name, grid, params })
```
Replace with:
```js
function encodeShare(name, grid, params, mode) {
  const payload = JSON.stringify({ name, grid, params, mode })
```

- [ ] **Step 2: Update `handleShare` call site**

Find:
```js
    const encoded = encodeShare(selected?.name || 'untitled', grid, params)
```
Replace with:
```js
    const encoded = encodeShare(selected?.name || 'untitled', grid, params, mode)
```

- [ ] **Step 3: Update share-URL decode useEffect**

Find:
```js
    setCharacters(prev => {
      // avoid duplicates if already loaded
      if (prev.some(c => c.name === data.name && JSON.stringify(c.grid) === JSON.stringify(data.grid))) return prev
      return [...prev, { name: data.name || 'shared', grid: data.grid }]
    })
    setSelectedIdx(characters.length)
    setGrid(data.grid)
    if (data.params) setParams(prev => ({ ...prev, ...data.params }))
```
Replace with:
```js
    const sharedMode = data.mode ?? 'keyring'
    setCharacters(prev => {
      if (prev.some(c => c.name === data.name && JSON.stringify(c.grid) === JSON.stringify(data.grid))) return prev
      return [...prev, { name: data.name || 'shared', grid: data.grid, mode: sharedMode }]
    })
    setSelectedIdx(characters.length)
    setGrid(data.grid)
    setMode(sharedMode)
    if (data.params) setParams(prev => ({ ...prev, ...data.params }))
```

- [ ] **Step 4: Update `selectCharacter`**

Find:
```js
  function selectCharacter(idx) {
    setSelectedIdx(idx)
    setGrid(characters[idx].grid)
  }
```
Replace with:
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

- [ ] **Step 5: Update `addCharacter`**

Find:
```js
    const newChar = { name: 'untitled', grid: makeGrid(8, 8) }
```
Replace with:
```js
    const newChar = { name: 'untitled', grid: makeGrid(8, 8), mode }
```

- [ ] **Step 6: Update `deleteCharacter`**

Find:
```js
  function deleteCharacter(idx) {
    if (characters.length <= 1) return
    const next = characters.filter((_, i) => i !== idx)
    setCharacters(next)
    const newIdx = Math.min(idx, next.length - 1)
    setSelectedIdx(newIdx)
    setGrid(next[newIdx].grid)
  }
```
Replace with:
```js
  function deleteCharacter(idx) {
    if (characters.length <= 1) return
    const next = characters.filter((_, i) => i !== idx)
    setCharacters(next)
    const newIdx = Math.min(idx, next.length - 1)
    setSelectedIdx(newIdx)
    setGrid(next[newIdx].grid)
    const nextMode = next[newIdx].mode ?? 'keyring'
    if (nextMode !== mode) {
      setMode(nextMode)
      setParams(nextMode === 'coaster' ? COASTER_DEFAULT_PARAMS : KEYRING_DEFAULT_PARAMS)
    }
  }
```

- [ ] **Step 7: Update `handleModeSwitch` to sync the current character's mode**

Find:
```js
  function handleModeSwitch() {
    setMode(prev => {
      const next = prev === 'keyring' ? 'coaster' : 'keyring'
      setParams(next === 'coaster' ? COASTER_DEFAULT_PARAMS : KEYRING_DEFAULT_PARAMS)
      return next
    })
  }
```
Replace with:
```js
  function handleModeSwitch() {
    setMode(prev => {
      const next = prev === 'keyring' ? 'coaster' : 'keyring'
      setParams(next === 'coaster' ? COASTER_DEFAULT_PARAMS : KEYRING_DEFAULT_PARAMS)
      setCharacters(chars => {
        const copy = [...chars]
        copy[selectedIdx] = { ...copy[selectedIdx], mode: next }
        return copy
      })
      return next
    })
  }
```

- [ ] **Step 8: Update `handleOpen`**

Find:
```js
      if (data?.characters?.length) {
        fileHandle.current = handle
        setCharacters(data.characters)
        setSelectedIdx(0)
        setGrid(data.characters[0].grid)
      }
```
Replace with:
```js
      if (data?.characters?.length) {
        fileHandle.current = handle
        setCharacters(data.characters)
        setSelectedIdx(0)
        setGrid(data.characters[0].grid)
        const firstMode = data.characters[0].mode ?? 'keyring'
        setMode(firstMode)
        setParams(firstMode === 'coaster' ? COASTER_DEFAULT_PARAMS : KEYRING_DEFAULT_PARAMS)
      }
```

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: `✓ built` with no errors.

- [ ] **Step 10: Commit**

```bash
git add src/app/App.jsx
git commit -m "feat: per-character mode — select/add/delete/open/share all propagate mode"
```

---

## Task 4: Segmented mode toggle (App.jsx + style.css)

**Files:**
- Modify: `src/app/App.jsx`
- Modify: `src/app/style.css`

- [ ] **Step 1: Replace the toggle button in App.jsx**

Find:
```jsx
          <button className="btn btn-ghost" onClick={handleModeSwitch}>
            {mode === 'keyring' ? 'Keyring' : 'Coaster'}
          </button>
```
Replace with:
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

- [ ] **Step 2: Add CSS to style.css**

Append after the `.btn-ghost:hover` block (around line 164):
```css
/* ── Mode toggle (segmented control) ───────────────────────── */
.mode-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  flex-shrink: 0;
}

.mode-toggle__btn {
  padding: 6px 14px;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
  white-space: nowrap;
}

.mode-toggle__btn.active {
  background: var(--accent);
  color: #1a1408;
  font-weight: 600;
}

.mode-toggle__btn:hover:not(.active) {
  background: var(--bg-surface);
  color: var(--text-primary);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `✓ built` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/App.jsx src/app/style.css
git commit -m "feat: replace mode toggle with segmented pill control"
```

---

## Task 5: Sidebar mode badge (App.jsx + style.css)

**Files:**
- Modify: `src/app/App.jsx`
- Modify: `src/app/style.css`

- [ ] **Step 1: Add badge JSX in sidebar character list**

Find the non-renaming branch of the character list item (the part with `<span className="char-name">`):
```jsx
                ) : (
                  <span
                    className="char-name"
                    onDoubleClick={(e) => { e.stopPropagation(); setRenaming(i) }}
                  >
                    {ch.name}
                  </span>
                )}
                <span className="char-dims">{ch.grid[0]?.length}&times;{ch.grid.length}</span>
```
Replace with:
```jsx
                ) : (
                  <span
                    className="char-name"
                    onDoubleClick={(e) => { e.stopPropagation(); setRenaming(i) }}
                  >
                    {ch.name}
                  </span>
                )}
                <span className={`char-mode-badge char-mode-badge--${ch.mode ?? 'keyring'}`}>
                  {(ch.mode ?? 'keyring') === 'coaster' ? 'C' : 'K'}
                </span>
                <span className="char-dims">{ch.grid[0]?.length}&times;{ch.grid.length}</span>
```

- [ ] **Step 2: Add badge CSS to style.css**

Append after the `.char-dims` block:
```css
.char-mode-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

.char-mode-badge--keyring {
  background: rgba(76, 194, 255, 0.12);
  color: var(--cyan);
}

.char-mode-badge--coaster {
  background: rgba(232, 167, 53, 0.12);
  color: var(--accent);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `✓ built` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/App.jsx src/app/style.css
git commit -m "feat: add K/C mode badge to sidebar character list"
```

---

## Task 6: Update defaultCharacters.json

**Files:**
- Modify: `src/core/defaultCharacters.json`

- [ ] **Step 1: Add `"mode": "keyring"` to all existing entries**

Add `"mode": "keyring"` as the second field (after `"name"`) to each of the 8 existing characters: invader, ghost, monster, specter, phantom, crab, claude, heart.

The file currently has entries like `{ "name": "invader", "grid": [...] }`. Each becomes `{ "name": "invader", "mode": "keyring", "grid": [...] }`.

- [ ] **Step 2: Add the "sun" coaster character**

Append after the "heart" entry (before the closing `]`):
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

- [ ] **Step 3: Add the "checkered" coaster character**

Append after "sun":
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

- [ ] **Step 4: Verify JSON is valid**

Run:
```bash
node -e "require('./src/core/defaultCharacters.json'); console.log('valid')"
```
Expected: `valid`

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: `✓ built` with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/defaultCharacters.json
git commit -m "feat: add mode field to all default characters; add sun and checkered coaster designs"
```

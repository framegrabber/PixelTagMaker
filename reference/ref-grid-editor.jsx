/**
 * REFERENCE: Grid Editor from apc-invaders
 *
 * Proven click-to-paint 2D pixel grid with drag support.
 * Adapt for PixelTagMaker: reduce to 4 pixel types, remove resize toolbar
 * if not needed, keep the core pointer event pattern.
 */

import { useState, useCallback, useRef } from 'react'

// Pixel type definitions — replace with PixelTagMaker's 4 types
const PIXEL_TYPES = [
  { value: 0, label: 'Empty', color: '#2a2a2e', textColor: '#555' },
  { value: 1, label: 'Raised', color: '#4cc2ff', textColor: '#111' },
  { value: 2, label: 'Flat', color: '#2a8ab8', textColor: '#111' },
  { value: 3, label: 'Keyring', color: '#e8a735', textColor: '#111' },
]

function makeGrid(rows, cols) {
  return Array.from({ length: rows }, () => new Array(cols).fill(0))
}

function resizeGrid(grid, newRows, newCols) {
  const result = makeGrid(newRows, newCols)
  const copyRows = Math.min(grid.length, newRows)
  const copyCols = Math.min(grid[0]?.length || 0, newCols)
  for (let r = 0; r < copyRows; r++)
    for (let c = 0; c < copyCols; c++)
      result[r][c] = grid[r][c]
  return result
}

export default function GridEditor({ grid, onGridChange }) {
  const [activeType, setActiveType] = useState(1)
  const painting = useRef(false)
  const paintType = useRef(1)

  const rows = grid.length
  const cols = grid[0]?.length || 9

  const setCell = useCallback((r, c, value) => {
    onGridChange(prev => {
      const next = prev.map(row => [...row])
      if (next[r][c] !== value) {
        next[r][c] = value
        return next
      }
      return prev
    })
  }, [onGridChange])

  const handlePointerDown = useCallback((r, c, e) => {
    e.preventDefault()
    painting.current = true
    paintType.current = e.button === 2 ? 0 : activeType
    setCell(r, c, paintType.current)
  }, [activeType, setCell])

  const handlePointerEnter = useCallback((r, c) => {
    if (painting.current) setCell(r, c, paintType.current)
  }, [setCell])

  const handlePointerUp = useCallback(() => {
    painting.current = false
  }, [])

  const handleResize = useCallback((newRows, newCols) => {
    onGridChange(prev => resizeGrid(prev, newRows, newCols))
  }, [onGridChange])

  return (
    <div className="grid-editor" onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      {/* Size controls */}
      <div className="ge-toolbar-row">
        <label>Size</label>
        <input type="number" min={1} max={20} value={cols}
          onChange={e => handleResize(rows, Math.max(1, +e.target.value))} />
        <span>×</span>
        <input type="number" min={1} max={20} value={rows}
          onChange={e => handleResize(Math.max(1, +e.target.value), cols)} />
      </div>

      {/* Grid */}
      <div className="ge-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 32px)`,
          gridTemplateRows: `repeat(${rows}, 32px)`,
        }}
        onContextMenu={e => e.preventDefault()}
      >
        {grid.map((row, r) =>
          row.map((val, c) => {
            const pt = PIXEL_TYPES[val] || PIXEL_TYPES[0]
            return (
              <div
                key={`${r}-${c}`}
                className={`ge-cell${val === 0 ? ' ge-cell-empty' : ''}`}
                style={{ backgroundColor: pt.color, color: pt.textColor }}
                onPointerDown={e => handlePointerDown(r, c, e)}
                onPointerEnter={() => handlePointerEnter(r, c)}
              >
                {val === 3 ? '⟲' : ''}
              </div>
            )
          })
        )}
      </div>

      {/* Palette */}
      <div className="ge-palette">
        {PIXEL_TYPES.map(pt => (
          <button
            key={pt.value}
            className={`ge-palette-btn${activeType === pt.value ? ' active' : ''}`}
            style={{ '--swatch': pt.color }}
            onClick={() => setActiveType(pt.value)}
            title={`${pt.value}: ${pt.label}`}
          >
            <span className="ge-swatch" />
            <span>{pt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

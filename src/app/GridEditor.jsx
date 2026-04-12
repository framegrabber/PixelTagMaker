import { useState, useCallback, useRef, useEffect } from 'react'
import { PIXEL_TYPES } from '../core/pixelTypes'

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

export { makeGrid, resizeGrid }

export default function GridEditor({ grid, onGridChange }) {
  const [activeType, setActiveType] = useState(1)
  const painting = useRef(false)
  const paintType = useRef(1)

  const rows = grid.length
  const cols = grid[0]?.length || 9

  const setCell = useCallback((r, c, value) => {
    onGridChange(prev => {
      const next = prev.map(row => [...row])
      if (next[r]?.[c] !== undefined && next[r][c] !== value) {
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

  const handleClear = useCallback(() => {
    onGridChange(() => makeGrid(rows, cols))
  }, [onGridChange, rows, cols])

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key >= '1' && e.key <= '4') setActiveType(+e.key - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="grid-editor" onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      <div className="ge-controls">
        <div className="ge-size">
          <label>Grid</label>
          <input
            type="number" min={3} max={24} value={cols}
            onChange={e => handleResize(rows, Math.max(3, Math.min(24, +e.target.value)))}
          />
          <span className="ge-times">&times;</span>
          <input
            type="number" min={3} max={24} value={rows}
            onChange={e => handleResize(Math.max(3, Math.min(24, +e.target.value)), cols)}
          />
          <button className="btn-small btn-ghost" onClick={handleClear} title="Clear grid">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className="ge-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 32px)`,
          gridTemplateRows: `repeat(${rows}, 32px)`,
          '--hover-color': PIXEL_TYPES[activeType].color,
        }}
        onContextMenu={e => e.preventDefault()}
      >
        {grid.map((row, r) =>
          row.map((val, c) => {
            const pt = PIXEL_TYPES[val] || PIXEL_TYPES[0]
            return (
              <div
                key={`${r}-${c}`}
                className={`ge-cell${val === 0 ? ' ge-empty' : ''} ge-type-${val}`}
                style={{ '--cell-color': pt.color }}
                onPointerDown={e => handlePointerDown(r, c, e)}
                onPointerEnter={() => handlePointerEnter(r, c)}
              >
                {pt.icon}
              </div>
            )
          })
        )}
      </div>

      <div className="ge-palette">
        {PIXEL_TYPES.map(pt => (
          <button
            key={pt.value}
            className={`ge-pal-btn${activeType === pt.value ? ' active' : ''}`}
            style={{ '--swatch': pt.color }}
            onClick={() => setActiveType(pt.value)}
          >
            <span className="ge-swatch" />
            <span className="ge-pal-label">{pt.label}</span>
          </button>
        ))}
      </div>

      <p className="ge-hint">Click to paint &middot; Right-click to erase</p>
    </div>
  )
}

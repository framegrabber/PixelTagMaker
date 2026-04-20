import { useState, useCallback, useRef, useEffect } from 'react'
import { PIXEL_TYPES } from '../core/pixelTypes'

export function makeGrid(rows, cols) {
  return Array.from({ length: rows }, () => new Array(cols).fill(0))
}

export function resizeGrid(grid, newRows, newCols) {
  const result = makeGrid(newRows, newCols)
  const copyRows = Math.min(grid.length, newRows)
  const copyCols = Math.min(grid[0]?.length || 0, newCols)
  for (let r = 0; r < copyRows; r++)
    for (let c = 0; c < copyCols; c++)
      result[r][c] = grid[r][c]
  return result
}

function getBoundingBox(grid) {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity
  grid.forEach((row, r) => row.forEach((v, c) => {
    if (v !== 0) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c) }
  }))
  if (minR === Infinity) return null
  return { minR, maxR, minC, maxC }
}

export default function GridEditor({ grid, onGridChange, raisedColor, flatColor, mode = 'keyring' }) {
  const [activeType, setActiveType] = useState(1)
  const [hoverCell, setHoverCell] = useState(null)

  useEffect(() => {
    if (mode === 'coaster') setActiveType(prev => prev > 2 ? 1 : prev)
  }, [mode])
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

  // Paint a 2×2 block anchored at (r, c) as top-left
  const setQuad = useCallback((r, c, value) => {
    onGridChange(prev => {
      const next = prev.map(row => [...row])
      let changed = false
      for (let dr = 0; dr <= 1; dr++) {
        for (let dc = 0; dc <= 1; dc++) {
          if (next[r + dr]?.[c + dc] !== undefined && next[r + dr][c + dc] !== value) {
            next[r + dr][c + dc] = value
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [onGridChange])

  const handlePointerDown = useCallback((r, c, e) => {
    e.preventDefault()
    painting.current = true
    const isErase = e.button === 2
    paintType.current = isErase ? 0 : activeType
    if (!isErase && activeType === 4) {
      setQuad(r, c, 4)
    } else {
      setCell(r, c, paintType.current)
    }
  }, [activeType, setCell, setQuad])

  const handlePointerEnter = useCallback((r, c) => {
    if (activeType === 4) setHoverCell({ r, c })
    if (painting.current) {
      if (paintType.current === 4) {
        setQuad(r, c, 4)
      } else {
        setCell(r, c, paintType.current)
      }
    }
  }, [activeType, setCell, setQuad])

  const handlePointerUp = useCallback(() => {
    painting.current = false
    setHoverCell(null)
  }, [])

  const handleClear = useCallback(() => {
    onGridChange(() => makeGrid(rows, cols))
  }, [onGridChange, rows, cols])

  // Edge control helpers
  const addRowTop = useCallback(() => {
    onGridChange(prev => [new Array(prev[0].length).fill(0), ...prev])
  }, [onGridChange])

  const removeRowTop = useCallback(() => {
    onGridChange(prev => prev.length > 1 ? prev.slice(1) : prev)
  }, [onGridChange])

  const addRowBottom = useCallback(() => {
    onGridChange(prev => [...prev, new Array(prev[0].length).fill(0)])
  }, [onGridChange])

  const removeRowBottom = useCallback(() => {
    onGridChange(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  }, [onGridChange])

  const addColLeft = useCallback(() => {
    onGridChange(prev => prev.map(row => [0, ...row]))
  }, [onGridChange])

  const removeColLeft = useCallback(() => {
    onGridChange(prev => prev[0].length > 1 ? prev.map(row => row.slice(1)) : prev)
  }, [onGridChange])

  const addColRight = useCallback(() => {
    onGridChange(prev => prev.map(row => [...row, 0]))
  }, [onGridChange])

  const removeColRight = useCallback(() => {
    onGridChange(prev => prev[0].length > 1 ? prev.map(row => row.slice(0, -1)) : prev)
  }, [onGridChange])

  const trimGrid = useCallback(() => {
    onGridChange(prev => {
      const bb = getBoundingBox(prev)
      if (!bb) return prev
      return prev.slice(bb.minR, bb.maxR + 1).map(row => row.slice(bb.minC, bb.maxC + 1))
    })
  }, [onGridChange])

  // Hotkeys 0-4
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const maxKey = mode === 'coaster' ? '2' : '4'
      if (e.key >= '0' && e.key <= maxKey) setActiveType(+e.key)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mode])

  // Clear hover when switching away from type 4
  useEffect(() => {
    if (activeType !== 4) setHoverCell(null)
  }, [activeType])

  return (
    <div className="grid-editor" onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      <div className="ge-grid-area">
        {/* Top edge controls */}
        <div className="ge-edge-row">
          <div className="ge-edge-spacer" />
          <div className="ge-edge-controls">
            <button className="ge-edge-btn" onClick={addRowTop} title="Add row at top">+</button>
            <button className="ge-edge-btn" onClick={removeRowTop} title="Remove top row">−</button>
          </div>
          <div className="ge-edge-spacer" />
        </div>

        {/* Middle row: left controls + grid + right controls */}
        <div className="ge-edge-middle">
          <div className="ge-edge-controls ge-edge-vert">
            <button className="ge-edge-btn" onClick={addColLeft} title="Add column at left">+</button>
            <button className="ge-edge-btn" onClick={removeColLeft} title="Remove left column">−</button>
          </div>

          <div
            className="ge-grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, 32px)`,
              gridTemplateRows: `repeat(${rows}, 32px)`,
              '--hover-color': activeType === 4 ? 'transparent'
                : activeType === 1 ? (raisedColor || PIXEL_TYPES[1].color)
                : activeType === 2 ? (flatColor || PIXEL_TYPES[2].color)
                : PIXEL_TYPES[activeType]?.color,
            }}
            onContextMenu={e => e.preventDefault()}
          >
            {grid.map((row, r) =>
              row.map((val, c) => {
                const pt = PIXEL_TYPES[val] || PIXEL_TYPES[0]
                const cellColor = val === 1 ? (raisedColor || pt.color)
                  : val === 2 ? (flatColor || pt.color)
                  : pt.color
                const inQuad = activeType === 4 && hoverCell &&
                  r >= hoverCell.r && r <= hoverCell.r + 1 &&
                  c >= hoverCell.c && c <= hoverCell.c + 1
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`ge-cell${val === 0 ? ' ge-empty' : ''} ge-type-${val}${inQuad ? ' ge-quad-hover' : ''}`}
                    style={{ '--cell-color': cellColor, '--quad-color': PIXEL_TYPES[4].color }}
                    onPointerDown={e => handlePointerDown(r, c, e)}
                    onPointerEnter={() => handlePointerEnter(r, c)}
                  >
                    {pt.icon}
                  </div>
                )
              })
            )}
          </div>

          <div className="ge-edge-controls ge-edge-vert">
            <button className="ge-edge-btn" onClick={addColRight} title="Add column at right">+</button>
            <button className="ge-edge-btn" onClick={removeColRight} title="Remove right column">−</button>
          </div>
        </div>

        {/* Bottom edge controls */}
        <div className="ge-edge-row">
          <div className="ge-edge-spacer" />
          <div className="ge-edge-controls">
            <button className="ge-edge-btn" onClick={addRowBottom} title="Add row at bottom">+</button>
            <button className="ge-edge-btn" onClick={removeRowBottom} title="Remove bottom row">−</button>
            <button className="ge-edge-btn ge-trim-btn" onClick={trimGrid} title="Shrink to used pixels">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
              </svg>
            </button>
            <button className="ge-edge-btn ge-clear-btn" onClick={handleClear} title="Clear grid">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2" />
              </svg>
            </button>
          </div>
          <div className="ge-edge-spacer" />
        </div>
      </div>

      {/* Palette */}
      <div className="ge-palette">
        {PIXEL_TYPES.filter(pt => mode === 'coaster' ? pt.value <= 2 : true).map(pt => {
          const swatchColor = pt.value === 1 ? (raisedColor || pt.color)
            : pt.value === 2 ? (flatColor || pt.color)
            : pt.color
          return (
          <button
            key={pt.value}
            className={`ge-pal-btn${activeType === pt.value ? ' active' : ''}`}
            style={{ '--swatch': swatchColor }}
            onClick={() => setActiveType(pt.value)}
          >
            <span className="ge-swatch" />
            <span className="ge-pal-label">{pt.label}</span>
          </button>
          )
        })}
      </div>

      <p className="ge-hint">Click to paint &middot; Right-click to erase &middot; Keys 0–{mode === 'coaster' ? '2' : '4'} select type</p>
    </div>
  )
}

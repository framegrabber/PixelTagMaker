import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import GridEditor, { makeGrid } from './GridEditor'
import Viewer from './Viewer'
import ExportButton from './ExportButton'
import { generateMesh } from '../core/generator'
import { getManifold } from '../core/manifold'
import { openJsonFile, saveJsonFile } from '../core/fileIO'
import defaultLib from '../core/defaultCharacters.json'

const DEFAULT_PARAMS = { pixelSize: 4, pixelHeight: 2, thickness: 2, chamfer: 0, holeSize: 2 }

function encodeShare(name, grid, params) {
  const payload = JSON.stringify({ name, grid, params })
  // btoa needs binary string; handle unicode via encodeURIComponent
  const b64 = btoa(encodeURIComponent(payload))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decodeShare(encoded) {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const payload = decodeURIComponent(atob(b64))
    return JSON.parse(payload)
  } catch {
    return null
  }
}

export default function App() {
  const [characters, setCharacters] = useState(defaultLib.characters)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [grid, setGrid] = useState(defaultLib.characters[0].grid)
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [showSettings, setShowSettings] = useState(false)
  const [copied, setCopied] = useState(false)

  const [threeGeometry, setThreeGeometry] = useState(null)
  const [manifoldMesh, setManifoldMesh] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [wasmReady, setWasmReady] = useState(false)
  const [wasmError, setWasmError] = useState(null)

  const fileHandle = useRef(null)
  const genTimer = useRef(null)
  const genCounter = useRef(0)
  const [renaming, setRenaming] = useState(null)

  const selected = characters[selectedIdx]

  const usedDimensions = useMemo(() => {
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity
    grid.forEach((row, r) => row.forEach((v, c) => {
      if (v !== 0) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r)
        minC = Math.min(minC, c); maxC = Math.max(maxC, c)
      }
    }))
    if (minR === Infinity) return null
    const w = Math.round(((maxC - minC + 1) * params.pixelSize) * 10) / 10
    const h = Math.round(((maxR - minR + 1) * params.pixelSize) * 10) / 10
    return { w, h }
  }, [grid, params.pixelSize])

  // Pre-warm WASM
  useEffect(() => {
    getManifold()
      .then(() => setWasmReady(true))
      .catch(err => {
        console.error('Manifold WASM failed to load:', err)
        setWasmError(err.message)
      })
  }, [])

  useEffect(() => {
    const params_url = new URLSearchParams(window.location.search)
    const encoded = params_url.get('share')
    if (!encoded) return
    const data = decodeShare(encoded)
    if (!data?.grid) return
    const newIdx = defaultLib.characters.length  // append after defaults
    setCharacters(prev => {
      // avoid duplicates if already loaded
      if (prev.some(c => c.name === data.name && JSON.stringify(c.grid) === JSON.stringify(data.grid))) return prev
      return [...prev, { name: data.name || 'shared', grid: data.grid }]
    })
    setSelectedIdx(characters.length)
    setGrid(data.grid)
    if (data.params) setParams(prev => ({ ...prev, ...data.params }))
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // Debounced mesh generation
  useEffect(() => {
    if (!wasmReady) return

    if (genTimer.current) clearTimeout(genTimer.current)
    const id = ++genCounter.current

    genTimer.current = setTimeout(async () => {
      if (id !== genCounter.current) return
      setGenerating(true)
      try {
        const result = await generateMesh(grid, params)
        if (id !== genCounter.current) return
        if (result) {
          if (threeGeometry) threeGeometry.dispose()
          setThreeGeometry(result.threeGeometry)
          setManifoldMesh(result.mesh)
        } else {
          setThreeGeometry(null)
          setManifoldMesh(null)
        }
      } catch (err) {
        console.error('Generation failed:', err)
      } finally {
        if (id === genCounter.current) setGenerating(false)
      }
    }, 300)

    return () => clearTimeout(genTimer.current)
  }, [grid, params, wasmReady])

  // Sync grid changes back to character list
  const handleGridChange = useCallback((updater) => {
    setGrid(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setCharacters(chars => {
        const copy = [...chars]
        copy[selectedIdx] = { ...copy[selectedIdx], grid: next }
        return copy
      })
      return next
    })
  }, [selectedIdx])

  function selectCharacter(idx) {
    setSelectedIdx(idx)
    setGrid(characters[idx].grid)
  }

  function addCharacter() {
    const newIdx = characters.length
    const newChar = { name: 'untitled', grid: makeGrid(8, 8) }
    setCharacters(prev => [...prev, newChar])
    setSelectedIdx(newIdx)
    setGrid(newChar.grid)
    setRenaming(newIdx)
  }

  function deleteCharacter(idx) {
    if (characters.length <= 1) return
    const next = characters.filter((_, i) => i !== idx)
    setCharacters(next)
    const newIdx = Math.min(idx, next.length - 1)
    setSelectedIdx(newIdx)
    setGrid(next[newIdx].grid)
  }

  function renameCharacter(idx, name) {
    setCharacters(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], name: name.trim() || 'untitled' }
      return copy
    })
    setRenaming(null)
  }

  async function handleOpen() {
    try {
      const { handle, data } = await openJsonFile()
      if (data?.characters?.length) {
        fileHandle.current = handle
        setCharacters(data.characters)
        setSelectedIdx(0)
        setGrid(data.characters[0].grid)
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Open failed:', err)
    }
  }

  async function handleSave() {
    try {
      const data = { version: 1, characters }
      fileHandle.current = await saveJsonFile(data, fileHandle.current)
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Save failed:', err)
    }
  }

  function updateParam(key, value) {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  async function handleShare() {
    const encoded = encodeShare(selected?.name || 'untitled', grid, params)
    const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`
    window.history.replaceState({}, '', `?share=${encoded}`)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // clipboard not available, URL is still in address bar
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <h1 className="logo">Pixel<span>Tag</span>Maker</h1>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={handleOpen}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5z" />
            </svg>
            Open
          </button>
          <button className="btn btn-ghost" onClick={handleSave}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save
          </button>
          <button className="btn btn-ghost" onClick={handleShare}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {copied ? 'Copied!' : 'Share'}
          </button>
          <ExportButton manifoldMesh={manifoldMesh} characterName={selected?.name} />
        </div>
      </header>

      {/* Main content */}
      <div className="main">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Characters</h2>
            <button className="btn-icon" onClick={addCharacter} title="New character">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
          <ul className="char-list">
            {characters.map((ch, i) => (
              <li
                key={i}
                className={`char-item${i === selectedIdx ? ' active' : ''}`}
                onClick={() => selectCharacter(i)}
              >
                {renaming === i ? (
                  <input
                    className="char-rename"
                    defaultValue={ch.name === 'untitled' ? '' : ch.name}
                    autoFocus
                    onBlur={e => renameCharacter(i, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameCharacter(i, e.target.value)
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="char-name"
                    onDoubleClick={(e) => { e.stopPropagation(); setRenaming(i) }}
                  >
                    {ch.name}
                  </span>
                )}
                <span className="char-dims">{ch.grid[0]?.length}&times;{ch.grid.length}</span>
                {characters.length > 1 && (
                  <button
                    className="char-del"
                    onClick={e => { e.stopPropagation(); deleteCharacter(i) }}
                    title="Delete"
                  >
                    &times;
                  </button>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* Editor + Viewer */}
        <section className="workspace">
          <div className="editor-pane">
            {wasmError && (
              <div className="wasm-error">
                Failed to load 3D engine: {wasmError}
              </div>
            )}
            <GridEditor grid={grid} onGridChange={handleGridChange} />

            {/* Settings */}
            <div className="settings-section">
              <button
                className="settings-toggle"
                onClick={() => setShowSettings(s => !s)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: showSettings ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Print Settings
              </button>
              {showSettings && (
                <div className="settings-grid">
                  <ParamSlider label="Pixel size" unit="mm" value={params.pixelSize} min={2} max={10} step={0.5} onChange={v => updateParam('pixelSize', v)} />
                  <ParamSlider label="Pixel height" unit="mm" value={params.pixelHeight} min={0.5} max={5} step={0.25} onChange={v => updateParam('pixelHeight', v)} />
                  <ParamSlider label="Thickness" unit="mm" value={params.thickness} min={1} max={5} step={0.25} onChange={v => updateParam('thickness', v)} />
                  <ParamSlider label="Chamfer" unit="mm" value={params.chamfer} min={0} max={0.5} step={0.05} onChange={v => updateParam('chamfer', v)} />
                  <ParamSlider label="Hole size" unit="mm" value={params.holeSize} min={0.5} max={params.pixelSize * 0.9} step={0.1} onChange={v => updateParam('holeSize', v)} />
                </div>
              )}
            </div>
            {usedDimensions && (
              <div className="dimensions-display">
                <span className="dim-label">Print size</span>
                <span className="dim-value">{usedDimensions.w} × {usedDimensions.h} mm</span>
              </div>
            )}
          </div>

          <div className="viewer-pane">
            <Viewer geometry={threeGeometry} generating={generating} />
            {!wasmReady && !wasmError && (
              <div className="wasm-loading">
                <div className="viewer-spinner" />
                Loading 3D engine...
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function ParamSlider({ label, unit, value, min, max, step, onChange }) {
  return (
    <div className="param-row">
      <label className="param-label">{label}</label>
      <input
        type="range" className="param-range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
      />
      <span className="param-value">{value}{unit}</span>
    </div>
  )
}

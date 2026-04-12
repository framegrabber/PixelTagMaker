# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PixelTagMaker is a browser-based pixel art keyring generator. Users draw on a 2D grid, each pixel becomes a 3D block, and the result exports as a manifold STL file for 3D printing. Fully static — no backend.

## Tech Stack

- **Build**: Vite (React template)
- **UI**: React
- **CSG Engine**: manifold-3d (WASM) — guarantees manifold output, no mesh repair needed
- **3D Preview**: Three.js with OrbitControls
- **STL Export**: Binary STL from Manifold's getMesh()
- **File I/O**: File System Access API with fallback for Firefox/Safari

## Commands

```bash
npm install                  # Install dependencies
npm run dev                  # Start Vite dev server with HMR
npm run build                # Production build to dist/
npm run preview              # Preview production build locally
```

## Architecture

```
src/
  app/                       # React UI components
    App.jsx                  # Root — file management + layout
    GridEditor.jsx           # 2D pixel grid, click/drag to paint
    Viewer.jsx               # Three.js 3D preview
    ExportButton.jsx         # STL download trigger
    style.css                # Dark theme
    main.jsx                 # Entry point
  core/                      # Pure logic, no React
    pixelTypes.js            # Pixel type definitions (0=Empty, 1=Raised, 2=Flat, 3=Keyring)
    generator.js             # Grid → Manifold mesh (boxes + chamfers + bridges + keyring loops)
    keyringGeometry.js       # Keyring loop attachment geometry for Type 3 pixels
    stlExport.js             # Manifold mesh → binary STL buffer
reference/                   # Proven patterns from apc-invaders — adapt, don't copy verbatim
```

## Pixel Types

| Value | Name | 3D Geometry |
|-------|------|-------------|
| 0 | Empty | No geometry |
| 1 | Raised | Full-height block with chamfered top edges |
| 2 | Flat | Shorter block flush with base |
| 3 | Keyring | Full-height block + protruding loop with hole for a jump ring |

## Critical Implementation Rules

**Diagonal bridges are mandatory.** Pixels connected only at corners need bridge geometry or the 3D model splits into disconnected parts during printing. Use `findDiagonalBridges()` from `reference/ref-diagonal-bridges.js`.

**Never use JSCAD for CSG.** It produces non-manifold meshes with naked edges. manifold-3d is the correct choice — it's what OpenSCAD uses internally.

**Three.js viewer anti-patterns** (all caused crashes in the predecessor project):
- Never allocate objects in the render/animation loop (caused OOM)
- Never auto-fit camera on every geometry update (only on first load + explicit button)
- Use `useRef` for mutable Three.js state, not React state (avoids re-render fights with rAF)
- Debounce geometry regeneration by 300ms+ during rapid painting

**Manifold mesh → Three.js/STL:** `getMesh()` returns `{ vertProperties, triVerts }` — flat Float32Array/Uint32Array. See `reference/ref-stl-export.js` for binary STL conversion.

**File I/O:** Use File System Access API (`showOpenFilePicker`/`showSaveFilePicker`) with `<input type="file">` + Blob download fallback. See `reference/ref-file-io.js`.

## Character Library Format

JSON with `{ version: 1, characters: [{ name, grid: number[][] }] }`. A bundled default library ships for first-time users. Sample data is in `reference/ref-sample-characters.json`.

## Key Parameters (user-adjustable)

- Pixel size: 4mm (2-10mm)
- Pixel height: 2mm (0.5-5mm) — protrusion above base
- Base height: 2mm (1-5mm)
- Chamfer: 0.2mm (0-0.5mm)

## Reference Files

The `reference/` directory contains proven code from the apc-invaders predecessor. These are reference implementations to adapt — the grid editor, diagonal bridge algorithm, STL export, file I/O, viewer patterns, and dark theme CSS.

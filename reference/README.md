# PixelTagMaker Reference Files

Reference code and spec for the PixelTagMaker spin-off project, extracted from the apc-invaders codebase.

## Contents

| File | Purpose |
|------|---------|
| `SPEC.md` | **Start here.** Full product spec with architecture, implementation hints, and anti-patterns. |
| `ref-grid-editor.jsx` | Proven click-to-paint 2D grid editor (React). Adapt for 4 pixel types. |
| `ref-diagonal-bridges.js` | Algorithm to detect diagonal-only pixel connections. Critical for printable geometry. |
| `ref-stl-export.js` | Binary STL serialization from Manifold mesh + browser download helper. |
| `ref-file-io.js` | File open/save patterns with File System Access API + fallback. |
| `ref-viewer-patterns.js` | Three.js viewer anti-patterns and fixes (OOM prevention, camera stability, debouncing). |
| `ref-dark-theme.css` | Dark theme CSS variables and grid editor component styles. |
| `ref-sample-characters.json` | Sample character library in the JSON format the app uses. |

## Quick Start for Agent Team

1. Read `SPEC.md` thoroughly — it contains the full architecture and all lessons learned
2. Initialize: `npm create vite@latest pixeltagmaker -- --template react` then `npm install manifold-3d three`
3. Copy/adapt reference files into the new project structure
4. The spec's "What NOT to Do" section lists critical pitfalls from the apc-invaders project

## Key Technical Decisions

- **manifold-3d** (WASM) for CSG — guaranteed manifold STL output, no repair needed
- **Three.js** for 3D preview — reliable, huge ecosystem, OrbitControls built in
- **JSON** for character files — native to JS, no parser needed
- **Vite** for build — static output, fast HMR, deploy anywhere
- **File System Access API** with fallback — works on all browsers, no server needed

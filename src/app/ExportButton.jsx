import { useState } from 'react'
import { meshToStl, downloadStl } from '../core/stlExport'

export default function ExportButton({ manifoldMesh, characterName }) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (!manifoldMesh) return
    setExporting(true)
    try {
      const stlData = meshToStl(manifoldMesh)
      const filename = `${(characterName || 'keyring').replace(/\s+/g, '_')}.stl`
      downloadStl(stlData, filename)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      className="btn btn-accent"
      onClick={handleExport}
      disabled={!manifoldMesh || exporting}
      title={manifoldMesh ? 'Download STL file' : 'Draw something first'}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      {exporting ? 'Exporting...' : 'Export STL'}
    </button>
  )
}

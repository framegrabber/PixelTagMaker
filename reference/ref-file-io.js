/**
 * REFERENCE: File I/O patterns for static browser apps
 *
 * File System Access API (Chrome/Edge) with fallback for Firefox/Safari.
 */

// ═══════════════════════════════════════════════════════════════════
// OPEN FILE
// ═══════════════════════════════════════════════════════════════════

/**
 * Open a JSON file. Returns { handle, data } on success.
 * handle is null on browsers without File System Access API.
 */
export async function openJsonFile() {
  // Try File System Access API first (Chrome/Edge)
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    })
    const file = await handle.getFile()
    const text = await file.text()
    return { handle, data: JSON.parse(text) }
  }

  // Fallback: classic file input
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files[0]
      if (!file) return reject(new Error('No file selected'))
      const text = await file.text()
      resolve({ handle: null, data: JSON.parse(text) })
    }
    input.click()
  })
}

// ═══════════════════════════════════════════════════════════════════
// SAVE FILE
// ═══════════════════════════════════════════════════════════════════

/**
 * Save JSON data. If handle is available (from previous open), writes
 * to the same file. Otherwise triggers a download.
 */
export async function saveJsonFile(data, handle, filename = 'characters.json') {
  const text = JSON.stringify(data, null, 2)

  // Try writing to existing handle
  if (handle) {
    try {
      const writable = await handle.createWritable()
      await writable.write(text)
      await writable.close()
      return handle
    } catch (e) {
      console.warn('File handle write failed, falling back to download:', e)
    }
  }

  // Try Save As dialog (Chrome/Edge)
  if (window.showSaveFilePicker) {
    try {
      const newHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await newHandle.createWritable()
      await writable.write(text)
      await writable.close()
      return newHandle
    } catch (e) {
      if (e.name === 'AbortError') return handle // user cancelled
      console.warn('showSaveFilePicker failed:', e)
    }
  }

  // Fallback: download
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return null
}

// ═══════════════════════════════════════════════════════════════════
// CHARACTER LIBRARY FORMAT
// ═══════════════════════════════════════════════════════════════════

/**
 * Example JSON structure:
 *
 * {
 *   "version": 1,
 *   "characters": [
 *     {
 *       "name": "invader",
 *       "grid": [
 *         [0,0,1,0,0,0,0,0,1,0,0],
 *         [0,0,0,1,0,0,0,1,0,0,0],
 *         ...
 *       ]
 *     }
 *   ]
 * }
 */

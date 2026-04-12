export async function openJsonFile() {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    })
    const file = await handle.getFile()
    const text = await file.text()
    return { handle, data: JSON.parse(text) }
  }

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

export async function saveJsonFile(data, handle, filename = 'characters.json') {
  const text = JSON.stringify(data, null, 2)

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
      if (e.name === 'AbortError') return handle
      console.warn('showSaveFilePicker failed:', e)
    }
  }

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

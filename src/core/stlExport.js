export function meshToStl(mesh) {
  const { vertProperties, triVerts, numProp } = mesh
  const numTris = triVerts.length / 3
  const buf = new ArrayBuffer(84 + numTris * 50)
  const view = new DataView(buf)

  view.setUint32(80, numTris, true)

  let offset = 84
  for (let t = 0; t < numTris; t++) {
    const i0 = triVerts[t * 3]
    const i1 = triVerts[t * 3 + 1]
    const i2 = triVerts[t * 3 + 2]

    const ax = vertProperties[i0 * numProp], ay = vertProperties[i0 * numProp + 1], az = vertProperties[i0 * numProp + 2]
    const bx = vertProperties[i1 * numProp], by = vertProperties[i1 * numProp + 1], bz = vertProperties[i1 * numProp + 2]
    const cx = vertProperties[i2 * numProp], cy = vertProperties[i2 * numProp + 1], cz = vertProperties[i2 * numProp + 2]

    const abx = bx - ax, aby = by - ay, abz = bz - az
    const acx = cx - ax, acy = cy - ay, acz = cz - az
    let nx = aby * acz - abz * acy
    let ny = abz * acx - abx * acz
    let nz = abx * acy - aby * acx
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
    nx /= len; ny /= len; nz /= len

    view.setFloat32(offset, nx, true); offset += 4
    view.setFloat32(offset, ny, true); offset += 4
    view.setFloat32(offset, nz, true); offset += 4
    view.setFloat32(offset, ax, true); offset += 4
    view.setFloat32(offset, ay, true); offset += 4
    view.setFloat32(offset, az, true); offset += 4
    view.setFloat32(offset, bx, true); offset += 4
    view.setFloat32(offset, by, true); offset += 4
    view.setFloat32(offset, bz, true); offset += 4
    view.setFloat32(offset, cx, true); offset += 4
    view.setFloat32(offset, cy, true); offset += 4
    view.setFloat32(offset, cz, true); offset += 4
    view.setUint16(offset, 0, true); offset += 2
  }

  return new Uint8Array(buf)
}

export function downloadStl(data, filename = 'keyring.stl') {
  const blob = new Blob([data], { type: 'application/sla' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

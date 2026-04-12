/**
 * REFERENCE: Binary STL export from triangle mesh
 *
 * Manifold's getMesh() returns { vertProperties, triVerts }.
 * This converts to binary STL format for 3D printing.
 *
 * No repair needed — Manifold guarantees manifold output.
 */

/**
 * Convert a Manifold mesh to binary STL.
 *
 * @param {{ vertProperties: Float32Array, triVerts: Uint32Array }} mesh
 *   vertProperties: flat array [x,y,z, x,y,z, ...] (3 floats per vertex)
 *   triVerts: flat array [i0,i1,i2, i0,i1,i2, ...] (3 indices per triangle)
 * @returns {Uint8Array} Binary STL data
 */
export function meshToStl(mesh) {
  const { vertProperties, triVerts } = mesh
  const numTris = triVerts.length / 3
  const buf = new ArrayBuffer(84 + numTris * 50)
  const view = new DataView(buf)

  // 80-byte header (zeros)
  view.setUint32(80, numTris, true)

  let offset = 84
  for (let t = 0; t < numTris; t++) {
    const i0 = triVerts[t * 3]
    const i1 = triVerts[t * 3 + 1]
    const i2 = triVerts[t * 3 + 2]

    // Vertex positions (3 floats each, stride 3 in vertProperties)
    const ax = vertProperties[i0 * 3], ay = vertProperties[i0 * 3 + 1], az = vertProperties[i0 * 3 + 2]
    const bx = vertProperties[i1 * 3], by = vertProperties[i1 * 3 + 1], bz = vertProperties[i1 * 3 + 2]
    const cx = vertProperties[i2 * 3], cy = vertProperties[i2 * 3 + 1], cz = vertProperties[i2 * 3 + 2]

    // Compute face normal via cross product
    const abx = bx - ax, aby = by - ay, abz = bz - az
    const acx = cx - ax, acy = cy - ay, acz = cz - az
    let nx = aby * acz - abz * acy
    let ny = abz * acx - abx * acz
    let nz = abx * acy - aby * acx
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
    nx /= len; ny /= len; nz /= len

    // Normal
    view.setFloat32(offset, nx, true); offset += 4
    view.setFloat32(offset, ny, true); offset += 4
    view.setFloat32(offset, nz, true); offset += 4
    // Vertex 1
    view.setFloat32(offset, ax, true); offset += 4
    view.setFloat32(offset, ay, true); offset += 4
    view.setFloat32(offset, az, true); offset += 4
    // Vertex 2
    view.setFloat32(offset, bx, true); offset += 4
    view.setFloat32(offset, by, true); offset += 4
    view.setFloat32(offset, bz, true); offset += 4
    // Vertex 3
    view.setFloat32(offset, cx, true); offset += 4
    view.setFloat32(offset, cy, true); offset += 4
    view.setFloat32(offset, cz, true); offset += 4
    // Attribute byte count
    view.setUint16(offset, 0, true); offset += 2
  }

  return new Uint8Array(buf)
}

/**
 * Trigger a browser download of a Uint8Array as an STL file.
 */
export function downloadStl(data, filename = 'model.stl') {
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

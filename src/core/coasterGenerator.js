import { getManifold } from './manifold.js'
import * as THREE from 'three'

function isOn(grid, row, col) {
  if (row < 0 || row >= grid.length) return false
  if (col < 0 || col >= grid[0].length) return false
  return grid[row][col] > 0
}

function findDiagonalBridges(grid) {
  const rows = grid.length
  const cols = grid[0]?.length || 0
  const bridges = []
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols; col++) {
      if (col < cols - 1) {
        if (isOn(grid, row, col) && isOn(grid, row + 1, col + 1) &&
            !isOn(grid, row, col + 1) && !isOn(grid, row + 1, col)) {
          bridges.push({ x: col + 1, y: rows - 1 - row })
        }
      }
      if (col > 0) {
        if (isOn(grid, row, col) && isOn(grid, row + 1, col - 1) &&
            !isOn(grid, row, col - 1) && !isOn(grid, row + 1, col)) {
          bridges.push({ x: col, y: rows - 1 - row })
        }
      }
    }
  }
  return bridges
}

function createChamferedBlock(Manifold, ps, totalHeight, chamfer) {
  if (chamfer <= 0 || chamfer >= totalHeight * 0.5) {
    return Manifold.cube([ps, ps, totalHeight])
  }
  const base = Manifold.cube([ps, ps, totalHeight - chamfer])
  const cap = Manifold.cube([ps - 2 * chamfer, ps - 2 * chamfer, chamfer])
    .translate([chamfer, chamfer, totalHeight - chamfer])
  return Manifold.hull([base, cap])
}

function partsToThreeGeometry(parts, Manifold) {
  if (parts.length === 0) return null
  const result = parts.length === 1 ? parts[0] : Manifold.union(parts)
  const { vertProperties, triVerts, numProp } = result.getMesh()
  const vertCount = vertProperties.length / numProp
  const positions = new Float32Array(vertCount * 3)
  for (let i = 0; i < vertCount; i++) {
    positions[i * 3]     = vertProperties[i * numProp]
    positions[i * 3 + 1] = vertProperties[i * numProp + 1]
    positions[i * 3 + 2] = vertProperties[i * numProp + 2]
  }
  const indexed = new THREE.BufferGeometry()
  indexed.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  indexed.setIndex(new THREE.BufferAttribute(new Uint32Array(triVerts), 1))
  const geometry = indexed.toNonIndexed()
  geometry.computeVertexNormals()
  if (parts.length > 1) result.delete()
  return geometry
}

/**
 * Generate a Manifold mesh from a 2D pixel grid in coaster mode.
 * Returns { mesh, raisedGeometry, flatGeometry } or null if grid is empty.
 * raisedGeometry covers type 1 pixels and diagonal bridges.
 * flatGeometry covers type 2 pixels and the base plate.
 */
export async function generateCoaster(grid, params) {
  const {
    pixelSize: ps = 6,
    pixelHeight = 1,
    thickness = 4,
    chamfer = 0.3,
  } = params

  const wasm = await getManifold()
  const { Manifold, CrossSection } = wasm

  const rows = grid.length
  const cols = grid[0]?.length || 0
  const totalHeight = thickness + pixelHeight

  // Bounding box of non-empty pixels
  let minR = rows, maxR = -1, minC = cols, maxC = -1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== 0) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r)
        minC = Math.min(minC, c); maxC = Math.max(maxC, c)
      }
    }
  }
  if (maxR === -1) return null

  const bboxW = (maxC - minC + 1) * ps
  const bboxH = (maxR - minR + 1) * ps
  const originX = minC * ps
  const originY = (rows - 1 - maxR) * ps

  // Solid base plate covering the full bounding box
  const basePlate = Manifold.cube([bboxW, bboxH, thickness]).translate([originX, originY, 0])

  const raisedParts = []
  const flatParts = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = grid[r][c]
      if (val === 0 || val > 2) continue
      const x = c * ps
      const y = (rows - 1 - r) * ps
      if (val === 2) {
        flatParts.push(Manifold.cube([ps, ps, thickness]).translate([x, y, 0]))
      } else {
        raisedParts.push(
          createChamferedBlock(Manifold, ps, totalHeight, chamfer).translate([x, y, 0])
        )
      }
    }
  }

  // Diagonal bridges (into raisedParts — mandatory for manifold output)
  const bridges = findDiagonalBridges(grid)
  const bridgeW = ps * 0.3
  const half = bridgeW / 2
  for (const b of bridges) {
    const diamond = new CrossSection([[[half, 0], [0, half], [-half, 0], [0, -half]]])
    raisedParts.push(
      Manifold.extrude(diamond, thickness).translate([b.x * ps, b.y * ps, 0])
    )
  }

  // Three.js geometries for two-tone rendering
  const raisedGeometry = partsToThreeGeometry(raisedParts, Manifold)
  const flatGeometry = partsToThreeGeometry([...flatParts, basePlate], Manifold)

  // Combined STL mesh
  const allParts = [...raisedParts, ...flatParts, basePlate]
  const combined = allParts.length === 1 ? allParts[0] : Manifold.union(allParts)
  const mesh = combined.getMesh()

  for (const p of [...raisedParts, ...flatParts]) p.delete()
  basePlate.delete()
  if (allParts.length > 1) combined.delete()

  return { mesh, raisedGeometry, flatGeometry }
}

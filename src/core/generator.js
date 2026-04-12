import { getManifold } from './manifold.js'
import { detectDirection, createKeyringLoop } from './keyringGeometry.js'
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
  const cap = Manifold.cube([
    ps - 2 * chamfer, ps - 2 * chamfer, chamfer
  ]).translate([chamfer, chamfer, totalHeight - chamfer])
  return Manifold.hull([base, cap])
}

/**
 * Generate a Manifold mesh from a 2D pixel grid.
 * Returns { manifoldMesh, threeGeometry } or null if grid is empty.
 */
export async function generateMesh(grid, params) {
  const { pixelSize = 4, pixelHeight = 2, baseHeight = 2, chamfer = 0.2 } = params
  const wasm = await getManifold()
  const { Manifold, CrossSection } = wasm

  const rows = grid.length
  const cols = grid[0]?.length || 0
  const totalHeight = baseHeight + pixelHeight
  const parts = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const val = grid[row][col]
      if (val === 0) continue

      const x = col * pixelSize
      const y = (rows - 1 - row) * pixelSize

      if (val === 2) {
        // Flat: base height only, no chamfer
        const block = Manifold.cube([pixelSize, pixelSize, baseHeight])
          .translate([x, y, 0])
        parts.push(block)
      } else {
        // Raised (1) or Keyring (3): full height with chamfer
        const block = createChamferedBlock(Manifold, pixelSize, totalHeight, chamfer)
          .translate([x, y, 0])
        parts.push(block)

        if (val === 3) {
          const dir = detectDirection(grid, row, col)
          const loop = createKeyringLoop(Manifold, pixelSize, totalHeight, dir)
            .translate([x, y, 0])
          parts.push(loop)
        }
      }
    }
  }

  // Diagonal bridges
  const bridges = findDiagonalBridges(grid)
  const bridgeW = pixelSize * 0.3
  const half = bridgeW / 2
  for (const b of bridges) {
    const diamond = new CrossSection([
      [[half, 0], [0, half], [-half, 0], [0, -half]]
    ])
    const bridgeMesh = Manifold.extrude(diamond, totalHeight)
      .translate([b.x * pixelSize, b.y * pixelSize, 0])
    parts.push(bridgeMesh)
  }

  if (parts.length === 0) return null

  const result = Manifold.union(parts)
  const mesh = result.getMesh()

  // Convert to Three.js geometry
  const { vertProperties, triVerts, numProp } = mesh
  const vertCount = vertProperties.length / numProp
  const positions = new Float32Array(vertCount * 3)
  for (let i = 0; i < vertCount; i++) {
    positions[i * 3] = vertProperties[i * numProp]
    positions[i * 3 + 1] = vertProperties[i * numProp + 1]
    positions[i * 3 + 2] = vertProperties[i * numProp + 2]
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(triVerts), 1))
  geometry.computeVertexNormals()

  // Clean up manifold objects
  for (const p of parts) p.delete()
  result.delete()

  return { mesh, threeGeometry: geometry }
}

import { getManifold } from './manifold.js'
import { createKeyringHole, createBigKeyringHole } from './keyringGeometry.js'
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
  const { pixelSize = 4, pixelHeight = 2, thickness = 2, chamfer = 0, holeSize = 2 } = params
  const wasm = await getManifold()
  const { Manifold, CrossSection } = wasm

  const rows = grid.length
  const cols = grid[0]?.length || 0
  const totalHeight = thickness + pixelHeight
  const parts = []

  // Pre-pass: detect valid 2×2 groups of type-4 cells.
  // A cell (r, c) is the top-left of a valid group if all four cells are type 4.
  const quadGroups = []
  const processedByQuad = new Set()

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      if (
        grid[row][col] === 4 && grid[row][col + 1] === 4 &&
        grid[row + 1][col] === 4 && grid[row + 1][col + 1] === 4
      ) {
        quadGroups.push({ r: row, c: col })
        processedByQuad.add(`${row},${col}`)
        processedByQuad.add(`${row},${col + 1}`)
        processedByQuad.add(`${row + 1},${col}`)
        processedByQuad.add(`${row + 1},${col + 1}`)
      }
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const val = grid[row][col]
      if (val === 0) continue
      // Type-4 cells in a valid 2×2 group are handled below
      if (processedByQuad.has(`${row},${col}`)) continue

      const x = col * pixelSize
      const y = (rows - 1 - row) * pixelSize

      if (val === 2) {
        // Flat: base height only, no chamfer
        const block = Manifold.cube([pixelSize, pixelSize, thickness])
          .translate([x, y, 0])
        parts.push(block)
      } else {
        // Raised (1), Keyring (3), or orphaned type-4: full height with chamfer
        let block = createChamferedBlock(Manifold, pixelSize, totalHeight, chamfer)
          .translate([x, y, 0])
        if (val === 3) {
          const hole = createKeyringHole(Manifold, pixelSize, totalHeight, holeSize, chamfer)
          block = block.subtract(hole.translate([x, y, 0]))
        }
        parts.push(block)
      }
    }
  }

  // Build 2×2 quad group solids.
  // The hole is centered at the meeting point of the 4 inner corners:
  //   meetX = (c + 1) * pixelSize
  //   meetY = (rows - 1 - r) * pixelSize  (top edge of row r = bottom edge of row r+1)
  for (const { r, c } of quadGroups) {
    const meetX = (c + 1) * pixelSize
    const meetY = (rows - 1 - r) * pixelSize

    let combined = null
    for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      const bx = (c + dc) * pixelSize
      const by = (rows - 1 - (r + dr)) * pixelSize
      const blk = createChamferedBlock(Manifold, pixelSize, totalHeight, chamfer)
        .translate([bx, by, 0])
      combined = combined ? combined.add(blk) : blk
    }

    const hole = createBigKeyringHole(Manifold, totalHeight, holeSize, chamfer)
      .translate([meetX, meetY, 0])
    parts.push(combined.subtract(hole))
  }

  // Diagonal bridges
  const bridges = findDiagonalBridges(grid)
  const bridgeW = pixelSize * 0.3
  const half = bridgeW / 2
  for (const b of bridges) {
    const diamond = new CrossSection([
      [[half, 0], [0, half], [-half, 0], [0, -half]]
    ])
    const bridgeMesh = Manifold.extrude(diamond, thickness)
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

  const indexed = new THREE.BufferGeometry()
  indexed.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  indexed.setIndex(new THREE.BufferAttribute(new Uint32Array(triVerts), 1))
  const geometry = indexed.toNonIndexed()
  geometry.computeVertexNormals()

  // Clean up manifold objects
  for (const p of parts) p.delete()
  result.delete()

  return { mesh, threeGeometry: geometry }
}

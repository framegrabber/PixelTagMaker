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

function createChamferedBlock(Manifold, ps, height, chamfer) {
  if (chamfer <= 0 || chamfer >= height * 0.5) {
    return Manifold.cube([ps, ps, height])
  }
  const base = Manifold.cube([ps, ps, height - chamfer])
  const cap = Manifold.cube([ps - 2 * chamfer, ps - 2 * chamfer, chamfer])
    .translate([chamfer, chamfer, height - chamfer])
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
 * Split a Manifold solid at outerCyl: inner zone (inside) is translated down by
 * recessDepth and clipped at z=0; outer zone (outside) is unchanged.
 * Does NOT delete geom, outerCyl, or floorClip. Caller deletes return value.
 */
function applySimpleRecess(geom, outerCyl, recessDepth, floorClip, Manifold) {
  const innerRaw = geom.intersect(outerCyl).translate([0, 0, -recessDepth])
  const inner = innerRaw.intersect(floorClip)
  innerRaw.delete()
  const outer = geom.subtract(outerCyl)
  const result = Manifold.union([inner, outer])
  inner.delete()
  outer.delete()
  return result
}

/**
 * Generate a Manifold mesh from a 2D pixel grid in coaster mode.
 * Returns { mesh, raisedGeometry, flatGeometry } or null if grid is empty.
 *
 * Two-layer approach:
 *   baseTiles  — ps×ps×thickness tile per non-empty pixel; gets the filleted recess
 *                applied to its surface. Rendered as flatGeometry (background colour).
 *   raisedArt  — chamfered block of height=pixelHeight sitting atop each type-1 pixel
 *                at Z=thickness; gets a clean split at outerRadius (no fillet on tops).
 *                Rendered as raisedGeometry (accent colour).
 */
export async function generateCoaster(grid, params) {
  const {
    pixelSize: ps = 6,
    pixelHeight = 1,
    thickness = 4,
    chamfer = 0.3,
    recessDiameter = 70,
    recessDepth = 1.5,
    recessOffsetX = 0,
    recessOffsetY = 0,
  } = params
  // fillet equals recess depth, clamped so innerRadius stays > 1mm
  const fr = Math.min(recessDepth, recessDiameter / 2 - 1)

  const wasm = await getManifold()
  const { Manifold, CrossSection } = wasm

  const rows = grid.length
  const cols = grid[0]?.length || 0

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
  const cx = originX + bboxW / 2 + recessOffsetX
  const cy = originY + bboxH / 2 + recessOffsetY

  // Base tiles: one ps×ps×thickness block per non-empty pixel
  // Raised art: chamfered block of pixelHeight placed atop each type-1 pixel
  const baseTiles = []
  const raisedArt = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = grid[r][c]
      if (val === 0 || val > 2) continue
      const x = c * ps
      const y = (rows - 1 - r) * ps
      baseTiles.push(Manifold.cube([ps, ps, thickness]).translate([x, y, 0]))
      if (val === 1) {
        raisedArt.push(
          createChamferedBlock(Manifold, ps, pixelHeight, chamfer).translate([x, y, thickness])
        )
      }
    }
  }

  // Diagonal bridges go into baseTiles (base height, mandatory for manifold output)
  const bridges = findDiagonalBridges(grid)
  const bridgeW = ps * 0.3
  const half = bridgeW / 2
  for (const b of bridges) {
    const diamond = new CrossSection([[[half, 0], [0, half], [-half, 0], [0, -half]]])
    baseTiles.push(
      Manifold.extrude(diamond, thickness).translate([b.x * ps, b.y * ps, 0])
    )
  }

  if (baseTiles.length === 0) return null

  const SEGS = 128
  const N = 16
  const innerRadius = recessDiameter / 2 - fr
  const outerRadius = recessDiameter / 2
  const bigH = (thickness + pixelHeight) * 4

  // --- Filleted recess on base tiles ---
  // Fillet cutter: hull of arc discs tracing quarter-circle
  // Arc center at (innerRadius, thickness); disc i at:
  //   r = innerRadius + fr*sin(t*π/2),  Z = thickness - fr*cos(t*π/2)
  const arcDiscs = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const discR = innerRadius + fr * Math.sin(t * Math.PI / 2)
    const discZ = thickness - fr * Math.cos(t * Math.PI / 2)
    arcDiscs.push(Manifold.cylinder(0.001, discR, discR, SEGS).translate([cx, cy, discZ]))
  }
  const filletCutter = Manifold.hull(arcDiscs)
  for (const d of arcDiscs) d.delete()

  const recessVol = Manifold.cylinder(recessDepth, innerRadius, innerRadius, SEGS)
    .translate([cx, cy, thickness - recessDepth])
  const baseUnion = Manifold.union(baseTiles)
  const baseMinusInner = baseUnion.subtract(recessVol)
  recessVol.delete()
  baseUnion.delete()
  const processedBase = baseMinusInner.subtract(filletCutter)
  baseMinusInner.delete()
  filletCutter.delete()

  // --- Simple recess on raised art (cut at outerRadius, no fillet on pixel tops) ---
  let processedRaised = null
  if (raisedArt.length > 0) {
    const outerCyl = Manifold.cylinder(bigH, outerRadius, outerRadius, SEGS)
      .translate([cx, cy, -bigH / 2])
    const floorClip = Manifold.cube(
      [bboxW + recessDiameter * 2, bboxH + recessDiameter * 2, (thickness + pixelHeight) * 2]
    ).translate([originX - recessDiameter, originY - recessDiameter, 0])
    const raisedUnion = Manifold.union(raisedArt)
    processedRaised = applySimpleRecess(raisedUnion, outerCyl, recessDepth, floorClip, Manifold)
    raisedUnion.delete()
    outerCyl.delete()
    floorClip.delete()
  }

  // Three.js geometries for two-tone rendering
  const raisedGeometry = processedRaised
    ? partsToThreeGeometry([processedRaised], Manifold)
    : null
  const flatGeometry = partsToThreeGeometry([processedBase], Manifold)

  // Combined STL mesh
  const allForMesh = [processedBase]
  if (processedRaised) allForMesh.push(processedRaised)
  const combined = allForMesh.length === 1 ? allForMesh[0] : Manifold.union(allForMesh)
  const mesh = combined.getMesh()

  // Cleanup
  for (const p of [...baseTiles, ...raisedArt]) p.delete()
  processedBase.delete()
  if (processedRaised) processedRaised.delete()
  if (allForMesh.length > 1) combined.delete()

  return { mesh, raisedGeometry, flatGeometry }
}

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
 * Split a Manifold solid into three zones relative to a circular recess and recombine:
 *   inner zone  → translated down by recessDepth
 *   fillet zone → cut by the curved fillet surface
 *   outer zone  → unchanged
 * innerCyl, outerCyl, filletCutter must be full-height columns centered on the recess.
 * Returns a new Manifold. Caller is responsible for deleting the returned value.
 * Does NOT delete geom, innerCyl, outerCyl, or filletCutter.
 */
function applyRecess(geom, innerCyl, outerCyl, filletCutter, recessDepth, Manifold) {
  const inner = geom.intersect(innerCyl).translate([0, 0, -recessDepth])
  const filletZoneRaw = geom.intersect(outerCyl).subtract(innerCyl)
  const filletZone = filletZoneRaw.subtract(filletCutter)
  filletZoneRaw.delete()
  const outer = geom.subtract(outerCyl)
  const result = Manifold.union([inner, filletZone, outer])
  inner.delete()
  filletZone.delete()
  outer.delete()
  return result
}

export async function generateCoaster(grid, params) {
  const {
    pixelSize: ps = 6,
    pixelHeight = 1,
    thickness = 4,
    chamfer = 0.3,
    recessDiameter = 70,
    recessDepth = 1.5,
    filletRadius = 3,
  } = params
  const fr = Math.min(filletRadius, recessDepth) // fillet can't exceed recess depth

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
  const cx = originX + bboxW / 2
  const cy = originY + bboxH / 2

  // Base plate
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

  // Diagonal bridges
  const bridges = findDiagonalBridges(grid)
  const bridgeW = ps * 0.3
  const half = bridgeW / 2
  for (const b of bridges) {
    const diamond = new CrossSection([[[half, 0], [0, half], [-half, 0], [0, -half]]])
    raisedParts.push(
      Manifold.extrude(diamond, thickness).translate([b.x * ps, b.y * ps, 0])
    )
  }

  // --- Recess geometry ---
  const SEGS = 128  // circle smoothness for inner/outer cylinders
  const N = 16      // steps for fillet arc hull
  const innerRadius = recessDiameter / 2 - fr
  const outerRadius = recessDiameter / 2
  const bigH = totalHeight * 4  // tall enough to split all geometry

  // Full-height splitting cylinders
  const innerCyl = Manifold.cylinder(bigH, innerRadius, innerRadius, SEGS)
    .translate([cx, cy, -bigH / 2])
  const outerCyl = Manifold.cylinder(bigH, outerRadius, outerRadius, SEGS)
    .translate([cx, cy, -bigH / 2])

  // Fillet cutter: hull of arc discs + floor disc for clean subtraction
  // Arc center is at (innerRadius, thickness) in (r, Z) space.
  // Disc i: r = innerRadius + fr*sin(i/N * π/2), Z = thickness - fr*cos(i/N * π/2)
  const arcDiscs = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const discR = innerRadius + fr * Math.sin(t * Math.PI / 2)
    const discZ = thickness - fr * Math.cos(t * Math.PI / 2)
    arcDiscs.push(Manifold.cylinder(0.001, discR, discR, SEGS).translate([cx, cy, discZ]))
  }
  arcDiscs.push(Manifold.cylinder(0.001, innerRadius, innerRadius, SEGS).translate([cx, cy, 0]))
  const filletCutter = Manifold.hull(arcDiscs)
  for (const d of arcDiscs) d.delete()

  // Apply recess to raised pixel geometry
  let raisedGeom = null, processedRaised = null
  if (raisedParts.length > 0) {
    raisedGeom = Manifold.union(raisedParts)
    processedRaised = applyRecess(raisedGeom, innerCyl, outerCyl, filletCutter, recessDepth, Manifold)
    raisedGeom.delete()
  }

  // Apply recess to flat pixel geometry
  let flatGeom = null, processedFlat = null
  if (flatParts.length > 0) {
    flatGeom = Manifold.union(flatParts)
    processedFlat = applyRecess(flatGeom, innerCyl, outerCyl, filletCutter, recessDepth, Manifold)
    flatGeom.delete()
  }

  // Apply recess to base plate: subtract the inner cylinder at recessDepth + fillet cutter
  const recessVol = Manifold.cylinder(recessDepth, innerRadius, innerRadius, SEGS)
    .translate([cx, cy, thickness - recessDepth])
  const baseMinusInner = basePlate.subtract(recessVol)
  recessVol.delete()
  const processedBase = baseMinusInner.subtract(filletCutter)
  baseMinusInner.delete()

  // Clean up splitting tools
  innerCyl.delete()
  outerCyl.delete()
  filletCutter.delete()

  // Three.js geometries for two-tone rendering
  const raisedGeometry = processedRaised
    ? partsToThreeGeometry([processedRaised], Manifold)
    : null
  const flatAndBase = []
  if (processedFlat) flatAndBase.push(processedFlat)
  flatAndBase.push(processedBase)
  const flatGeometry = partsToThreeGeometry(flatAndBase, Manifold)

  // Combined STL mesh
  const allForMesh = []
  if (processedRaised) allForMesh.push(processedRaised)
  if (processedFlat) allForMesh.push(processedFlat)
  allForMesh.push(processedBase)
  const combined = allForMesh.length === 1 ? allForMesh[0] : Manifold.union(allForMesh)
  const mesh = combined.getMesh()

  // Cleanup
  for (const p of [...raisedParts, ...flatParts]) p.delete()
  basePlate.delete()
  if (processedRaised) processedRaised.delete()
  if (processedFlat) processedFlat.delete()
  processedBase.delete()
  if (allForMesh.length > 1) combined.delete()

  return { mesh, raisedGeometry, flatGeometry }
}

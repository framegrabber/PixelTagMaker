/**
 * Returns a solid to SUBTRACT from a pixel block to create a keyring through-hole.
 *
 * Manifold.cylinder(height, rLow, rHigh, segments, center=false) goes from z=0 to z=height.
 * The old code used center=true which only reached half the block height — this is the fix.
 *
 * Geometry (all in pixel-local coords, pixel occupies x∈[0,ps], y∈[0,ps], z∈[0,totalHeight]):
 *   - Main shaft: full through-hole from z=-0.1 to z=totalHeight+0.1
 *   - Top flare:  chamfer cone, holeR → holeR+chamfer over the top `chamfer` mm
 *   - Bottom flare: inverted chamfer cone at the bottom opening
 */
export function createKeyringHole(Manifold, pixelSize, totalHeight, holeSize, chamfer) {
  const holeR = holeSize / 2
  const cx = pixelSize / 2
  const cy = pixelSize / 2
  const eps = 0.1 // overlap to avoid boolean coplanar artifacts

  // Main shaft — NOT centered, translated down by eps so it starts below z=0
  const shaft = Manifold.cylinder(totalHeight + 2 * eps, holeR, holeR, 48)
    .translate([cx, cy, -eps])

  if (chamfer <= 0) return shaft

  // Top chamfer: cone from r=holeR at z=totalHeight-chamfer to r=holeR+chamfer at z=totalHeight
  // The extra eps height ensures it breaks cleanly through the block top face
  const topFlare = Manifold.cylinder(chamfer + eps, holeR, holeR + chamfer, 48)
    .translate([cx, cy, totalHeight - chamfer])

  // Bottom chamfer: inverted cone from r=holeR+chamfer at z=0 to r=holeR at z=chamfer
  const bottomFlare = Manifold.cylinder(chamfer + eps, holeR + chamfer, holeR, 48)
    .translate([cx, cy, -eps])

  return Manifold.union([shaft, topFlare, bottomFlare])
}

/**
 * Returns a through-hole solid centered at (0, 0) for use with the 2×2 keyring type.
 * The caller translates this to the meeting point of the 4 cells.
 * Identical geometry to createKeyringHole but without the pixelSize/2 offset.
 */
export function createBigKeyringHole(Manifold, totalHeight, holeSize, chamfer) {
  const holeR = holeSize / 2
  const eps = 0.1

  const shaft = Manifold.cylinder(totalHeight + 2 * eps, holeR, holeR, 48)
    .translate([0, 0, -eps])

  if (chamfer <= 0) return shaft

  const topFlare = Manifold.cylinder(chamfer + eps, holeR, holeR + chamfer, 48)
    .translate([0, 0, totalHeight - chamfer])

  const bottomFlare = Manifold.cylinder(chamfer + eps, holeR + chamfer, holeR, 48)
    .translate([0, 0, -eps])

  return Manifold.union([shaft, topFlare, bottomFlare])
}

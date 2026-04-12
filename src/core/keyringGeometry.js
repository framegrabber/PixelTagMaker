/**
 * Create a keyring pixel: a full-height chamfered block with a centered
 * cylindrical through-hole. The hole diameter is `holeSize`, and if chamfer > 0
 * the hole entrance gets a flared chamfer matching the pixel edge chamfer.
 */
export function createKeyringHole(Manifold, pixelSize, totalHeight, holeSize, chamfer) {
  const holeR = holeSize / 2
  const cx = pixelSize / 2
  const cy = pixelSize / 2

  // Main through-hole cylinder (slightly taller for boolean clean cut)
  const holeCyl = Manifold.cylinder(totalHeight + 0.2, holeR, holeR, 48, true)
    .translate([cx, cy, 0])

  // If chamfer > 0, add a flared entrance at the top (cone frustum)
  // The cone goes from holeR at z=(totalHeight - chamfer) to holeR+chamfer at z=totalHeight
  let result = holeCyl
  if (chamfer > 0) {
    const flare = Manifold.cylinder(chamfer + 0.05, holeR + chamfer, holeR, 48, true)
      .translate([cx, cy, totalHeight - chamfer])
    result = Manifold.union([holeCyl, flare])
  }

  return result
}

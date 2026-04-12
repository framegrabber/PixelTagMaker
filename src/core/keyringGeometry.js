/**
 * Detect which direction a keyring loop should extend from a pixel.
 * Checks adjacent cells for empty space; prefers top > right > bottom > left.
 */
export function detectDirection(grid, row, col) {
  const rows = grid.length
  const cols = grid[0].length
  const checks = [
    { dir: 'top', empty: row === 0 || grid[row - 1][col] === 0 },
    { dir: 'right', empty: col === cols - 1 || grid[row][col + 1] === 0 },
    { dir: 'bottom', empty: row === rows - 1 || grid[row + 1][col] === 0 },
    { dir: 'left', empty: col === 0 || grid[row][col - 1] === 0 },
  ]
  for (const c of checks) {
    if (c.empty) return c.dir
  }
  return 'top'
}

/**
 * Create keyring loop attachment geometry.
 * Returns a Manifold solid positioned relative to pixel origin (0,0,0).
 *
 * The loop is a flat ring (cylinder with hole) connected by a neck.
 * Ring outer diameter ~8mm, hole ~4mm, sized for standard jump rings.
 */
export function createKeyringLoop(Manifold, pixelSize, totalHeight, direction) {
  const ringOuterR = 4
  const ringInnerR = 2
  const neckWidth = Math.min(pixelSize * 0.6, ringOuterR * 1.4)
  const neckLen = ringOuterR * 0.6

  // Ring: cylinder with hole, along Z axis
  const outer = Manifold.cylinder(totalHeight, ringOuterR, ringOuterR, 48)
  const inner = Manifold.cylinder(totalHeight + 0.2, ringInnerR, ringInnerR, 48)
  const ring = outer.subtract(inner)

  // Neck: box connecting pixel edge to ring
  const neck = Manifold.cube([neckWidth, neckLen + ringOuterR, totalHeight])
    .translate([-neckWidth / 2, 0, 0])

  // Combine: ring center at (0, neckLen + ringOuterR, 0), neck from y=0 outward
  const attachment = ring.translate([0, neckLen + ringOuterR, 0]).add(neck)

  // Orient and position based on direction (relative to pixel at origin)
  const half = pixelSize / 2
  switch (direction) {
    case 'top':
      return attachment.translate([half, pixelSize, 0])
    case 'bottom':
      return attachment.rotate([0, 0, 180]).translate([half, 0, 0])
    case 'right':
      return attachment.rotate([0, 0, -90]).translate([pixelSize, half, 0])
    case 'left':
      return attachment.rotate([0, 0, 90]).translate([0, half, 0])
    default:
      return attachment.translate([half, pixelSize, 0])
  }
}

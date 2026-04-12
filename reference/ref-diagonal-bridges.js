/**
 * REFERENCE: Diagonal bridge detection from apc-invaders
 *
 * CRITICAL for 3D printing: pixels connected only at corners
 * need bridge geometry or the model splits into disconnected parts.
 *
 * Use this algorithm as-is in PixelTagMaker's generator.js.
 */

/**
 * Check if grid cell (row, col) is in bounds and non-zero.
 */
export function isOn(grid, row, col) {
  if (row < 0 || row >= grid.length) return false
  if (col < 0 || col >= grid[0].length) return false
  return grid[row][col] > 0
}

/**
 * Find positions where diagonal-only pixel connections exist.
 * Returns array of { x, y } in pixel-coordinate space
 * (multiply by pixelSize to get mm coordinates).
 *
 * For each pair of diagonally-adjacent filled pixels that share
 * NO orthogonal neighbor, a bridge is needed at their shared corner.
 *
 * @param {number[][]} grid - 2D pixel grid
 * @returns {{ x: number, y: number }[]} bridge positions
 */
export function findDiagonalBridges(grid) {
  const rows = grid.length
  const cols = grid[0]?.length || 0
  const bridges = []

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols; col++) {
      // Check southeast diagonal: (row,col) ↘ (row+1,col+1)
      if (col < cols - 1) {
        if (isOn(grid, row, col) && isOn(grid, row + 1, col + 1) &&
            !isOn(grid, row, col + 1) && !isOn(grid, row + 1, col)) {
          // Bridge at the shared corner point
          // In Y-inverted coords: y = (gridRows - 1 - row)
          bridges.push({ x: col + 1, y: rows - 1 - row })
        }
      }

      // Check southwest diagonal: (row,col) ↙ (row+1,col-1)
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

/**
 * USAGE IN MANIFOLD:
 *
 * Bridge geometry: a 45-degree rotated square extruded to base height.
 *
 * ```javascript
 * const bridgeWidth = pixelSize * 0.3; // adjust for strength
 * const bridgeHeight = baseHeight + pixelHeight - chamfer;
 *
 * for (const b of findDiagonalBridges(grid)) {
 *   // Rotated square = diamond shape
 *   // In Manifold: extrude a diamond polygon
 *   const half = bridgeWidth / 2;
 *   const diamond = Manifold.extrude(
 *     // cross-section: 4-point diamond
 *     new CrossSection([[half,0], [0,half], [-half,0], [0,-half]]),
 *     bridgeHeight
 *   );
 *   const positioned = diamond.translate([
 *     b.x * pixelSize,
 *     b.y * pixelSize,
 *     0
 *   ]);
 *   // Union with other geometry
 * }
 * ```
 */

/**
 * Derives a deterministic neon color pair from a character name.
 * Uses a djb2-style hash to map the name to a hue, then produces
 * a bright raised color and a darker flat color on the same hue.
 */

function nameHash(name) {
  let h = 5381
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h + name.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Returns { raised: '#hex', flat: '#hex' } color pair for a character name.
 * Both colors share the same hue so they print well as one filament color.
 * raised is a bright neon, flat is the same hue but darker/deeper.
 */
export function colorForCharacter(name) {
  const hue = nameHash(name || '') % 360
  return {
    raised: hslToHex(hue, 90, 62),
    flat: hslToHex(hue, 75, 42),
  }
}

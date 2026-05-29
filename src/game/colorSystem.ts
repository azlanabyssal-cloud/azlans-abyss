import type { ColorPalette } from '../types/game'

// Five emotional states — Blank → Spark → Flow → Blaze → Aurora
// Each is an RGB triplet for smooth interpolation
const PALETTES: ColorPalette[] = [
  { // 0: BLANK — deep indigo void. Sky is a real visible gradient, terrain is darkness below.
    skyTop:       [14,  9,  42],   // deep indigo — not black
    skyBot:       [72,  48, 145],  // rich purple horizon — clearly visible
    terrainFill:  [5,   4,  14],   // near-black — creates strong contrast against sky
    terrainEdge:  [148, 118,245],  // bright violet glow
    playerColor:  [225, 218, 255],
    trailColor:   [165, 142, 245],
    archColor:    [105, 85, 188],
    wellColor:    [78,  62, 155],
    particleColor:[185, 165, 248],
    ambientLight: 0.0,
  },
  { // 1: SPARK — indigo threads. Sky ignites, world first stirs.
    skyTop:       [10,  8,  32],
    skyBot:       [34,  22, 85],
    terrainFill:  [14,  11, 38],
    terrainEdge:  [118, 92, 248],
    playerColor:  [215, 205, 255],
    trailColor:   [158, 122, 255],
    archColor:    [128, 95, 238],
    wellColor:    [95,  68, 205],
    particleColor:[182, 152, 255],
    ambientLight: 0.15,
  },
  { // 2: FLOW — violet blooms. Rich purple sky, luminous edge.
    skyTop:       [18,  5,  48],
    skyBot:       [58,  18, 118],
    terrainFill:  [16,  6,  44],
    terrainEdge:  [178, 85, 255],
    playerColor:  [235, 208, 255],
    trailColor:   [208, 108, 255],
    archColor:    [195, 95,  255],
    wellColor:    [148, 65,  218],
    particleColor:[218, 158, 255],
    ambientLight: 0.3,
  },
  { // 3: BLAZE — amber warmth. Deep rust sky, golden edge.
    skyTop:       [25,  10,  4],
    skyBot:       [88,  38,  8],
    terrainFill:  [20,  10,  4],
    terrainEdge:  [255, 168, 38],
    playerColor:  [255, 248, 205],
    trailColor:   [255, 195, 55],
    archColor:    [255, 182, 32],
    wellColor:    [225, 135, 22],
    particleColor:[255, 218, 95],
    ambientLight: 0.5,
  },
  { // 4: AURORA — full spectrum. Deep teal sky, cyan edge, world fully alive.
    skyTop:       [3,   18,  32],
    skyBot:       [8,   52,  88],
    terrainFill:  [5,   18,  34],
    terrainEdge:  [0,  215, 255],
    playerColor:  [218, 255, 255],
    trailColor:   [0,  255, 198],
    archColor:    [0,  238, 218],
    wellColor:    [0,  178, 198],
    particleColor:[118, 255, 228],
    ambientLight: 0.75,
  },
]

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

function lerpRGB(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

export function getPalette(level: number): ColorPalette {
  const lo = Math.max(0, Math.min(3, Math.floor(level)))
  const hi = Math.min(4, lo + 1)
  const t  = level - lo
  const a  = PALETTES[lo]
  const b  = PALETTES[hi]

  return {
    skyTop:       lerpRGB(a.skyTop, b.skyTop, t),
    skyBot:       lerpRGB(a.skyBot, b.skyBot, t),
    terrainFill:  lerpRGB(a.terrainFill, b.terrainFill, t),
    terrainEdge:  lerpRGB(a.terrainEdge, b.terrainEdge, t),
    playerColor:  lerpRGB(a.playerColor, b.playerColor, t),
    trailColor:   lerpRGB(a.trailColor, b.trailColor, t),
    archColor:    lerpRGB(a.archColor, b.archColor, t),
    wellColor:    lerpRGB(a.wellColor, b.wellColor, t),
    particleColor:lerpRGB(a.particleColor, b.particleColor, t),
    ambientLight: lerp(a.ambientLight, b.ambientLight, t),
  }
}

export function rgb(c: [number, number, number], a = 1): string {
  return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`
}

export class ColorSystem {
  level    = 0   // 0–4 fractional
  target   = 0
  velocity = 0   // spring velocity for smooth transitions

  update(combo: number, isGrounded: boolean, dt: number) {
    // Target level rises with combo, falls slowly when not flowing
    if      (combo >= 12) this.target = 4
    else if (combo >= 7)  this.target = 3
    else if (combo >= 3)  this.target = 2
    else if (combo >= 1)  this.target = 1
    else                  this.target = Math.max(0, this.target - dt * 0.35)

    // Spring-damper towards target — smooth and organic transitions
    const spring = 4.5
    const damp   = 7.0
    const force  = (this.target - this.level) * spring - this.velocity * damp
    this.velocity += force * dt
    this.level    += this.velocity * dt
    this.level     = Math.max(0, Math.min(4, this.level))
  }

  get palette(): ColorPalette { return getPalette(this.level) }

  // Normalized 0–1 within current level band — for pulsing effects
  get phase(): number { return this.level % 1 }
}

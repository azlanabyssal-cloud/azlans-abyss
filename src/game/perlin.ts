export class Perlin {
  private p: Uint8Array

  constructor(seed = Math.random()) {
    this.p = new Uint8Array(512)
    const perm = Array.from({ length: 256 }, (_, i) => i)
    let s = seed * 2147483647
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647
      const j = ((s / 2147483647) * (i + 1)) | 0
      ;[perm[i], perm[j]] = [perm[j], perm[i]]
    }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255]
  }

  private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10) }
  private lerp(t: number, a: number, b: number) { return a + t * (b - a) }
  private grad(h: number, x: number) { return (h & 1) === 0 ? x : -x }

  noise1d(x: number): number {
    const X = Math.floor(x) & 255
    x -= Math.floor(x)
    const u = this.fade(x)
    return this.lerp(u, this.grad(this.p[X], x), this.grad(this.p[X + 1], x - 1))
  }

  // Fractal Brownian Motion — 4 octaves for rich terrain
  fbm(x: number, octaves = 4): number {
    let v = 0, amp = 0.5, freq = 1, max = 0
    for (let i = 0; i < octaves; i++) {
      v += this.noise1d(x * freq) * amp
      max += amp
      amp *= 0.5
      freq *= 2.1
    }
    return v / max
  }
}

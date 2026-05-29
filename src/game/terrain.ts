import { Perlin } from './perlin'

export class Terrain {
  private perlin: Perlin
  private baseY: number
  private amplitude: number
  private frequency: number

  constructor(canvasHeight: number) {
    this.perlin = new Perlin()
    this.baseY = canvasHeight * 0.62
    this.amplitude = canvasHeight * 0.18
    this.frequency = 0.0018
  }

  // terrain y at worldX — higher color level gives a smoother ride
  getY(worldX: number, colorLevel = 0): number {
    const smoothing = 1 - colorLevel * 0.12  // higher color = smoother world
    const amp = this.amplitude * smoothing
    const freq = this.frequency * (1 - colorLevel * 0.08)

    const large  = this.perlin.fbm(worldX * freq, 4) * amp
    const medium = this.perlin.noise1d(worldX * freq * 3.2 + 400) * amp * 0.24

    return this.baseY + large + medium
  }

  // Slope in radians at worldX — used for physics acceleration and landing detection
  getSlope(worldX: number, colorLevel = 0): number {
    const dx = 6
    const dy = this.getY(worldX + dx, colorLevel) - this.getY(worldX - dx, colorLevel)
    return Math.atan2(dy, dx * 2)
  }

  // Slope as simple rise/run — positive = downhill (in screen coords y increases downward)
  getSlopeRatio(worldX: number, colorLevel = 0): number {
    const dx = 6
    return (this.getY(worldX + dx, colorLevel) - this.getY(worldX - dx, colorLevel)) / (dx * 2)
  }

  // Pre-sample terrain segment for drawing (screen x range → world x range via cameraX)
  sample(fromWorldX: number, toWorldX: number, step: number, colorLevel = 0): Array<[number, number]> {
    const points: Array<[number, number]> = []
    for (let wx = fromWorldX; wx <= toWorldX; wx += step) {
      points.push([wx, this.getY(wx, colorLevel)])
    }
    return points
  }

  updateBaseY(canvasHeight: number) {
    this.baseY = canvasHeight * 0.62
    this.amplitude = canvasHeight * 0.18
  }
}

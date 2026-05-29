import type { Particle } from '../types/game'

const POOL_SIZE = 300

export class ParticleSystem {
  private pool: Particle[] = []

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push({ x:0,y:0,vx:0,vy:0,life:0,maxLife:1,size:2,r:255,g:255,b:255,active:false })
    }
  }

  private get(count: number): Particle[] {
    const out: Particle[] = []
    for (const p of this.pool) {
      if (!p.active) { out.push(p); if (out.length >= count) break }
    }
    return out
  }

  emit(x: number, y: number, color: [number,number,number], count: number, speed = 250, spread = Math.PI * 2) {
    const particles = this.get(count)
    for (const p of particles) {
      const angle = (Math.random() - 0.5) * spread - Math.PI / 2
      const spd   = speed * (0.4 + Math.random() * 0.8)
      p.x = x; p.y = y
      p.vx = Math.cos(angle) * spd
      p.vy = Math.sin(angle) * spd - 80
      p.life = p.maxLife = 0.5 + Math.random() * 0.5
      p.size = 2 + Math.random() * 4
      p.r = color[0]; p.g = color[1]; p.b = color[2]
      p.active = true
    }
  }

  // Directional sand spray from board contact — slope-aligned, speed-scaled
  emitSandSplash(
    x: number, y: number,
    color: [number,number,number],
    slope: number,
    speed: number,
  ) {
    const intensity = Math.min((speed - 220) / 580, 1.0)
    if (intensity < 0.05) return
    const count = intensity > 0.55 ? 2 : 1
    const pts   = this.get(count)
    for (const p of pts) {
      // spray direction: perpendicular to terrain surface, biased backward
      const ang = slope - Math.PI / 2 + (Math.random() - 0.5) * 0.60
      const spd = 50 + intensity * 130 + Math.random() * 60
      p.x  = x + (Math.random() - 0.5) * 14
      p.y  = y
      p.vx = Math.cos(ang) * spd - speed * 0.05
      p.vy = Math.sin(ang) * spd
      p.life = p.maxLife = 0.10 + Math.random() * 0.18
      p.size = 1.0 + Math.random() * 1.6 * intensity
      p.r = color[0]; p.g = color[1]; p.b = color[2]
      p.active = true
    }
  }

  // Ring burst on arch thread-through
  emitRing(x: number, y: number, color: [number,number,number], radius: number) {
    const count = 24
    const particles = this.get(count)
    for (let i = 0; i < particles.length; i++) {
      const angle = (i / particles.length) * Math.PI * 2
      const spd   = 180 + Math.random() * 120
      const p = particles[i]
      p.x = x + Math.cos(angle) * radius * 0.8
      p.y = y + Math.sin(angle) * radius * 0.8
      p.vx = Math.cos(angle) * spd
      p.vy = Math.sin(angle) * spd
      p.life = p.maxLife = 0.7 + Math.random() * 0.3
      p.size = 3 + Math.random() * 3
      p.r = color[0]; p.g = color[1]; p.b = color[2]
      p.active = true
    }
  }

  update(dt: number) {
    const gravity = 400
    for (const p of this.pool) {
      if (!p.active) continue
      p.vy += gravity * dt
      p.x  += p.vx * dt
      p.y  += p.vy * dt
      p.life -= dt
      if (p.life <= 0) p.active = false
    }
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    for (const p of this.pool) {
      if (!p.active) continue
      const alpha = Math.pow(p.life / p.maxLife, 0.6)
      const sx = p.x - cameraX
      const sy = p.y - cameraY
      if (sx < -20 || sx > ctx.canvas.width + 20) continue

      ctx.beginPath()
      ctx.arc(sx, sy, p.size * alpha, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha * 0.9})`
      ctx.fill()
    }
  }
}

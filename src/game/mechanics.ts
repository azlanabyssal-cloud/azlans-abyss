import type { LightArch, GravityWell, PhaseWall, PlayerState } from '../types/game'
import type { ParticleSystem } from './particles'

const ARCH_INTERVAL  = 900   // world units between arch spawns
const WELL_INTERVAL  = 1400
const WALL_INTERVAL  = 1800
const ARCH_RADIUS    = 52
const WELL_RADIUS    = 70
const ARCH_Y_OFFSET  = -100  // above terrain

export class MechanicsManager {
  arches:   LightArch[]  = []
  wells:    GravityWell[] = []
  walls:    PhaseWall[]  = []

  private lastArchX = 400
  private lastWellX = 800
  private lastWallX = 1200

  spawn(cameraX: number, canvasW: number, terrainGetY: (x: number) => number) {
    const leadEdge = cameraX + canvasW + 400

    // Spawn arches ahead of view
    while (this.lastArchX < leadEdge) {
      this.lastArchX += ARCH_INTERVAL + Math.random() * 300
      const ty = terrainGetY(this.lastArchX)
      this.arches.push({
        worldX: this.lastArchX,
        centerY: ty + ARCH_Y_OFFSET,
        radius: ARCH_RADIUS,
        active: true,
        hitTimer: 0,
        pulsePhase: Math.random() * Math.PI * 2,
      })
    }

    // Spawn gravity wells
    while (this.lastWellX < leadEdge) {
      this.lastWellX += WELL_INTERVAL + Math.random() * 400
      const ty = terrainGetY(this.lastWellX)
      this.wells.push({
        worldX: this.lastWellX,
        y: ty - 40,
        radius: WELL_RADIUS,
        active: true,
        spinAngle: 0,
      })
    }

    // Spawn phase walls — keep them away from arches
    while (this.lastWallX < leadEdge) {
      this.lastWallX += WALL_INTERVAL + Math.random() * 600
      // Nudge away from any nearby arch (avoid overlap)
      const nearby = this.arches.some(a => Math.abs(a.worldX - this.lastWallX) < 280)
      if (nearby) this.lastWallX += 350
      const ty = terrainGetY(this.lastWallX)
      this.walls.push({
        worldX: this.lastWallX,
        topY: ty - 200,
        height: 190,
        active: true,
        riding: false,
      })
    }

    // Cull objects far behind camera
    const cullX = cameraX - 200
    this.arches = this.arches.filter(a => a.worldX > cullX)
    this.wells  = this.wells.filter(w => w.worldX > cullX)
    this.walls  = this.walls.filter(w => w.worldX > cullX)
  }

  update(
    player: PlayerState,
    dt: number,
    particles: ParticleSystem,
    archColor: [number,number,number],
    wellColor: [number,number,number],
    onArchHit: () => void,
    onWellHit: () => void,
  ) {
    const px = player.worldX
    const py = player.worldY

    // Arch collision
    for (const a of this.arches) {
      a.pulsePhase += dt * 2.2
      if (a.hitTimer > 0) { a.hitTimer -= dt; continue }
      if (!a.active) continue

      const dx   = px - a.worldX
      const dy   = py - a.centerY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < a.radius * 1.1) {
        a.hitTimer = 1.5  // cooldown before arch can be hit again
        particles.emitRing(a.worldX, a.centerY, archColor, a.radius)
        onArchHit()
      }
    }

    // Gravity well — applies upward impulse
    for (const w of this.wells) {
      w.spinAngle += dt * 3.5
      if (!w.active) continue

      const dx   = px - w.worldX
      const dy   = py - w.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < w.radius && !player.isGrounded) {
        player.vy = Math.min(player.vy, -520)  // strong upward burst
        player.vx *= 1.06
        particles.emit(w.worldX, w.y, wellColor, 12, 180, Math.PI)
        onWellHit()
      }
    }

    // Phase wall riding — lateral momentum preservation
    for (const wall of this.walls) {
      if (!wall.active) continue
      const dx = Math.abs(px - wall.worldX)
      const inWallZone = dx < 30 && py > wall.topY && py < wall.topY + wall.height

      if (inWallZone && !player.isGrounded) {
        wall.riding = true
        // Prevent gravity during wall ride, add upward lift per frame
        player.vy = Math.min(player.vy, 30)
        player.vx *= 1.002  // wall preserves momentum
      } else {
        wall.riding = false
      }
    }
  }

  reset() {
    this.arches = []; this.wells = []; this.walls = []
    this.lastArchX = 400; this.lastWellX = 800; this.lastWallX = 1200
  }
}

import type { PlayerState, ColorPalette } from '../types/game'
import type { Terrain } from './terrain'
import type { ParticleSystem } from './particles'
import type { MechanicsManager } from './mechanics'
import type { CoinSystem } from './coins'
import { rgb } from './colorSystem'

export class Renderer {
  private W = 0
  private H = 0
  private _smoothAngle  = 0
  private _wasGrounded  = true
  private _squashTimer  = 0   // 1.0 → 0, decays each frame

  resize(w: number, h: number) { this.W = w; this.H = h }

  draw(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    terrain: Terrain,
    mechanics: MechanicsManager,
    coinSystem: CoinSystem,
    particles: ParticleSystem,
    palette: ColorPalette,
    colorLevel: number,
    cameraX: number,
    cameraY: number,
    combo: number,
    distance: number,
    time: number,
    isFlowBurst: boolean,
    jumpRingTimer: number,
    jumpRingX: number,
    jumpRingY: number,
    comboPopTimer: number,
    comboPopValue: number,
    comboPopX: number,
    comboPopY: number,
    introProgress: number,
  ) {
    ctx.clearRect(0, 0, this.W, this.H)

    this._drawSky(ctx, palette, colorLevel, time, isFlowBurst)
    this._drawBirds(ctx, palette, colorLevel, cameraX, time)
    this._drawParallax(ctx, palette, colorLevel, cameraX, time)
    this._drawTerrain(ctx, terrain, palette, colorLevel, cameraX, cameraY, time)
    this._drawPhaseWalls(ctx, mechanics, palette, cameraX, cameraY, time)
    this._drawWells(ctx, mechanics, palette, cameraX, cameraY, time)
    this._drawArches(ctx, mechanics, palette, colorLevel, cameraX, cameraY, time)
    this._drawCoins(ctx, coinSystem, palette, colorLevel, cameraX, cameraY, time)
    this._drawTrail(ctx, player, palette, cameraX, cameraY)
    this._drawSpeedStreaks(ctx, player, palette, colorLevel, cameraX, cameraY, time)
    this._drawJumpRing(ctx, palette, jumpRingTimer, jumpRingX - cameraX, jumpRingY - cameraY)
    this._drawScarf(ctx, player, palette, colorLevel, cameraX, cameraY)
    this._drawPlayer(ctx, player, palette, colorLevel, cameraX, cameraY, time, isFlowBurst)
    particles.draw(ctx, cameraX, cameraY)
    this._drawComboPop(ctx, palette, comboPopTimer, comboPopValue, comboPopX - cameraX, comboPopY - cameraY)
    if (isFlowBurst) this._drawFlowBurstOverlay(ctx, palette, colorLevel, time)
    if (introProgress > 0) this._drawIntroOverlay(ctx, palette, introProgress)
  }

  // ─── sky ────────────────────────────────────────────────────────────────

  private _drawSky(
    ctx: CanvasRenderingContext2D,
    palette: ColorPalette,
    colorLevel: number,
    time: number,
    isFlowBurst: boolean,
  ) {
    // sky gradient — full height so the horizon colour shows below the terrain
    const grad = ctx.createLinearGradient(0, 0, 0, this.H)
    grad.addColorStop(0,    rgb(palette.skyTop))
    grad.addColorStop(0.55, rgb(palette.skyBot))
    grad.addColorStop(1.0,  rgb(palette.skyBot))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, this.W, this.H)

    // horizon haze
    const haze = ctx.createLinearGradient(0, this.H * 0.40, 0, this.H * 0.72)
    haze.addColorStop(0, rgb(palette.terrainEdge, 0))
    haze.addColorStop(1, rgb(palette.terrainEdge, 0.055 + colorLevel * 0.045))
    ctx.fillStyle = haze
    ctx.fillRect(0, this.H * 0.40, this.W, this.H * 0.32)

    // cloud wisps at higher color levels
    if (colorLevel > 0.5) {
      const nc = ctx.createLinearGradient(0, this.H * 0.12, 0, this.H * 0.38)
      nc.addColorStop(0, 'rgba(0,0,0,0)')
      nc.addColorStop(0.5, rgb(palette.terrainEdge, (colorLevel - 0.5) * 0.06))
      nc.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = nc
      for (let i = 0; i < 3; i++) {
        const nx = ((-time * 12 + i * (this.W / 3 + 80)) % (this.W + 200) + this.W + 200) % (this.W + 200) - 100
        const ny = this.H * (0.15 + i * 0.06)
        const nw = 180 + i * 80
        ctx.save()
        ctx.globalAlpha = (colorLevel - 0.5) * 0.25
        ctx.fillStyle   = rgb(palette.trailColor, 0.12)
        ctx.beginPath()
        ctx.ellipse(nx, ny, nw, 22, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // stars — fade out as color level rises
    const starCount = Math.max(0, Math.floor(80 * (1 - colorLevel / 3.5)))
    ctx.fillStyle   = `rgb(${palette.playerColor[0]},${palette.playerColor[1]},${palette.playerColor[2]})`
    for (let i = 0; i < starCount; i++) {
      const sx      = ((i * 137.508 + 0.5) % 1) * this.W
      const sy      = ((i * 89.23  + 0.3) % 1) * this.H * 0.52
      const sz      = i % 7 === 0 ? 1.6 : 0.9
      const flicker = Math.sin(time * (0.7 + (i % 5) * 0.14) + i) * 0.22 + 0.78
      ctx.globalAlpha = flicker * (0.62 - colorLevel * 0.10)   // brighter stars
      ctx.beginPath()
      ctx.arc(sx, sy, sz, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Flow burst sky aura
    if (isFlowBurst) {
      const pulse     = Math.sin(time * 6) * 0.05 + 0.07
      const burstGrad = ctx.createRadialGradient(
        this.W * 0.3, this.H * 0.55, 0,
        this.W * 0.3, this.H * 0.55, this.W * 0.65
      )
      burstGrad.addColorStop(0, rgb(palette.trailColor, pulse))
      burstGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = burstGrad
      ctx.fillRect(0, 0, this.W, this.H)
    }
  }

  // ─── birds ──────────────────────────────────────────────────────────────

  private _drawBirds(
    ctx: CanvasRenderingContext2D,
    palette: ColorPalette,
    colorLevel: number,
    cameraX: number,
    time: number,
  ) {
    const birdAlpha = Math.max(0, 0.20 - colorLevel * 0.038)
    if (birdAlpha <= 0.01) return

    ctx.save()
    ctx.lineCap  = 'round'
    ctx.lineJoin = 'round'

    for (let i = 0; i < 5; i++) {
      const scroll = 0.055 + (i % 3) * 0.022
      const period = this.W * 1.85
      const rawX   = (-(cameraX * scroll) + i * (period / 5)) % period
      const bx     = ((rawX % period) + period) % period - 80
      const by     = this.H * (0.14 + (i % 4) * 0.055) + Math.sin(time * 0.32 + i * 1.3) * this.H * 0.022

      const flapRate  = 0.75 + (i % 3) * 0.28
      const flapDip   = Math.sin(time * flapRate + i * 2.1) * 5.5
      const sz        = 6 + (i % 3) * 3.5

      ctx.globalAlpha = birdAlpha * (0.7 + (i % 3) * 0.1)
      ctx.strokeStyle = rgb(palette.playerColor, 1)
      ctx.lineWidth   = 1.1

      ctx.beginPath()
      ctx.moveTo(bx - sz * 1.25, by - 3)
      ctx.quadraticCurveTo(bx - sz * 0.55, by + flapDip, bx, by)
      ctx.quadraticCurveTo(bx + sz * 0.55, by + flapDip, bx + sz * 1.25, by - 3)
      ctx.stroke()
    }

    ctx.globalAlpha = 1
    ctx.restore()
  }

  // ─── parallax ───────────────────────────────────────────────────────────

  private _drawParallax(
    ctx: CanvasRenderingContext2D,
    palette: ColorPalette,
    colorLevel: number,
    cameraX: number,
    time: number,
  ) {
    // ── Layer 0: distant spires (scroll 0.04) ──
    const spireOff = -(cameraX * 0.04) % (this.W * 2)
    const spireAlpha = 0.18 + colorLevel * 0.08
    ctx.fillStyle = rgb(palette.terrainEdge, spireAlpha * 0.5)
    for (let i = 0; i < 4; i++) {
      const sx = ((spireOff + i * (this.W * 2 / 4)) % (this.W * 2) + this.W * 2) % (this.W * 2) - 100
      const sh = this.H * (0.24 + (i % 3) * 0.06)
      const sw = 10 + (i % 3) * 5

      // Main spire shaft
      ctx.beginPath()
      ctx.moveTo(sx - sw / 2, this.H * 0.72)
      ctx.lineTo(sx - sw / 2, this.H * 0.72 - sh)
      ctx.lineTo(sx, this.H * 0.72 - sh - sw * 2)  // pointed top
      ctx.lineTo(sx + sw / 2, this.H * 0.72 - sh)
      ctx.lineTo(sx + sw / 2, this.H * 0.72)
      ctx.closePath()
      ctx.fill()

      // Spire horizontal banding — sense of architecture
      for (let b = 0; b < 3; b++) {
        const by = this.H * 0.72 - sh * (0.3 + b * 0.25)
        ctx.globalAlpha = spireAlpha * 0.25
        ctx.fillStyle   = rgb(palette.terrainEdge, 1)
        ctx.fillRect(sx - sw / 2 - 3, by - 2, sw + 6, 2)
        ctx.globalAlpha = 1
        ctx.fillStyle   = rgb(palette.terrainEdge, spireAlpha * 0.5)
      }
    }

    // ── Layer 1: mountain silhouettes (scroll 0.08) ──
    const mxRaw = (cameraX * 0.08) % this.W
    const mxOff = -mxRaw

    // mountains slightly lighter than sky so they always read as a separate layer
    const mR = Math.min(255, palette.skyBot[0] + 32)
    const mG = Math.min(255, palette.skyBot[1] + 20)
    const mB = Math.min(255, palette.skyBot[2] + 52)
    ctx.fillStyle = `rgba(${mR},${mG},${mB},0.96)`
    for (let i = -1; i <= 2; i++) {
      const ox = mxOff + i * this.W
      ctx.beginPath()
      ctx.moveTo(ox, this.H)
      for (let x = 0; x <= this.W; x += 18) {
        const wx = x + (i - mxOff / this.W) * this.W
        const my = this.H * 0.44
          + Math.sin(wx * 0.009 + 0.5) * this.H * 0.11
          + Math.sin(wx * 0.019 + 1.8) * this.H * 0.045
          + Math.sin(wx * 0.042 + 3.1) * this.H * 0.018
        ctx.lineTo(ox + x, my)
      }
      ctx.lineTo(ox + this.W, this.H)
      ctx.closePath()
      ctx.fill()
    }

    // Mountain edge glow — very subtle luminous rim at higher levels
    if (colorLevel > 0.8) {
      ctx.strokeStyle = rgb(palette.terrainEdge, (colorLevel - 0.8) * 0.08)
      ctx.lineWidth   = 2
      for (let i = -1; i <= 2; i++) {
        const ox = mxOff + i * this.W
        ctx.beginPath()
        for (let x = 0; x <= this.W; x += 18) {
          const wx = x + (i - mxOff / this.W) * this.W
          const my = this.H * 0.44
            + Math.sin(wx * 0.009 + 0.5) * this.H * 0.11
            + Math.sin(wx * 0.019 + 1.8) * this.H * 0.045
          if (x === 0) ctx.moveTo(ox + x, my); else ctx.lineTo(ox + x, my)
        }
        ctx.stroke()
      }
    }

    // ── Layer 2: soft glow orbs (scroll 0.18) ──
    const mx2   = -(cameraX * 0.18) % (this.W * 2)
    for (let i = 0; i < 4; i++) {
      const bx  = ((mx2 + i * (this.W * 2 / 4)) % (this.W * 2) + this.W * 2) % (this.W * 2) - 60
      const by  = this.H * 0.20 + Math.sin(time * 0.22 + i * 1.4) * this.H * 0.04
      const bs  = 20 + i * 14
      const ba  = 0.06 + colorLevel * 0.04
      const g   = ctx.createRadialGradient(bx, by, 0, bx, by, bs * 1.8)
      g.addColorStop(0, rgb(palette.terrainEdge, ba))
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(bx - bs * 2, by - bs * 2, bs * 4, bs * 4)
    }

    // ── Layer 3: floating dust (scroll 0.42) — higher levels ──
    if (colorLevel > 0.8) {
      const mx3  = -(cameraX * 0.42) % (this.W * 1.6)
      const da   = (colorLevel - 0.8) * 0.10
      ctx.fillStyle = rgb(palette.particleColor, da)
      for (let i = 0; i < 14; i++) {
        const px = ((mx3 + i * (this.W * 1.6 / 14)) % (this.W * 1.6) + this.W * 1.6) % (this.W * 1.6) - 30
        const py = this.H * 0.12 + Math.sin(time * 0.45 + i * 1.9) * this.H * 0.14
        ctx.beginPath()
        ctx.arc(px, py, 1.5 + (i % 3) * 0.8, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // ─── terrain ────────────────────────────────────────────────────────────

  private _drawTerrain(
    ctx: CanvasRenderingContext2D,
    terrain: Terrain,
    palette: ColorPalette,
    colorLevel: number,
    cameraX: number,
    cameraY: number,
    time: number,
  ) {
    const step   = 4
    const fromWX = cameraX - step
    const toWX   = cameraX + this.W + step
    const points = terrain.sample(fromWX, toWX, step, colorLevel)

    // smooth terrain path — quadratic midpoints, reused for fill and edge
    const px0 = points[0][0] - cameraX
    const py0 = points[0][1] - cameraY
    const pxL = points[points.length - 1][0] - cameraX
    const pyL = points[points.length - 1][1] - cameraY

    // Terrain fill — extend down to screen bottom
    ctx.beginPath()
    ctx.moveTo(px0, this.H + 10)
    ctx.lineTo(px0, py0)
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i][0] + points[i + 1][0]) / 2 - cameraX
      const my = (points[i][1] + points[i + 1][1]) / 2 - cameraY
      ctx.quadraticCurveTo(points[i][0] - cameraX, points[i][1] - cameraY, mx, my)
    }
    ctx.lineTo(pxL, pyL)
    ctx.lineTo(pxL, this.H + 10)
    ctx.closePath()

    let minY = points[0][1]
    for (let pi = 1; pi < points.length; pi++) if (points[pi][1] < minY) minY = points[pi][1]
    minY -= cameraY
    const fillGrd = ctx.createLinearGradient(0, minY - 20, 0, this.H + 30)
    fillGrd.addColorStop(0,    rgb(palette.terrainEdge, 0.42 + colorLevel * 0.12))
    fillGrd.addColorStop(0.06, rgb(palette.terrainFill, 0.95))
    fillGrd.addColorStop(0.55, rgb(palette.terrainFill, 1.0))
    fillGrd.addColorStop(1.0,  rgb(palette.terrainFill, 0.55))
    ctx.fillStyle = fillGrd
    ctx.fill()

    // Edge path — same smooth curve, drawn 3× for bloom
    ctx.beginPath()
    ctx.moveTo(px0, py0)
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i][0] + points[i + 1][0]) / 2 - cameraX
      const my = (points[i][1] + points[i + 1][1]) / 2 - cameraY
      ctx.quadraticCurveTo(points[i][0] - cameraX, points[i][1] - cameraY, mx, my)
    }
    ctx.lineTo(pxL, pyL)
    ctx.lineJoin = 'round'
    ctx.lineCap  = 'round'

    // slow pulse on the edge glow
    const breathe = Math.sin(time * 1.2) * (0.8 + colorLevel * 0.6)

    // outer bloom
    ctx.strokeStyle = rgb(palette.terrainEdge, 0.22 + colorLevel * 0.09)
    ctx.lineWidth   = 28 + colorLevel * 8 + breathe
    ctx.stroke()

    // Mid glow
    ctx.strokeStyle = rgb(palette.terrainEdge, 0.55 + colorLevel * 0.13)
    ctx.lineWidth   = 8 + colorLevel * 3 + breathe * 0.3
    ctx.stroke()

    // Crisp edge line
    ctx.strokeStyle = rgb(palette.terrainEdge, 1.0)
    ctx.lineWidth   = 2.5
    ctx.stroke()
  }

  // ─── trail ──────────────────────────────────────────────────────────────

  private _drawTrail(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    palette: ColorPalette,
    cameraX: number,
    cameraY: number,
  ) {
    if (player.trailPoints.length < 2) return
    for (let i = 1; i < player.trailPoints.length; i++) {
      const a    = player.trailPoints[i - 1]
      const b    = player.trailPoints[i]
      const prog = 1 - b.age / 1.2
      if (prog <= 0) break

      const ax  = a.x - cameraX, ay = a.y - cameraY
      const bx  = b.x - cameraX, by = b.y - cameraY
      const lvl = a.colorLevel

      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)

      ctx.strokeStyle = rgb(palette.trailColor, prog * (0.16 + lvl * 0.10))
      ctx.lineWidth   = (9 + lvl * 5) * prog
      ctx.stroke()

      ctx.strokeStyle = rgb(palette.trailColor, prog * (0.82 + lvl * 0.15))
      ctx.lineWidth   = (2.5 + lvl * 1.0) * prog
      ctx.stroke()
    }
  }

  // ─── jump ring ──────────────────────────────────────────────────────────

  private _drawJumpRing(
    ctx: CanvasRenderingContext2D,
    palette: ColorPalette,
    timer: number,
    sx: number,
    sy: number,
  ) {
    if (timer <= 0) return
    const MAX = 0.45
    const prog    = 1 - timer / MAX      // 0 → 1 as ring expands
    const radius  = prog * 78
    const alpha   = (1 - prog) * 0.55

    ctx.beginPath()
    ctx.arc(sx, sy, radius, 0, Math.PI * 2)
    ctx.strokeStyle = rgb(palette.trailColor, alpha)
    ctx.lineWidth   = (1 - prog) * 4
    ctx.stroke()

    // Second inner ring slightly delayed
    if (prog > 0.15) {
      const r2 = (prog - 0.15) * 60
      ctx.beginPath()
      ctx.arc(sx, sy, r2, 0, Math.PI * 2)
      ctx.strokeStyle = rgb(palette.trailColor, alpha * 0.4)
      ctx.lineWidth   = (1 - prog) * 2
      ctx.stroke()
    }
  }

  // ─── player ─────────────────────────────────────────────────────────────

  private _drawSpeedStreaks(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    palette: ColorPalette,
    colorLevel: number,
    cameraX: number,
    cameraY: number,
    time: number,
  ) {
    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy)
    if (player.isGrounded || speed < 340) return

    const intensity = Math.min((speed - 340) / 480, 1.0)
    const sx = player.worldX - cameraX
    const sy = player.worldY - cameraY

    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(player.angle)

    const count  = 4 + Math.floor(intensity * 6)
    const alpha  = 0.05 + intensity * 0.12 + colorLevel * 0.03
    const maxLen = 28 + intensity * 60 + colorLevel * 12

    ctx.lineCap = 'round'
    for (let i = 0; i < count; i++) {
      const oy  = -18 + (i / count) * 36 - 9
      const len = maxLen * (0.4 + Math.sin(time * 18 + i) * 0.3 + 0.3)
      const x0  = -6 - Math.random() * 8
      ctx.beginPath()
      ctx.moveTo(x0, oy)
      ctx.lineTo(x0 - len, oy)
      ctx.strokeStyle = rgb(palette.trailColor, alpha * (1 - i / count * 0.4))
      ctx.lineWidth   = 0.7 + Math.random() * 0.8
      ctx.stroke()
    }
    ctx.restore()
  }

  private _drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    palette: ColorPalette,
    colorLevel: number,
    cameraX: number,
    cameraY: number,
    time: number,
    isFlowBurst: boolean,
  ) {
    const sx = player.worldX - cameraX
    const sy = player.worldY - cameraY

    // Landing squash detection
    const justLandedNow = !this._wasGrounded && player.isGrounded
    if (justLandedNow) this._squashTimer = 1.0
    this._wasGrounded = player.isGrounded
    this._squashTimer *= 0.58   // decay each render frame

    ctx.save()
    ctx.translate(sx, sy)
    const speedNorm = Math.min((player.vx - 180) / 720, 1)
    if (!player.isGrounded) {
      if (Math.abs(player.angularVel) > 2) {
        // active flip — exact tracking so the spin looks crisp
        this._smoothAngle = player.angle
      } else {
        // airborne, not spinning — slow drift (0.08 ≈ 1.9s settle)
        let diff = player.angle - this._smoothAngle
        while (diff > Math.PI)  diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        this._smoothAngle += diff * 0.08
      }
    } else {
      // grounded — weight-settling lerp (0.18 ≈ 0.83s settle)
      let diff = player.angle - this._smoothAngle
      while (diff > Math.PI)  diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      this._smoothAngle += diff * 0.18
    }
    ctx.rotate(this._smoothAngle + (player.isGrounded ? speedNorm * 0.08 : 0))

    // Squash-and-stretch on landing — brief wide/flat deformation
    if (this._squashTimer > 0.05) {
      const sq = this._squashTimer * 0.14
      ctx.scale(1 + sq, 1 - sq * 0.75)
    }

    const invAlpha   = player.isInvincible ? 0.5 + Math.sin(time * 18) * 0.4 : 1.0
    const airborne   = !player.isGrounded
    const spinning   = Math.abs(player.angularVel) > 4

    // manual radial aura — shadowBlur tanks performance so skip it
    const auraR = 38 + colorLevel * 12 + (isFlowBurst ? 22 : 0)
    const auraA = 0.07 + colorLevel * 0.07 + (isFlowBurst ? 0.16 : 0)
    const aura  = ctx.createRadialGradient(0, -6, 0, 0, -6, auraR)
    aura.addColorStop(0, rgb(palette.trailColor, auraA))
    aura.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = aura
    ctx.fillRect(-auraR, -auraR - 6, auraR * 2, auraR * 2)

    ctx.fillStyle = rgb(palette.playerColor, invAlpha)
    ctx.strokeStyle = rgb(palette.playerColor, invAlpha)
    ctx.lineCap = 'round'

    // ── Board ──
    ctx.beginPath()
    ctx.ellipse(0, 8, 30, 5.5, 0, 0, Math.PI * 2)
    ctx.fill()
    // Board shine
    ctx.globalAlpha = invAlpha * 0.35
    ctx.strokeStyle = rgb(palette.playerColor, 1)
    ctx.lineWidth   = 1.2
    ctx.beginPath()
    ctx.moveTo(-22, 5.5)
    ctx.lineTo(22, 5.5)
    ctx.stroke()
    ctx.globalAlpha = invAlpha

    // Board binding marks
    ctx.fillStyle = rgb(palette.terrainFill, 0.55)
    ctx.fillRect(-14, 4, 5, 7)
    ctx.fillRect(9, 4, 5, 7)

    ctx.fillStyle = rgb(palette.playerColor, invAlpha)

    // ── Legs — connect feet to body ──
    ctx.lineWidth = 5
    ctx.strokeStyle = rgb(palette.playerColor, invAlpha)
    ctx.beginPath(); ctx.moveTo(-7, 5);  ctx.lineTo(-4, -2);  ctx.stroke()
    ctx.beginPath(); ctx.moveTo(7,  5);  ctx.lineTo(4,  -2);  ctx.stroke()

    // ── Body (torso) ──
    ctx.fillStyle = rgb(palette.playerColor, invAlpha)
    ctx.beginPath()
    ctx.ellipse(0, -4, 7.5, 10, 0, 0, Math.PI * 2)
    ctx.fill()

    // ── Arms — different pose airborne vs grounded ──
    ctx.lineWidth = 4
    ctx.strokeStyle = rgb(palette.playerColor, invAlpha)
    if (airborne && !spinning) {
      // Jump pose — arms spread outward for balance
      ctx.beginPath()
      ctx.moveTo(-5, -9)
      ctx.quadraticCurveTo(-16, -20, -20, -10)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(5, -9)
      ctx.quadraticCurveTo(16, -20, 20, -10)
      ctx.stroke()
    } else if (spinning) {
      // Tucked backflip — arms in tight
      ctx.beginPath()
      ctx.moveTo(-5, -9)
      ctx.quadraticCurveTo(-10, -4, -6, 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(5, -9)
      ctx.quadraticCurveTo(10, -4, 6, 2)
      ctx.stroke()
    } else {
      // Grounded — arms relaxed, slightly back
      ctx.beginPath()
      ctx.moveTo(-5, -9)
      ctx.quadraticCurveTo(-14, -8, -16, 0)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(5, -9)
      ctx.quadraticCurveTo(12, -6, 14, 2)
      ctx.stroke()
    }

    // ── Head ──
    ctx.fillStyle = rgb(palette.playerColor, invAlpha)
    ctx.beginPath()
    ctx.arc(-1, -19, 8, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  // ─── scarf (Verlet trail) ────────────────────────────────────────────────

  private _drawScarf(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    palette: ColorPalette,
    colorLevel: number,
    cameraX: number,
    cameraY: number,
  ) {
    const pts = player.scarfPoints
    if (pts.length < 3) return

    const sp  = pts.map(p => ({ x: p.x - cameraX, y: p.y - cameraY }))
    const sp2 = pts.map(p => ({ x: p.x - cameraX - 2.5, y: p.y - cameraY - 2 }))
    const scarfAlpha = 0.82 + colorLevel * 0.16

    ctx.save()
    ctx.lineCap  = 'round'
    ctx.lineJoin = 'round'

    // Glow pass
    ctx.strokeStyle = rgb(palette.trailColor, Math.min(scarfAlpha * 0.26, 0.90))
    ctx.lineWidth   = 13
    this._drawSmoothCurve(ctx, sp)
    ctx.stroke()

    // Main strand
    ctx.strokeStyle = rgb(palette.trailColor, Math.min(scarfAlpha * 0.88, 0.96))
    ctx.lineWidth   = 3.5
    this._drawSmoothCurve(ctx, sp)
    ctx.stroke()

    // Second strand — slightly offset, thinner
    ctx.strokeStyle = rgb(palette.trailColor, Math.min(scarfAlpha * 0.52, 0.88))
    ctx.lineWidth   = 2.0
    this._drawSmoothCurve(ctx, sp2)
    ctx.stroke()

    ctx.restore()
  }

  private _drawSmoothCurve(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
    if (pts.length < 2) return
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2
      const my = (pts[i].y + pts[i + 1].y) / 2
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
  }

  // ─── coins ───────────────────────────────────────────────────────────────

  private _drawCoins(
    ctx: CanvasRenderingContext2D,
    coinSystem: CoinSystem,
    palette: ColorPalette,
    colorLevel: number,
    cameraX: number,
    cameraY: number,
    time: number,
  ) {
    for (const c of coinSystem.coins) {
      const sx = c.worldX - cameraX
      const sy = c.worldY - cameraY
      if (sx < -80 || sx > this.W + 80) continue

      if (c.collected) {
        const prog = 1 - c.collectTimer / 0.35
        const r    = 7 + prog * 22
        const a    = (1 - prog) * 0.75
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.strokeStyle = rgb(palette.trailColor, a)
        ctx.lineWidth   = 2
        ctx.stroke()
        continue
      }

      const pulse = Math.sin(time * 2.2 + c.pulsePhase) * 0.12 + 0.88
      const r     = 6.5

      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.8)
      g.addColorStop(0, rgb(palette.trailColor, 0.28 * pulse))
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(sx, sy, r * 3.8, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fillStyle = rgb(palette.trailColor, 0.82 * pulse)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = rgb(palette.playerColor, 0.95)
      ctx.fill()
    }
  }

  // ─── combo pop ──────────────────────────────────────────────────────────

  private _drawComboPop(
    ctx: CanvasRenderingContext2D,
    palette: ColorPalette,
    timer: number,
    value: number,
    sx: number,
    sy: number,
  ) {
    if (timer <= 0) return
    const MAX   = 0.7
    const prog  = 1 - timer / MAX          // 0 → 1
    const alpha = prog < 0.3 ? prog / 0.3 : 1 - (prog - 0.3) / 0.7
    const rise  = prog * 40                 // floats up 40px

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.textAlign   = 'center'
    ctx.font        = `700 ${20 + value * 0.8}px -apple-system, sans-serif`
    ctx.fillStyle   = rgb(palette.trailColor, 1)
    ctx.fillText(`${value}×`, sx, sy - rise)
    ctx.restore()
  }

  // ─── arches ─────────────────────────────────────────────────────────────

  private _drawArches(
    ctx: CanvasRenderingContext2D,
    mechanics: MechanicsManager,
    palette: ColorPalette,
    colorLevel: number,
    cameraX: number,
    cameraY: number,
    time: number,
  ) {
    for (const a of mechanics.arches) {
      const sx = a.worldX - cameraX
      const sy = a.centerY - cameraY
      if (sx < -100 || sx > this.W + 100) continue

      const isHit  = a.hitTimer > 0
      const pulse  = Math.sin(a.pulsePhase + time * 2.2) * 0.15 + 0.85
      const alpha  = isHit ? Math.max(0, a.hitTimer / 1.5) * 0.7 : pulse
      const radius = isHit ? a.radius * (1 + (1 - a.hitTimer / 1.5) * 0.55) : a.radius

      // Wide outer glow
      ctx.beginPath()
      ctx.arc(sx, sy, radius + 12, 0, Math.PI * 2)
      ctx.strokeStyle = rgb(palette.archColor, alpha * 0.18)
      ctx.lineWidth   = 16
      ctx.stroke()

      // Mid glow
      ctx.beginPath()
      ctx.arc(sx, sy, radius + 4, 0, Math.PI * 2)
      ctx.strokeStyle = rgb(palette.archColor, alpha * 0.35)
      ctx.lineWidth   = 6
      ctx.stroke()

      // Crisp ring
      ctx.beginPath()
      ctx.arc(sx, sy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = rgb(palette.archColor, Math.min(alpha * 0.92, 1))
      ctx.lineWidth   = 2.5
      ctx.stroke()

      // Orbiting shimmer dots — 8 of them
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + time * 1.1
        const dx  = Math.cos(ang) * radius
        const dy  = Math.sin(ang) * radius
        // Dot glow
        const dg  = ctx.createRadialGradient(sx + dx, sy + dy, 0, sx + dx, sy + dy, 6)
        dg.addColorStop(0, rgb(palette.archColor, alpha * 0.8))
        dg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = dg
        ctx.fillRect(sx + dx - 6, sy + dy - 6, 12, 12)
      }

      // Centre dot
      ctx.beginPath()
      ctx.arc(sx, sy, 3 + Math.sin(time * 3 + a.pulsePhase) * 1, 0, Math.PI * 2)
      ctx.fillStyle = rgb(palette.archColor, alpha * 0.55)
      ctx.fill()
    }
  }

  // ─── gravity wells ──────────────────────────────────────────────────────

  private _drawWells(
    ctx: CanvasRenderingContext2D,
    mechanics: MechanicsManager,
    palette: ColorPalette,
    cameraX: number,
    cameraY: number,
    time: number,
  ) {
    for (const w of mechanics.wells) {
      const sx = w.worldX - cameraX
      const sy = w.y - cameraY
      if (sx < -120 || sx > this.W + 120) continue

      // Ground glow shadow under well
      const gnd = ctx.createRadialGradient(sx, sy + 35, 0, sx, sy + 35, 55)
      gnd.addColorStop(0, rgb(palette.wellColor, 0.18))
      gnd.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gnd
      ctx.fillRect(sx - 55, sy - 20, 110, 110)

      // Three spinning vortex ellipses
      for (let ring = 0; ring < 3; ring++) {
        const angle = w.spinAngle + ring * Math.PI * 0.67
        const r     = w.radius * (0.4 + ring * 0.3)
        const alpha = 0.45 - ring * 0.1

        ctx.save()
        ctx.translate(sx, sy)
        ctx.rotate(angle)
        // Glow ellipse
        ctx.strokeStyle = rgb(palette.wellColor, alpha * 0.35)
        ctx.lineWidth   = 5
        ctx.beginPath()
        ctx.ellipse(0, 0, r, r * 0.35, 0, 0, Math.PI * 2)
        ctx.stroke()
        // Crisp ellipse
        ctx.strokeStyle = rgb(palette.wellColor, alpha)
        ctx.lineWidth   = 1.5
        ctx.stroke()
        ctx.restore()
      }

      // Central pulsing core
      const coreR = 7 + Math.sin(time * 4) * 2.5
      const coreg = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR * 2)
      coreg.addColorStop(0, rgb(palette.wellColor, 0.8))
      coreg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = coreg
      ctx.beginPath()
      ctx.arc(sx, sy, coreR * 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ─── phase walls ────────────────────────────────────────────────────────

  private _drawPhaseWalls(
    ctx: CanvasRenderingContext2D,
    mechanics: MechanicsManager,
    palette: ColorPalette,
    cameraX: number,
    cameraY: number,
    time: number,
  ) {
    for (const w of mechanics.walls) {
      const sx   = w.worldX - cameraX
      const topY = w.topY - cameraY
      if (sx < -60 || sx > this.W + 60) continue

      const riding = w.riding
      const pulse  = riding ? Math.sin(time * 9) * 0.3 + 0.7 : Math.sin(time * 2.5) * 0.1 + 0.9
      const baseA  = riding ? 0.88 : 0.32

      // Column fill gradient
      const colGrad = ctx.createLinearGradient(0, topY, 0, topY + w.height)
      colGrad.addColorStop(0,   rgb(palette.archColor, 0))
      colGrad.addColorStop(0.2, rgb(palette.archColor, baseA * 0.14 * pulse))
      colGrad.addColorStop(0.8, rgb(palette.archColor, baseA * 0.14 * pulse))
      colGrad.addColorStop(1,   rgb(palette.archColor, 0))
      ctx.fillStyle = colGrad
      ctx.fillRect(sx - 10, topY, 20, w.height)

      // Edge glow lines
      for (const ex of [sx - 10, sx + 10]) {
        ctx.strokeStyle = rgb(palette.archColor, baseA * 0.20 * pulse)
        ctx.lineWidth   = 7
        ctx.beginPath()
        ctx.moveTo(ex, topY)
        ctx.lineTo(ex, topY + w.height)
        ctx.stroke()
        ctx.strokeStyle = rgb(palette.archColor, baseA * 0.85 * pulse)
        ctx.lineWidth   = 1.5
        ctx.stroke()
      }

      // Travelling energy nodes
      for (let n = 0; n < 3; n++) {
        const phase  = (time * (riding ? 2.4 : 1.1) + n / 3) % 1
        const ny     = topY + phase * w.height
        const na     = Math.sin(phase * Math.PI) * baseA * 0.9 * pulse
        ctx.beginPath()
        ctx.arc(sx, ny, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = rgb(palette.archColor, na)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(sx, ny, 8, 0, Math.PI * 2)
        ctx.fillStyle = rgb(palette.archColor, na * 0.22)
        ctx.fill()
      }

      // Top/bottom caps
      for (const cy of [topY, topY + w.height]) {
        ctx.beginPath()
        ctx.arc(sx, cy, 4.5, 0, Math.PI * 2)
        ctx.fillStyle = rgb(palette.archColor, baseA * 0.75 * pulse)
        ctx.fill()
      }
    }
  }

  // ─── flow burst overlay ─────────────────────────────────────────────────

  private _drawFlowBurstOverlay(
    ctx: CanvasRenderingContext2D,
    palette: ColorPalette,
    colorLevel: number,
    time: number,
  ) {
    const pulse = Math.sin(time * 5.2) * 0.04 + 0.07
    const grad  = ctx.createRadialGradient(
      this.W * 0.3, this.H * 0.5, 0,
      this.W * 0.3, this.H * 0.5, this.W * 0.75
    )
    grad.addColorStop(0, rgb(palette.trailColor, pulse * 1.4))
    grad.addColorStop(0.5, rgb(palette.trailColor, pulse * 0.4))
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, this.W, this.H)
  }

  // ─── intro overlay ──────────────────────────────────────────────────────

  private _drawIntroOverlay(
    ctx: CanvasRenderingContext2D,
    palette: ColorPalette,
    introProgress: number,   // 1 → 0 as intro completes
  ) {
    // introProgress: 1.0 = just started, 0.0 = intro done
    // Title visible during first 70% of intro, then fades out
    const titleAlpha = introProgress > 0.3
      ? Math.min((introProgress - 0.3) / 0.4, 1.0)  // fade in
      : introProgress / 0.3                            // fade out at end

    if (titleAlpha <= 0) return

    ctx.save()
    ctx.globalAlpha = titleAlpha

    // Soft dark vignette behind title
    const vig = ctx.createRadialGradient(
      this.W / 2, this.H / 2, this.H * 0.1,
      this.W / 2, this.H / 2, this.H * 0.6
    )
    vig.addColorStop(0, 'rgba(0,0,0,0.45)')
    vig.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, this.W, this.H)

    // Title
    ctx.textAlign    = 'center'
    ctx.font         = `700 ${Math.round(this.W * 0.072)}px -apple-system, sans-serif`
    ctx.fillStyle    = rgb(palette.playerColor, 1.0)
    ctx.fillText("Azlan's Abyss", this.W / 2, this.H / 2 - 8)

    // Tagline
    ctx.font      = `400 12px -apple-system, sans-serif`
    ctx.fillStyle = rgb(palette.trailColor, 0.65)
    ctx.fillText('F L O W   D E E P E R', this.W / 2, this.H / 2 + 22)

    ctx.restore()
  }

  // ─── HUD ────────────────────────────────────────────────────────────────

  drawHUD(
    ctx: CanvasRenderingContext2D,
    combo: number,
    distance: number,
    colorLevel: number,
    palette: ColorPalette,
    isFlowBurst: boolean,
    time: number,
    runCoins: number,
    totalCoins: number,
  ) {
    const m = 22

    // Distance — top right
    ctx.textAlign = 'right'
    ctx.font      = '500 15px -apple-system, sans-serif'
    ctx.fillStyle = rgb(palette.playerColor, 0.55)
    ctx.fillText(`${Math.floor(distance)}m`, this.W - m, m + 14)

    // Coins — top left: small orb + count
    const coinPulse = 0.62 + colorLevel * 0.18
    ctx.save()
    ctx.beginPath()
    ctx.arc(m + 6, m + 8, 5, 0, Math.PI * 2)
    ctx.fillStyle = rgb(palette.trailColor, coinPulse)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(m + 6, m + 8, 2, 0, Math.PI * 2)
    ctx.fillStyle = rgb(palette.playerColor, 0.9)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.font      = '500 14px -apple-system, sans-serif'
    ctx.fillStyle = rgb(palette.playerColor, 0.60)
    ctx.fillText(`${runCoins}`, m + 16, m + 14)
    ctx.restore()

    // Combo — bottom left
    if (combo > 0) {
      const sz     = Math.min(20 + combo * 1.8, 54)
      const cAlpha = isFlowBurst ? 0.65 + Math.sin(time * 7) * 0.33 : 0.90
      ctx.textAlign = 'left'
      ctx.font      = `700 ${sz}px -apple-system, sans-serif`
      ctx.fillStyle = rgb(palette.trailColor, cAlpha)
      ctx.fillText(`${combo}×`, m, this.H - m - 8)
      ctx.font      = '400 10px -apple-system, sans-serif'
      ctx.fillStyle = rgb(palette.trailColor, 0.38)
      ctx.fillText('COMBO', m, this.H - m + 7)
    }

    // Color level bar — right edge, thin vertical
    const barH  = this.H * 0.28
    const barX  = this.W - m - 3
    const barY  = (this.H - barH) / 2
    const fillH = barH * (colorLevel / 4)

    ctx.fillStyle = rgb(palette.playerColor, 0.10)
    ctx.beginPath()
    ctx.roundRect(barX, barY, 3, barH, 1.5)
    ctx.fill()

    if (fillH > 2) {
      const bg = ctx.createLinearGradient(0, barY + barH, 0, barY + barH - fillH)
      bg.addColorStop(0, rgb(palette.trailColor, 0.88))
      bg.addColorStop(1, rgb(palette.archColor,  0.5))
      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.roundRect(barX, barY + barH - fillH, 3, fillH, 1.5)
      ctx.fill()

      // Level dot at top of fill
      ctx.beginPath()
      ctx.arc(barX + 1.5, barY + barH - fillH, 4, 0, Math.PI * 2)
      ctx.fillStyle = rgb(palette.trailColor, 0.9)
      ctx.fill()
    }

    if (isFlowBurst) {
      ctx.textAlign = 'center'
      ctx.font      = '700 11px -apple-system, sans-serif'
      ctx.fillStyle = rgb(palette.trailColor, 0.75 + Math.sin(time * 5.5) * 0.22)
      ctx.fillText('F L O W   B U R S T', this.W / 2, m + 12)
    }
  }
}

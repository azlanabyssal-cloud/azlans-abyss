import { Terrain } from './terrain'
import { ColorSystem } from './colorSystem'
import { AudioEngine } from './audio'
import { ParticleSystem } from './particles'
import { MechanicsManager } from './mechanics'
import { CoinSystem } from './coins'
import { Renderer } from './renderer'
import { PostProcessor } from './postProcess'
import { createPlayer, stepPhysics, triggerJump } from './physics'
import type { PlayerState } from '../types/game'

const FIXED_STEP        = 1 / 60
const MAX_DELTA         = 0.1
const FLOW_BURST_COMBO  = 15
const FLOW_BURST_DUR    = 4.0
const INTRO_DUR         = 1.6   // seconds for cinematic intro
const JUMP_CUT_VELOCITY = 420   // px/s — max upward speed on early hold release (≈8 u/s)

export type EngineEvent = 'crash' | 'perfectLanding' | 'flip' | 'archHit' | 'wellHit' | 'flowBurst'

export class GameEngine {
  private gameCanvas: HTMLCanvasElement | null = null
  private glCanvas:   HTMLCanvasElement | null = null
  private ctx:        CanvasRenderingContext2D | null = null

  private terrain     = new Terrain(window.innerHeight)
  private colorSystem = new ColorSystem()
  private audio       = new AudioEngine()
  private particles   = new ParticleSystem()
  private mechanics   = new MechanicsManager()
  private coins       = new CoinSystem()
  private renderer    = new Renderer()
  private post        = new PostProcessor()

  private player!: PlayerState
  private W = 0
  private H = 0

  private rafId    = 0
  private lastTime = 0
  private accum    = 0
  private gameTime = 0

  // Input
  private isHeld      = false
  private jumpQueued  = false
  private inputReady  = false

  // Input forgiveness windows
  private _coyoteTimer  = 0   // grace after walking off edge (120ms)
  private _jumpBuffer   = 0   // queued jump if tapped just before landing (100ms)
  private _jumpCooldown = 0   // brief lockout after jump (80ms)

  private _sandTimer    = 0   // throttle sand spray emission
  private _wasHeld      = false  // previous frame hold state — jump cut detection
  private _wind         = 0     // -1→+1 wind factor, slow cycle, biases sand spray

  // Game state
  combo        = 0
  distance     = 0
  isFlowBurst  = false
  flowBurstTimer = 0
  runCoins     = 0
  private totalCoins = 0

  onEvent?: (e: EngineEvent) => void
  onCrash?: () => void

  // Camera
  private cameraX  = 0
  private cameraY  = 0
  private camVY    = 0

  // Camera shake
  private shakeX   = 0
  private shakeY   = 0
  private shakeMag = 0

  // Jump ring — expanding circle on takeoff
  private jumpRingTimer = 0
  private jumpRingX     = 0
  private jumpRingY     = 0

  // Combo pop — number that floats near player on flip
  private comboPopTimer = 0
  private comboPopValue = 0
  private comboPopX     = 0
  private comboPopY     = 0

  // Cinematic intro
  private introTimer = INTRO_DUR

  init(gameCanvas: HTMLCanvasElement, glCanvas: HTMLCanvasElement) {
    this.gameCanvas = gameCanvas
    this.glCanvas   = glCanvas
    this.ctx        = gameCanvas.getContext('2d')

    this.resize()
    this.post.init(glCanvas)
    this.audio.init()
    this.totalCoins = parseInt(localStorage.getItem('abyss_coins') ?? '0', 10)

    this._bindInput(gameCanvas)
    this._reset()
  }

  private _reset() {
    const startY = this.terrain.getY(200) - 40
    this.player  = createPlayer(200, startY)

    // Warm-start speed from last 5 run history — experienced players pick up faster
    const speedHist = JSON.parse(localStorage.getItem('abyss_speed_hist') ?? '[]') as number[]
    if (speedHist.length > 0) {
      const avg = speedHist.reduce((a, b) => a + b, 0) / speedHist.length
      this.player.vx = Math.min(Math.max(180, avg * 0.85), 360)
    }
    this.combo   = 0
    this.distance = 0
    this.isFlowBurst    = false
    this.flowBurstTimer = 0
    this.inputReady     = false
    this.isHeld         = false
    this.jumpQueued     = false
    this._coyoteTimer   = 0
    this._jumpBuffer    = 0
    this._jumpCooldown  = 0
    this._sandTimer     = 0
    this._wasHeld       = false
    this.colorSystem.level    = 0
    this.colorSystem.target   = 0
    this.colorSystem.velocity = 0
    this.cameraX  = 200 - this.W * 0.3
    this.cameraY  = 0
    this.camVY    = 0
    this.shakeX   = 0
    this.shakeY   = 0
    this.shakeMag = 0
    this.jumpRingTimer = 0
    this.comboPopTimer = 0
    this.introTimer    = INTRO_DUR
    this.mechanics.reset()
    this.coins.reset(200)
    this.runCoins = 0
    this.audio.resetCombo()
  }

  start() {
    this._reset()
    this.lastTime = performance.now()
    this.accum    = 0
    this.rafId    = requestAnimationFrame(this._loop)
  }

  stop() { cancelAnimationFrame(this.rafId) }

  restart() { this.start() }

  private _loop = (now: number) => {
    this.rafId = requestAnimationFrame(this._loop)
    let dt = (now - this.lastTime) / 1000
    this.lastTime = now
    if (dt > MAX_DELTA) dt = MAX_DELTA
    this.gameTime += dt
    this.accum    += dt

    while (this.accum >= FIXED_STEP) {
      this._physicsStep(FIXED_STEP)
      this.accum -= FIXED_STEP
    }

    this._render()
  }

  private _physicsStep(dt: number) {
    // Intro countdown
    if (this.introTimer > 0) this.introTimer = Math.max(0, this.introTimer - dt)

    // Enable input after grace period (after intro settles)
    if (!this.inputReady && this.gameTime > 0.4) this.inputReady = true

    // Tick forgiveness timers
    if (this._coyoteTimer  > 0) this._coyoteTimer  = Math.max(0, this._coyoteTimer  - dt)
    if (this._jumpBuffer   > 0) this._jumpBuffer   = Math.max(0, this._jumpBuffer   - dt)
    if (this._jumpCooldown > 0) this._jumpCooldown = Math.max(0, this._jumpCooldown - dt)

    const prevGrounded = this.player.isGrounded
    const canJump = (this.player.isGrounded || this._coyoteTimer > 0) && this._jumpCooldown <= 0

    // Execute jump — from direct input or from buffer
    const doJump = (this.jumpQueued || this._jumpBuffer > 0) && canJump && this.inputReady
    if (doJump) {
      triggerJump(this.player)
      this.audio.playJump()
      this.jumpRingTimer = 0.45
      this.jumpRingX     = this.player.worldX
      this.jumpRingY     = this.player.worldY
      this.particles.emit(
        this.player.worldX, this.player.worldY,
        this.colorSystem.palette.trailColor, 6, 90, Math.PI
      )
      this.jumpQueued    = false
      this._jumpBuffer   = 0
      this._coyoteTimer  = 0
      this._jumpCooldown = 0.08
    }
    // Jump pressed mid-air — store in buffer for when we land
    if (this.jumpQueued && !canJump && this.inputReady) {
      this._jumpBuffer = 0.10
      this.jumpQueued  = false
    }

    // Jump cut — clamp upward velocity on hold release mid-rise
    const justReleased = this._wasHeld && !this.isHeld
    if (justReleased && !this.player.isGrounded && this.player.vy < 0) {
      this.player.vy = Math.max(this.player.vy, -JUMP_CUT_VELOCITY)
    }
    this._wasHeld = this.isHeld

    const result = stepPhysics(
      this.player, this.terrain,
      this.colorSystem.level, this.isHeld, dt
    )

    // Coyote time — walked off an edge without jumping
    if (prevGrounded && !this.player.isGrounded && !doJump) {
      this._coyoteTimer = 0.12
    }

    if (result.crashed) { this._handleCrash(); return }

    // Flip
    if (result.completedFlip && result.flipsCompleted > 0) {
      this.combo += result.flipsCompleted
      this.audio.playChime(this.combo)
      this.onEvent?.('flip')
      this.particles.emit(
        this.player.worldX, this.player.worldY - 20,
        this.colorSystem.palette.particleColor, 8, 120, Math.PI * 1.5
      )
      // Combo pop near player
      this.comboPopTimer = 0.7
      this.comboPopValue = this.combo
      this.comboPopX     = this.player.worldX
      this.comboPopY     = this.player.worldY - 30
    }

    if (result.perfectLanding) {
      this.audio.playPerfectLanding()
      this.onEvent?.('perfectLanding')
      this.particles.emit(
        this.player.worldX, this.player.worldY,
        this.colorSystem.palette.trailColor, 24, 220
      )
      this._shake(6)
    } else if (result.justLanded) {
      // Normal landing — soft thud + light shake
      this.audio.playLand()
      this._shake(2.5)
      this.combo = 0
    }

    // Flow Burst
    if (this.combo >= FLOW_BURST_COMBO && !this.isFlowBurst) {
      this.isFlowBurst    = true
      this.flowBurstTimer = FLOW_BURST_DUR
      this.audio.playFlowBurst()
      this.onEvent?.('flowBurst')
    }
    if (this.isFlowBurst) {
      this.flowBurstTimer -= dt
      if (this.flowBurstTimer <= 0) {
        this.isFlowBurst = false
        this.player.isInvincible = false
      } else {
        this.player.isInvincible   = true
        this.player.invincibleTimer = 0.1
      }
    }

    // Distance + color
    this.distance = (this.player.worldX - 200) / 8
    this.colorSystem.update(this.combo, this.player.isGrounded, dt)
    this.audio.updateAmbient(this.colorSystem.level)
    this.audio.updateSlide(this.player.isGrounded, this.player.vx)
    this._wind = Math.sin(this.gameTime * 0.07) * 0.65

    // Spawn mechanics + coins
    this.mechanics.spawn(
      this.cameraX, this.W,
      (wx) => this.terrain.getY(wx, this.colorSystem.level)
    )
    this.coins.spawn(
      this.cameraX, this.W,
      (wx) => this.terrain.getY(wx, this.colorSystem.level)
    )

    // Coin collection
    const newCoins = this.coins.update(this.player.worldX, this.player.worldY, dt)
    if (newCoins > 0) {
      this.runCoins   += newCoins
      this.totalCoins += newCoins
      localStorage.setItem('abyss_coins', String(this.totalCoins))
      this.audio.playCoin()
      this.particles.emit(
        this.player.worldX, this.player.worldY - 18,
        this.colorSystem.palette.trailColor, 4, 90, Math.PI * 1.2
      )
    }
    this.mechanics.update(
      this.player, dt, this.particles,
      this.colorSystem.palette.archColor,
      this.colorSystem.palette.wellColor,
      () => { this.combo += 2; this.audio.playChime(this.combo); this.onEvent?.('archHit') },
      () => { this.combo += 1; this.onEvent?.('wellHit') },
    )

    this.particles.update(dt)

    // Sand spray — directional kick from fast ground contact
    this._sandTimer = Math.max(0, this._sandTimer - dt)
    if (this.player.isGrounded && this.player.vx > 240 && this._sandTimer <= 0) {
      const interval = Math.max(0.022, 0.07 - (this.player.vx - 240) / 10000)
      this._sandTimer = interval
      this.particles.emitSandSplash(
        this.player.worldX, this.player.worldY,
        this.colorSystem.palette.trailColor,
        result.slopeAngle,
        this.player.vx,
        this._wind,
      )
    }

    // Jump ring decay
    if (this.jumpRingTimer > 0) this.jumpRingTimer = Math.max(0, this.jumpRingTimer - dt)
    // Combo pop decay
    if (this.comboPopTimer > 0) this.comboPopTimer = Math.max(0, this.comboPopTimer - dt)

    // Camera — horizontal: lerp toward lead target (0.12 factor)
    //          vertical:   60% player + 40% terrain ahead (terrain prediction blend)
    const camSpeedNorm  = Math.min((this.player.vx - 180) / 720, 1)
    const lookahead     = camSpeedNorm * this.W * 0.09
    const targetCX      = this.player.worldX - this.W * 0.35 + lookahead   // 35% from left
    const terrainAhead  = this.terrain.getY(this.player.worldX + this.player.vx * 0.5, this.colorSystem.level)
    const targetCY      = this.player.worldY * 0.60 + terrainAhead * 0.40 - this.H * 0.58
    this.cameraX       += (targetCX - this.cameraX) * 0.12   // smooth lerp

    const springF = (targetCY - this.cameraY) * 5.0 - this.camVY * 7.0
    this.camVY   += springF * dt
    this.cameraY += this.camVY * dt

    // Shake decay
    if (this.shakeMag > 0.3) {
      this.shakeX   = (Math.random() - 0.5) * this.shakeMag
      this.shakeY   = (Math.random() - 0.5) * this.shakeMag * 0.6
      this.shakeMag *= 0.72
    } else {
      this.shakeX = this.shakeY = this.shakeMag = 0
    }
  }

  private _shake(mag: number) {
    this.shakeMag = Math.max(this.shakeMag, mag)
  }

  private _handleCrash() {
    // Save run-end speed for warm-start on next restart
    const hist = JSON.parse(localStorage.getItem('abyss_speed_hist') ?? '[]') as number[]
    hist.push(Math.round(this.player.vx))
    if (hist.length > 5) hist.shift()
    localStorage.setItem('abyss_speed_hist', JSON.stringify(hist))

    this._shake(12)
    this.audio.playCrash()
    this.particles.emit(
      this.player.worldX, this.player.worldY,
      [255, 120, 80], 30, 300
    )
    this.stop()
    this.onCrash?.()
  }

  private _render() {
    const ctx = this.ctx
    if (!ctx) return

    const p = this.colorSystem.palette

    // Intro camera offset — cinematic descent into the abyss
    const introProgress  = Math.max(0, this.introTimer / INTRO_DUR)
    const introCamOffset = Math.pow(introProgress, 2) * this.H * 0.28

    this.renderer.draw(
      ctx,
      this.player,
      this.terrain,
      this.mechanics,
      this.coins,
      this.particles,
      p,
      this.colorSystem.level,
      this.cameraX + this.shakeX,
      this.cameraY - introCamOffset + this.shakeY,
      this.combo,
      this.distance,
      this.gameTime,
      this.isFlowBurst,
      this.jumpRingTimer,
      this.jumpRingX,
      this.jumpRingY,
      this.comboPopTimer,
      this.comboPopValue,
      this.comboPopX,
      this.comboPopY,
      introProgress,
    )

    this.renderer.drawHUD(
      ctx,
      this.combo,
      this.distance,
      this.colorSystem.level,
      p,
      this.isFlowBurst,
      this.gameTime,
      this.runCoins,
      this.totalCoins,
    )

    this.post.render(this.gameTime, this.colorSystem.level)
  }

  private _bindInput(canvas: HTMLCanvasElement) {
    const onDown = () => {
      this.audio.resume()
      if (this.inputReady) this.jumpQueued = true   // always queue; canJump check is in physics step
      this.isHeld = true
    }
    const onUp = () => { this.isHeld = false }

    canvas.addEventListener('touchstart', e => { e.preventDefault(); onDown() }, { passive: false })
    canvas.addEventListener('touchend',   e => { e.preventDefault(); onUp() },   { passive: false })
    canvas.addEventListener('mousedown',  onDown)
    canvas.addEventListener('mouseup',    onUp)
  }

  resize() {
    this.W = window.innerWidth
    this.H = window.innerHeight
    if (this.gameCanvas) {
      this.gameCanvas.width  = this.W
      this.gameCanvas.height = this.H
    }
    if (this.glCanvas) {
      this.glCanvas.width  = this.W
      this.glCanvas.height = this.H
    }
    this.terrain.updateBaseY(this.H)
    this.renderer.resize(this.W, this.H)
    this.post.resize(this.W, this.H)
  }
}

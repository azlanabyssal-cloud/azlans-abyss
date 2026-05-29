import type { PlayerState, TrailPoint, SurfaceType } from '../types/game'
import type { Terrain } from './terrain'

// Feel over realism — tuned by hand until it clicked
const GRAVITY            = 1480    // px/s² — all other constants orbit this
const MIN_SPEED          = 180     // px/s — player never truly stops
const MAX_SPEED          = 900     // px/s
const SLOPE_FORCE        = 1400    // slope acceleration/deceleration
const JUMP_BASE          = 740     // px/s vertical launch
const JUMP_SPEED_MULT    = 0.30    // faster run = slightly higher jump
const GRAVITY_HOLD_MULT  = 0.55    // 45% gravity while rising + holding — the skill gap
const FALL_GRAVITY_MULT  = 1.08    // snappier fall than rise
const ANGULAR_TORQUE     = 9.2     // rad/s² flip acceleration
const MAX_ANGULAR_VEL    = 9.5     // rad/s — 540°/s, 1 flip ≈ 0.66s
const TRICK_MIN_AIR_FR   = 12      // frames (200ms) before flip rotation starts
const AIR_DRAG           = 0.9997
const AIR_SLOPE_DRIFT    = 7.8     // px/s² — airborne speed bias from terrain slope angle (upslope boosts, downslope costs)
const APEX_THRESHOLD     = 130     // px/s — |vy| within this = apex zone (≈2.5 u/s)
const APEX_GRAVITY_MULT  = 0.18    // gravity fraction at dead apex — the float trick
const LANDING_PERFECT    = 0.21    // rad — 12°, tight window for perfect
const LANDING_SAFE       = 0.77    // rad — 44°, beyond this is a crash
const TRAIL_MAX          = 80
const INVINCIBLE_DUR     = 0.9

export function createPlayer(startX: number, startY: number): PlayerState {
  return {
    worldX: startX, worldY: startY,
    vx: MIN_SPEED, vy: 0,
    angle: 0, angularVel: 0,
    isGrounded: true, isBackflipping: false,
    flipsInAir: 0,
    trailPoints: [],
    scarfPoints: [],
    isInvincible: false, invincibleTimer: 0,
    airborneFrames: 0,
  }
}

export interface PhysicsResult {
  crashed: boolean
  perfectLanding: boolean
  justLanded: boolean
  completedFlip: boolean
  flipsCompleted: number
  surfaceType: SurfaceType
  slopeAngle:  number
}

export function stepPhysics(
  player: PlayerState,
  terrain: Terrain,
  colorLevel: number,
  isHeld: boolean,
  dt: number
): PhysicsResult {
  let crashed = false
  let perfectLanding = false
  let justLanded = false
  let completedFlip = false
  let flipsCompleted = 0
  let surfaceType: SurfaceType = 'flat'

  const terrainY = terrain.getY(player.worldX, colorLevel)
  const slope    = terrain.getSlope(player.worldX, colorLevel)
  const slopeR   = terrain.getSlopeRatio(player.worldX, colorLevel)

  // Invincibility countdown
  if (player.isInvincible) {
    player.invincibleTimer -= dt
    if (player.invincibleTimer <= 0) player.isInvincible = false
  }

  if (player.isGrounded) {
    // slope drives speed — downhill accelerates, uphill bleeds it
    player.vx += slopeR * SLOPE_FORCE * dt
    player.vx = Math.max(MIN_SPEED, Math.min(MAX_SPEED, player.vx))
    // surface-aware drag: slip face loose, windward grips harder, crest floats
    surfaceType = Math.abs(slopeR) < 0.05 ? 'crest'
                : slopeR < -0.10          ? 'windward'
                : slopeR >  0.12          ? 'slip'
                :                           'flat'
    const surfDrag = surfaceType === 'windward' ? 0.990
                   : surfaceType === 'crest'    ? 0.999
                   : surfaceType === 'slip'     ? 0.995
                   :                             0.992
    player.vx *= Math.pow(surfDrag, dt * 60)

    // Reset backflip state when grounded
    player.angle = slope
    player.angularVel = 0
    player.isBackflipping = false

    // Jump input — hold triggers jump, not tap (we detect rising edge in engine)
    // This is called from engine on jump trigger

    // Snap to terrain
    player.worldY = terrainY
    player.vy = 0

    // Advance horizontal position
    player.worldX += player.vx * dt

  } else {
    // Variable gravity: lighter on the way up when held, snappier on fall
    // Apex hang: gravity eases to 18% near zero velocity — floats on all jump types
    // vy < 0 = rising (screen-Y increases downward)
    const isRising  = player.vy < 0
    const absvY     = Math.abs(player.vy)
    const baseMult  = (isRising && isHeld) ? GRAVITY_HOLD_MULT
                    : !isRising            ? FALL_GRAVITY_MULT
                    :                        1.0
    const apexBlend = absvY < APEX_THRESHOLD ? 1 - absvY / APEX_THRESHOLD : 0
    const gravMult  = baseMult + (APEX_GRAVITY_MULT - baseMult) * apexBlend
    player.vy += GRAVITY * gravMult * dt
    player.vx *= Math.pow(AIR_DRAG, dt * 60)
    // Slope drift — upslope launch gives tiny air boost, downslope gives tiny brake
    player.vx -= Math.sin(slope) * AIR_SLOPE_DRIFT * dt
    player.worldX += player.vx * dt
    player.worldY += player.vy * dt

    player.airborneFrames++

    // Flip rotation only after minimum air time (prevents accidental trigger on tap)
    if (isHeld && player.isBackflipping && player.airborneFrames >= TRICK_MIN_AIR_FR) {
      player.angularVel = Math.min(player.angularVel + ANGULAR_TORQUE * dt, MAX_ANGULAR_VEL)
    }

    // Rotate character
    const prevAngle = player.angle
    player.angle += player.angularVel * dt

    // Count full flips (every 2π)
    const prevFlips = Math.floor(Math.abs(prevAngle - slope) / (Math.PI * 2))
    const currFlips = Math.floor(Math.abs(player.angle - slope) / (Math.PI * 2))
    if (currFlips > prevFlips) {
      completedFlip = true
      flipsCompleted = currFlips - prevFlips
      player.flipsInAir += flipsCompleted
    }

    // Landing detection
    if (player.worldY >= terrainY) {
      const angleDiff = Math.abs(normalizeAngle(player.angle - slope))

      if (!player.isInvincible && angleDiff > LANDING_SAFE) {
        crashed = true
      } else {
        // Safe or perfect landing
        const wasFlipping = player.flipsInAir > 0
        if (angleDiff < LANDING_PERFECT && wasFlipping) {
          perfectLanding = true
          player.vx *= 1.12  // 12% speed reward on perfect land
          player.isInvincible = true
          player.invincibleTimer = INVINCIBLE_DUR
        }

        // keep forward speed — killing momentum on landing feels awful
        justLanded = true
        player.isGrounded = true
        player.isBackflipping = false
        player.vy = 0
        player.worldY = terrainY
        player.angle = slope
        player.flipsInAir = 0
        player.angularVel = 0
        player.airborneFrames = 0
      }
    }
  }

  // Verlet scarf: track neck attachment point in world space
  // Neck at local (-2, -15) from board pivot, rotated by player.angle
  const neckX = player.worldX + (-2) * Math.cos(player.angle) - (-15) * Math.sin(player.angle)
  const neckY = player.worldY + (-2) * Math.sin(player.angle) + (-15) * Math.cos(player.angle)
  player.scarfPoints.unshift({ x: neckX, y: neckY })
  if (player.scarfPoints.length > 18) player.scarfPoints.length = 18

  // Update trail
  updateTrail(player, colorLevel)

  return { crashed, perfectLanding, justLanded, completedFlip, flipsCompleted, surfaceType, slopeAngle: slope }
}

export function triggerJump(player: PlayerState) {
  if (!player.isGrounded) return
  const jumpVy = -(JUMP_BASE + player.vx * JUMP_SPEED_MULT)
  player.vy = jumpVy
  player.isGrounded = false
  player.isBackflipping = true
  player.flipsInAir = 0
  player.angularVel = 3.8
  player.airborneFrames = 0   // fresh count — flip min-time starts from 0
}

function updateTrail(player: PlayerState, colorLevel: number) {
  player.trailPoints.unshift({
    x: player.worldX,
    y: player.worldY - 6,  // slightly above board
    age: 0,
    colorLevel,
  })

  // Age points and prune
  for (const p of player.trailPoints) p.age += 0.016
  if (player.trailPoints.length > TRAIL_MAX) {
    player.trailPoints.length = TRAIL_MAX
  }
  // Remove very old points
  while (player.trailPoints.length > 0 && player.trailPoints[player.trailPoints.length - 1].age > 1.2) {
    player.trailPoints.pop()
  }
}

function normalizeAngle(a: number): number {
  a = a % (Math.PI * 2)
  if (a > Math.PI) a -= Math.PI * 2
  if (a < -Math.PI) a += Math.PI * 2
  return a
}

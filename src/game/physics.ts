import type { PlayerState, TrailPoint } from '../types/game'
import type { Terrain } from './terrain'

// Tuned constants — feel > realism (directly from Alto's design philosophy)
const GRAVITY         = 1480   // px/s² — lighter for flowing, Alto-style arcs
const MIN_SPEED       = 180    // px/s — player never truly stops
const MAX_SPEED       = 900    // px/s
const SLOPE_FORCE     = 1400   // how strongly slope accelerates/decelerates
const JUMP_BASE       = 740    // px/s vertical launch velocity — higher, floatier
const JUMP_SPEED_MULT = 0.30   // faster run = higher jump
const ANGULAR_TORQUE  = 9.2    // rad/s² per second held
const MAX_ANGULAR_VEL = 14     // rad/s max backflip speed
const AIR_DRAG        = 0.9997 // per frame
const GROUND_DRAG     = 0.992  // per frame
const LANDING_PERFECT = 0.32   // rad — angle match threshold for perfect landing
const LANDING_SAFE    = 0.9    // rad — max safe landing angle diff
const TRAIL_MAX       = 80     // max trail points
const INVINCIBLE_DUR  = 0.9    // seconds after perfect landing

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
  }
}

export interface PhysicsResult {
  crashed: boolean
  perfectLanding: boolean
  justLanded: boolean
  completedFlip: boolean
  flipsCompleted: number
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

  const terrainY = terrain.getY(player.worldX, colorLevel)
  const slope    = terrain.getSlope(player.worldX, colorLevel)
  const slopeR   = terrain.getSlopeRatio(player.worldX, colorLevel)

  // Invincibility countdown
  if (player.isInvincible) {
    player.invincibleTimer -= dt
    if (player.invincibleTimer <= 0) player.isInvincible = false
  }

  if (player.isGrounded) {
    // Slope-driven acceleration (Alto's core mechanic)
    player.vx += slopeR * SLOPE_FORCE * dt
    player.vx = Math.max(MIN_SPEED, Math.min(MAX_SPEED, player.vx))
    player.vx *= Math.pow(GROUND_DRAG, dt * 60)

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
    // Airborne physics
    player.vy += GRAVITY * dt
    player.vx *= Math.pow(AIR_DRAG, dt * 60)
    player.worldX += player.vx * dt
    player.worldY += player.vy * dt

    // Backflip rotation when held
    if (isHeld && player.isBackflipping) {
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
          player.vx *= 1.18  // Alto's speed burst on perfect landing
          player.isInvincible = true
          player.invincibleTimer = INVINCIBLE_DUR
        }

        // Alto's velocity preservation — never kill forward momentum on landing
        justLanded = true
        player.isGrounded = true
        player.isBackflipping = false
        player.vy = 0
        player.worldY = terrainY
        player.angle = slope
        player.flipsInAir = 0
        player.angularVel = 0
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

  return { crashed, perfectLanding, justLanded, completedFlip, flipsCompleted }
}

export function triggerJump(player: PlayerState) {
  if (!player.isGrounded) return
  const jumpVy = -(JUMP_BASE + player.vx * JUMP_SPEED_MULT)
  player.vy = jumpVy
  player.isGrounded = false
  player.isBackflipping = true
  player.flipsInAir = 0
  player.angularVel = 3.8  // initial rotation momentum — snappier flip start
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

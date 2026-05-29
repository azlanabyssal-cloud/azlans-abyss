export type GameState   = 'menu' | 'playing' | 'dead'
export type SurfaceType = 'windward' | 'crest' | 'slip' | 'flat'

export interface Vec2 { x: number; y: number }

export interface PlayerState {
  worldX: number
  worldY: number
  vx: number
  vy: number
  angle: number
  angularVel: number
  isGrounded: boolean
  isBackflipping: boolean
  flipsInAir: number
  trailPoints: TrailPoint[]
  scarfPoints: Vec2[]
  isInvincible: boolean
  invincibleTimer: number
  airborneFrames: number
}

export interface TrailPoint {
  x: number
  y: number
  age: number
  colorLevel: number
}

export interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  size: number
  r: number; g: number; b: number
  active: boolean
}

export interface LightArch {
  worldX: number
  centerY: number
  radius: number
  active: boolean
  hitTimer: number
  pulsePhase: number
}

export interface GravityWell {
  worldX: number
  y: number
  radius: number
  active: boolean
  spinAngle: number
}

export interface PhaseWall {
  worldX: number
  topY: number
  height: number
  active: boolean
  riding: boolean
}

export interface ColorPalette {
  skyTop: [number, number, number]
  skyBot: [number, number, number]
  terrainFill: [number, number, number]
  terrainEdge: [number, number, number]
  playerColor: [number, number, number]
  trailColor: [number, number, number]
  archColor: [number, number, number]
  wellColor: [number, number, number]
  particleColor: [number, number, number]
  ambientLight: number
}

export interface Coin {
  worldX: number
  worldY: number
  collected: boolean
  collectTimer: number
  pulsePhase: number
}

export interface SaveData {
  bestDistance: number
  bestCombo: number
  totalRuns: number
}

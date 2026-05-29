import type { Coin } from '../types/game'

const COLLECT_RADIUS = 36
const COIN_HOVER     = 26   // px above terrain surface
const CLUSTER_SPAN   = 42   // px between coins in a cluster
const CLUSTER_GAP    = 190  // world units between clusters

export class CoinSystem {
  coins: Coin[] = []
  private nextSpawnX = 0

  reset(startX: number) {
    this.coins       = []
    this.nextSpawnX  = startX + 500
  }

  spawn(cameraX: number, screenW: number, getTerrainY: (x: number) => number) {
    const ahead = cameraX + screenW + 320

    while (this.nextSpawnX < ahead) {
      const count = 3 + (Math.random() > 0.5 ? 1 : 0)
      for (let i = 0; i < count; i++) {
        const cx = this.nextSpawnX + i * CLUSTER_SPAN
        this.coins.push({
          worldX:       cx,
          worldY:       getTerrainY(cx) - COIN_HOVER,
          collected:    false,
          collectTimer: 0,
          pulsePhase:   Math.random() * Math.PI * 2,
        })
      }
      this.nextSpawnX += CLUSTER_GAP + Math.random() * 100
    }

    // Prune: collected + animation done, or far behind camera
    const behind = cameraX - 500
    this.coins = this.coins.filter(c =>
      (c.worldX > behind) && (!c.collected || c.collectTimer > 0)
    )
  }

  update(playerX: number, playerY: number, dt: number): number {
    let collected = 0
    for (const c of this.coins) {
      if (c.collected) {
        c.collectTimer = Math.max(0, c.collectTimer - dt)
        continue
      }
      const dx = playerX - c.worldX
      const dy = playerY - c.worldY
      if (dx * dx + dy * dy < COLLECT_RADIUS * COLLECT_RADIUS) {
        c.collected    = true
        c.collectTimer = 0.35
        collected++
      }
    }
    return collected
  }
}

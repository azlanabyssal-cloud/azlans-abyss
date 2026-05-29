import { useEffect, useRef } from 'react'

interface Props { onStart: () => void }

export default function MainMenu({ onStart }: Props) {
  const started    = useRef(false)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef(0)

  const handleStart = () => {
    if (started.current) return
    started.current = true
    onStart()
  }

  // Atmospheric background canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let t = 0
    let scrollX = 0

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Simple terrain noise using sum-of-sines (no dependency needed)
    const terrainY = (wx: number) => {
      const H = canvas.height
      return H * 0.62
        + Math.sin(wx * 0.006 + 0.5)  * H * 0.10
        + Math.sin(wx * 0.014 + 1.2)  * H * 0.06
        + Math.sin(wx * 0.031 + 2.4)  * H * 0.03
        + Math.sin(wx * 0.065 + 0.9)  * H * 0.015
    }

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      t       += 0.012
      scrollX += 0.4  // slow drift
      const W = canvas.width
      const H = canvas.height

      ctx.clearRect(0, 0, W, H)

      // Sky gradient — deep indigo void
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.8)
      sky.addColorStop(0,   `rgb(4,4,16)`)
      sky.addColorStop(0.65,`rgb(14,12,42)`)
      sky.addColorStop(1,   `rgb(14,12,42)`)
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      // Horizon haze — subtle purple warmth
      const haze = ctx.createLinearGradient(0, H * 0.44, 0, H * 0.72)
      haze.addColorStop(0, 'rgba(88,72,168,0)')
      haze.addColorStop(1, 'rgba(88,72,168,0.04)')
      ctx.fillStyle = haze
      ctx.fillRect(0, H * 0.44, W, H * 0.28)

      // Stars — stable positions, gentle twinkle
      for (let i = 0; i < 55; i++) {
        const sx      = ((i * 137.508 + 0.5) % 1) * W
        const sy      = ((i * 89.23  + 0.3) % 1) * H * 0.50
        const flicker = Math.sin(t * (0.7 + (i % 5) * 0.12) + i) * 0.25 + 0.75
        ctx.globalAlpha = flicker * 0.30
        ctx.fillStyle   = 'rgb(210,202,238)'
        ctx.beginPath()
        ctx.arc(sx, sy, 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Parallax mountains — lighter than sky for visible contrast
      const mxOff = -(scrollX * 0.12) % W
      ctx.fillStyle = 'rgba(22,18,55,0.80)'
      for (let tile = -1; tile <= 2; tile++) {
        const ox = mxOff + tile * W
        ctx.beginPath()
        ctx.moveTo(ox, H)
        for (let x = 0; x <= W; x += 20) {
          const my = H * 0.44
            + Math.sin((x + ox) * 0.009 + 0.5) * H * 0.10
            + Math.sin((x + ox) * 0.021 + 1.8) * H * 0.04
            + Math.sin((x + ox) * 0.045 + 3.1) * H * 0.015
          ctx.lineTo(ox + x, my)
        }
        ctx.lineTo(ox + W, H)
        ctx.closePath()
        ctx.fill()
      }

      // Terrain surface
      const cameraX = scrollX - W * 0.3
      const pts: [number, number][] = []
      for (let sx = -4; sx <= W + 4; sx += 4) {
        const wx = sx + cameraX
        pts.push([sx, terrainY(wx)])
      }

      // Terrain fill
      ctx.beginPath()
      ctx.moveTo(pts[0][0], H + 10)
      for (const [px, py] of pts) ctx.lineTo(px, py)
      ctx.lineTo(pts[pts.length - 1][0], H + 10)
      ctx.closePath()
      const minY    = Math.min(...pts.map(p => p[1]))
      const fillGrd = ctx.createLinearGradient(0, minY - 20, 0, minY + 100)
      fillGrd.addColorStop(0,   'rgba(88,72,168,0.18)')
      fillGrd.addColorStop(0.15,'rgba(3,2,9,0.95)')
      fillGrd.addColorStop(1,   'rgba(3,2,9,1)')
      ctx.fillStyle = fillGrd
      ctx.fill()

      // Terrain edge path
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (const [px, py] of pts) ctx.lineTo(px, py)
      ctx.lineJoin = 'round'
      ctx.lineCap  = 'round'

      // Outer glow — breathes slowly in menu
      const breathe = Math.sin(t * 0.8) * 0.04 + 0.16
      ctx.strokeStyle = `rgba(108,88,210,${breathe})`
      ctx.lineWidth   = 20
      ctx.stroke()
      // Mid glow
      ctx.strokeStyle = 'rgba(108,88,210,0.40)'
      ctx.lineWidth   = 7
      ctx.stroke()
      // Crisp surface line
      ctx.strokeStyle = 'rgba(128,108,230,1.0)'
      ctx.lineWidth   = 2.2
      ctx.stroke()

      // Floating orbs — slow drift across sky
      for (let i = 0; i < 3; i++) {
        const ox = ((-scrollX * 0.06 + i * (W / 3)) % W + W) % W
        const oy  = H * 0.22 + Math.sin(t * 0.4 + i * 2.1) * H * 0.04
        const r   = 18 + i * 12
        const g   = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * 1.8)
        g.addColorStop(0, 'rgba(88,72,168,0.07)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(ox - r * 2, oy - r * 2, r * 4, r * 4)
      }
    }

    loop()
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  // Tap / click to start
  useEffect(() => {
    const t = (e: TouchEvent) => { e.preventDefault(); handleStart() }
    const m = () => handleStart()
    window.addEventListener('touchstart', t, { passive: false })
    window.addEventListener('mousedown',  m)
    return () => {
      window.removeEventListener('touchstart', t)
      window.removeEventListener('mousedown',  m)
    }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Animated background */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />

      {/* UI layer */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 1.4s ease both',
        pointerEvents: 'none',
      }}>
        {/* Decorative arch — matches game's light arch visual */}
        <div style={{
          position: 'relative',
          width: 148, height: 148,
          marginBottom: 44,
          animation: 'float 4s ease-in-out infinite',
        }}>
          {/* Outer glow ring */}
          <div style={{
            position: 'absolute', inset: -8,
            borderRadius: '50%',
            boxShadow: '0 0 30px rgba(88,72,168,0.2), 0 0 60px rgba(88,72,168,0.08)',
          }} />
          {/* Main ring */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: '2px solid rgba(108,98,175,0.55)',
            boxShadow: '0 0 18px rgba(88,72,168,0.25), inset 0 0 18px rgba(88,72,168,0.08)',
          }} />
          {/* Inner ring */}
          <div style={{
            position: 'absolute',
            inset: 26,
            borderRadius: '50%',
            border: '1px solid rgba(108,98,175,0.25)',
          }} />
          {/* Centre dot */}
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 6, height: 6,
            borderRadius: '50%',
            background: 'rgba(108,98,175,0.6)',
            boxShadow: '0 0 8px rgba(88,72,168,0.5)',
          }} />
        </div>

        {/* Title */}
        <div style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          fontSize: 'clamp(30px, 8vw, 44px)',
          fontWeight: 700,
          letterSpacing: '0.03em',
          color: '#d4ceff',
          textAlign: 'center',
          lineHeight: 1.1,
          animation: 'glow 3.5s ease-in-out infinite',
          marginBottom: 12,
        }}>
          Azlan's Abyss
        </div>

        <div style={{
          fontFamily: '-apple-system, sans-serif',
          fontSize: 11,
          letterSpacing: '0.30em',
          color: 'rgba(138,125,200,0.50)',
          textTransform: 'uppercase',
          marginBottom: 64,
        }}>
          Flow deeper
        </div>

        <div style={{
          fontFamily: '-apple-system, sans-serif',
          fontSize: 13,
          letterSpacing: '0.14em',
          color: 'rgba(210,202,238,0.50)',
          textTransform: 'uppercase',
          animation: 'pulse 2.2s ease-in-out infinite',
        }}>
          Tap anywhere to begin
        </div>
      </div>

      {/* Controls hint — absolute bottom */}
      <div style={{
        position: 'absolute',
        bottom: 30,
        width: '100%',
        textAlign: 'center',
        fontFamily: '-apple-system, sans-serif',
        fontSize: 11,
        color: 'rgba(138,125,200,0.32)',
        letterSpacing: '0.08em',
        lineHeight: 1.9,
        pointerEvents: 'none',
        animation: 'fadeIn 2s ease both',
      }}>
        TAP — jump &nbsp;·&nbsp; HOLD — backflip
        <br />
        chain tricks to awaken the world
      </div>
    </div>
  )
}

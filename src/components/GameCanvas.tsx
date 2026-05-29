import { useEffect, useRef } from 'react'
import { GameEngine } from '../game/engine'

interface Props {
  engineRef: React.RefObject<GameEngine | null>
  onCrash: (dist: number, combo: number) => void
}

export default function GameCanvas({ engineRef, onCrash }: Props) {
  const gameRef = useRef<HTMLCanvasElement>(null)
  const glRef   = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const game = gameRef.current
    const gl   = glRef.current
    if (!game || !gl) return

    const engine = new GameEngine()
    ;(engineRef as React.MutableRefObject<GameEngine | null>).current = engine

    engine.init(game, gl)
    engine.onCrash = () => onCrash(engine.distance, engine.combo)
    engine.start()

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      engine.stop()
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const shared: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0,
    width: '100%', height: '100%',
    touchAction: 'none',
  }

  return (
    <>
      <canvas ref={gameRef} style={{ ...shared, zIndex: 1 }} />
      <canvas ref={glRef}   style={{ ...shared, zIndex: 2, pointerEvents: 'none' }} />
    </>
  )
}

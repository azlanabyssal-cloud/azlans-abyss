import { useState, useRef, useCallback } from 'react'
import GameCanvas from './components/GameCanvas'
import MainMenu from './components/MainMenu'
import GameOver from './components/GameOver'
import type { GameState, SaveData } from './types/game'
import type { GameEngine } from './game/engine'

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem('azlans-abyss')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { bestDistance: 0, bestCombo: 0, totalRuns: 0 }
}

function writeSave(d: SaveData) {
  try { localStorage.setItem('azlans-abyss', JSON.stringify(d)) } catch {}
}

export default function App() {
  const [state,    setState]    = useState<GameState>('menu')
  const [lastDist, setLastDist] = useState(0)
  const [lastCombo,setLastCombo]= useState(0)
  const [save,     setSave]     = useState<SaveData>(loadSave)
  const engineRef = useRef<GameEngine | null>(null)

  const handleStart = useCallback(() => {
    setState('playing')
  }, [])

  const handleCrash = useCallback((dist: number, combo: number) => {
    setLastDist(dist)
    setLastCombo(combo)

    setSave(prev => {
      const next: SaveData = {
        bestDistance: Math.max(prev.bestDistance, Math.floor(dist)),
        bestCombo:    Math.max(prev.bestCombo, combo),
        totalRuns:    prev.totalRuns + 1,
      }
      writeSave(next)
      return next
    })

    setState('dead')
  }, [])

  const handleRestart = useCallback(() => {
    setState('playing')
    setTimeout(() => engineRef.current?.restart(), 50)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Game canvas always mounted so engine can init */}
      {(state === 'playing' || state === 'dead') && (
        <GameCanvas engineRef={engineRef} onCrash={handleCrash} />
      )}

      {state === 'menu' && (
        <MainMenu onStart={handleStart} />
      )}

      {state === 'dead' && (
        <GameOver
          distance={lastDist}
          combo={lastCombo}
          best={save}
          onRestart={handleRestart}
        />
      )}
    </div>
  )
}

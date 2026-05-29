import { useEffect, useRef } from 'react'
import type { SaveData } from '../types/game'

interface Props {
  distance: number
  combo: number
  best: SaveData
  onRestart: () => void
}

export default function GameOver({ distance, combo, best, onRestart }: Props) {
  const clicked = useRef(false)

  const handleRestart = () => {
    if (clicked.current) return
    clicked.current = true
    onRestart()
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const t = (e: TouchEvent) => { e.preventDefault(); handleRestart() }
      const m = () => handleRestart()
      window.addEventListener('touchstart', t, { passive: false })
      window.addEventListener('mousedown', m)
      return () => { window.removeEventListener('touchstart', t); window.removeEventListener('mousedown', m) }
    }, 900)  // brief delay so accidental tap doesn't skip
    return () => clearTimeout(timer)
  }, [])

  const isNewBestDist  = distance >= best.bestDistance
  const isNewBestCombo = combo    >= best.bestCombo

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(8,6,16,0.88)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      animation: 'fadeIn 0.6s ease both',
    }}>
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        fontSize: 13,
        letterSpacing: '0.25em',
        color: 'rgba(180,160,255,0.5)',
        textTransform: 'uppercase',
        marginBottom: 24,
      }}>
        The abyss reclaims
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex', gap: 48, marginBottom: 48,
      }}>
        <Stat label="Distance" value={`${Math.floor(distance)}m`} isNew={isNewBestDist} />
        <Stat label="Best Combo" value={`${combo}×`} isNew={isNewBestCombo} />
      </div>

      {/* Best row */}
      <div style={{
        display: 'flex', gap: 32, marginBottom: 56,
        opacity: 0.45,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#a09acc', textTransform: 'uppercase' }}>Best</div>
          <div style={{ fontSize: 14, color: '#c8c0ee', marginTop: 2 }}>{Math.floor(best.bestDistance)}m</div>
        </div>
        <div style={{ width: 1, background: 'rgba(180,160,255,0.15)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#a09acc', textTransform: 'uppercase' }}>Runs</div>
          <div style={{ fontSize: 14, color: '#c8c0ee', marginTop: 2 }}>{best.totalRuns}</div>
        </div>
      </div>

      <div style={{
        fontFamily: '-apple-system, sans-serif',
        fontSize: 13,
        letterSpacing: '0.15em',
        color: 'rgba(200,185,255,0.45)',
        textTransform: 'uppercase',
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        Tap to descend again
      </div>
    </div>
  )
}

function Stat({ label, value, isNew }: { label: string; value: string; isNew: boolean }) {
  return (
    <div style={{ textAlign: 'center', animation: 'fadeIn 0.8s ease both', animationDelay: '0.2s' }}>
      <div style={{
        fontSize: 'clamp(32px, 9vw, 48px)',
        fontWeight: 700,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        color: isNew ? '#a0ffd0' : '#d4ceff',
        letterSpacing: '-0.02em',
        animation: isNew ? 'glow 2s ease-in-out infinite' : undefined,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 11,
        letterSpacing: '0.2em',
        color: isNew ? 'rgba(160,255,208,0.55)' : 'rgba(180,160,255,0.45)',
        textTransform: 'uppercase',
        marginTop: 4,
      }}>
        {isNew ? '✦ new best' : label}
      </div>
    </div>
  )
}

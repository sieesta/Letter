import { motion } from 'framer-motion'
import type { MusicState } from '../types'

interface MusicDockProps {
  music: MusicState
  volume: number
  onToggle: () => void
  onVolume: (value: number) => void
  onRetry: () => void
}

const BARS = [0.55, 1, 0.35, 0.8, 0.45]

/**
 * The only music control the visitor ever sees. The actual YouTube player is
 * invisible and off-screen; this little dock is what keeps the experience
 * honest and controllable.
 */
export function MusicDock({ music, volume, onToggle, onVolume, onRetry }: MusicDockProps) {
  const playing = music.status === 'playing'
  const downloading = music.status === 'downloading' || music.status === 'resolving'
  const fetching = music.source === 'stream' && music.downloadProgress < 1
  const blocked = music.status === 'blocked' || music.status === 'error'

  const label = music.status === 'none' ? 'No song' : music.title || 'Our song'

  const statusText = blocked
    ? 'Tap anywhere to start'
    : fetching
      ? `Fetching ${Math.round(music.downloadProgress * 100)}%`
      : playing
        ? 'Now playing'
        : downloading
          ? 'Finding the song'
          : music.status === 'paused'
            ? 'Paused'
            : music.status === 'none'
              ? 'Add a song in the setup'
              : 'Ready'

  return (
    <motion.div
      className="dock"
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        className={`dock__button${playing ? ' is-playing' : ''}${blocked ? ' is-blocked' : ''}`}
        onClick={blocked ? onRetry : onToggle}
        aria-label={blocked ? 'Start the music' : playing ? 'Pause the music' : 'Play the music'}
        title={music.error ?? undefined}
      >
        {playing ? (
          <span className="dock__eq" aria-hidden="true">
            {BARS.map((_scale, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.14}s` }} />
            ))}
          </span>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="dock__glyph">
            <path d="M8 5.5v13l11-6.5-11-6.5Z" />
          </svg>
        )}
      </button>

      <div className="dock__meta">
        <span className="dock__title">{label}</span>
        <span className="dock__status">{statusText}</span>
        <div className="dock__track">
          <span className="dock__fill" style={{ width: `${Math.round(music.progress * 100)}%` }} />
          {fetching ? (
            <span className="dock__buffer" style={{ width: `${Math.round(music.downloadProgress * 100)}%` }} />
          ) : null}
        </div>
      </div>

      <div className="dock__volume">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="dock__vol-icon">
          <path d="M4 9v6h3l5 4V5L7 9H4Z" />
          {volume > 0.02 ? <path d="M16 9.5a3.5 3.5 0 0 1 0 5" fill="none" strokeWidth="1.6" /> : null}
        </svg>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(event) => onVolume(Number(event.target.value) / 100)}
          aria-label="Volume"
        />
      </div>
    </motion.div>
  )
}

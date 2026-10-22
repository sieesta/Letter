import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { MusicState, MuseumProfile } from '../types'

interface EnterSequenceProps {
  profile: MuseumProfile
  music: MusicState
  onDone: () => void
}

const RADIUS = 27
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * The threshold of the hall: a door of light opens, the title settles in, and
 * the song is fetched in the background while the visitor watches.
 */
export function EnterSequence({ profile, music, onDone }: EnterSequenceProps) {
  const [ready, setReady] = useState(false)

  const progress = useMemo(() => {
    if (music.status === 'playing') return 1
    if (music.status === 'none' || music.status === 'error') return 1
    return Math.max(0.04, music.downloadProgress)
  }, [music.status, music.downloadProgress])

  useEffect(() => {
    if (music.status === 'playing' || music.status === 'none' || music.status === 'error') {
      const timer = window.setTimeout(() => setReady(true), 900)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [music.status])

  useEffect(() => {
    const fallback = window.setTimeout(() => setReady(true), 5000)
    return () => window.clearTimeout(fallback)
  }, [])

  useEffect(() => {
    if (!ready) return undefined
    const timer = window.setTimeout(onDone, 1150)
    return () => window.clearTimeout(timer)
  }, [ready, onDone])

  const statusText =
    music.status === 'playing'
      ? 'The hall is ready'
      : music.status === 'downloading'
        ? `Fetching the song · ${Math.round(music.downloadProgress * 100)}%`
        : music.status === 'resolving'
          ? 'Finding the song'
          : music.status === 'error'
            ? 'The hall is ready anyway'
            : 'Opening the door'

  return (
    <motion.div
      className="enter"
      initial={{ opacity: 1 }}
      animate={{ opacity: ready ? 0 : 1 }}
      transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
    >
      <div className="enter__backdrop" />

      <motion.div
        className="enter__door"
        initial={{ scaleX: 0.015, scaleY: 0.02 }}
        animate={{ scaleX: 1, scaleY: 1 }}
        transition={{ duration: 1.35, ease: [0.65, 0, 0.35, 1] }}
      />

      <div className="enter__content">
        <motion.p
          className="enter__eyebrow"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.9 }}
        >
          {profile.herName ? `A hallway for ${profile.herName}` : 'A hallway for you'}
        </motion.p>

        <motion.h2
          className="enter__title"
          initial={{ opacity: 0, y: 22, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.95, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {profile.hallTitle || 'A Hallway of Us'}
        </motion.h2>

        <div className="enter__ring">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle className="enter__ring-track" cx="32" cy="32" r={RADIUS} />
            <motion.circle
              className="enter__ring-fill"
              cx="32"
              cy="32"
              r={RADIUS}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - progress) }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          </svg>
          <span className="enter__ring-value">{Math.round(progress * 100)}%</span>
        </div>

        <motion.p
          className="enter__status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.15, duration: 0.8 }}
        >
          {statusText}
        </motion.p>
      </div>
    </motion.div>
  )
}

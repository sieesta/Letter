import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { MuseumProfile } from './types'
import { MusicEngine } from './lib/audioEngine'
import { useMusic } from './lib/useMusic'
import { clearProfile, loadProfile, saveProfile } from './lib/idb'
import { extractVideoId } from './lib/youtube'
import { SetupScreen } from './components/SetupScreen'
import { ThresholdScreen } from './components/ThresholdScreen'
import { EnterSequence } from './components/EnterSequence'
import { Hallway } from './components/hall/Hallway'
import { MusicDock } from './components/MusicDock'

type Phase = 'loading' | 'setup' | 'threshold' | 'entering' | 'hall'

export default function App() {
  const engine = useMemo(() => new MusicEngine(), [])
  const music = useMusic(engine)
  const [phase, setPhase] = useState<Phase>('loading')
  const [profile, setProfile] = useState<MuseumProfile | null>(null)
  const [volume, setVolume] = useState(() => engine.getVolume())

  useEffect(() => {
    let alive = true
    loadProfile()
      .then((saved) => {
        if (!alive) return
        setProfile(saved)
        setPhase(saved ? 'threshold' : 'setup')
      })
      .catch(() => {
        if (!alive) return
        setPhase('setup')
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => () => engine.dispose(), [engine])

  const startMusic = useCallback(
    (target: MuseumProfile) => {
      const videoId = extractVideoId(target.youtubeUrl)
      if (target.audioKey) {
        void engine.start({
          audioKey: target.audioKey,
          audioFileName: target.audioFileName,
        })
        return
      }
      if (videoId) {
        void engine.start({ videoId })
        return
      }
      void engine.start({})
    },
    [engine],
  )

  const handleEnter = useCallback(() => {
    if (!profile) return
    // Must happen inside the click so the browser unlocks audio.
    engine.arm()
    startMusic(profile)
    setPhase('entering')
  }, [engine, profile, startMusic])

  const handleSave = useCallback(
    async (next: MuseumProfile) => {
      await saveProfile(next)
      setProfile(next)
      setPhase(next.photos.length ? 'threshold' : 'setup')
    },
    [],
  )

  const handleReset = useCallback(async () => {
    await clearProfile()
    setProfile(null)
    setPhase('setup')
  }, [])

  const handleEdit = useCallback(() => setPhase('setup'), [])

  const handleBackToHall = useCallback(() => {
    setPhase(profile && profile.photos.length ? 'threshold' : 'setup')
  }, [profile])

  const musicBusy = music.status === 'downloading' || music.status === 'resolving' || music.status === 'arming'

  return (
    <main className="app">
      <AnimatePresence mode="wait">
        {phase === 'loading' ? (
          <motion.div key="loading" className="app__boot" exit={{ opacity: 0 }}>
            <span className="app__bootDot" />
          </motion.div>
        ) : null}

        {phase === 'setup' ? (
          <motion.div
            key="setup"
            className="app__screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.5 }}
          >
            <SetupScreen
              profile={profile}
              onSave={handleSave}
              onCancel={profile ? handleBackToHall : undefined}
              onReset={handleReset}
            />
          </motion.div>
        ) : null}

        {phase === 'threshold' && profile ? (
          <motion.div
            key="threshold"
            className="app__screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.5 }}
          >
            <ThresholdScreen
              profile={profile}
              onEnter={handleEnter}
              onEdit={handleEdit}
              onReset={handleReset}
            />
          </motion.div>
        ) : null}

        {phase === 'entering' && profile ? (
          <EnterSequence key="entering" profile={profile} music={music} onDone={() => setPhase('hall')} />
        ) : null}

        {phase === 'hall' && profile ? (
          <motion.div
            key="hall"
            className="app__screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9 }}
          >
            <Hallway profile={profile} onEdit={handleEdit} onReset={handleReset} />
            <MusicDock
              music={music}
              volume={volume}
              onToggle={() => void engine.toggle()}
              onVolume={(value) => {
                engine.setVolume(value)
                setVolume(value)
              }}
              onRetry={() => void engine.retry()}
            />
            {musicBusy ? <span className="app__buffering" aria-hidden="true" /> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  )
}

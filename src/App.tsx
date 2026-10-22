import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { MemoryPhoto, MuseumProfile } from './types'
import { MusicEngine } from './lib/audioEngine'
import { useMusic } from './lib/useMusic'
import { extractVideoId } from './lib/youtube'
import { SetupScreen } from './components/SetupScreen'
import { ThresholdScreen } from './components/ThresholdScreen'
import { EnterSequence } from './components/EnterSequence'
import { Hallway } from './components/hall/Hallway'
import { MusicDock } from './components/MusicDock'
import { DesktopModeGate } from './components/DesktopModeGate'
import { SplashScreen } from './components/SplashScreen'
import {
  signInAnonymously,
  getCurrentUserId,
  saveProfile as supabaseSaveProfile,
  loadProfileBySlug,
  updateProfile,
  uploadPhoto,
  uploadAudio,
} from './lib/supabaseService'

type Phase = 'splash' | 'loading' | 'setup' | 'threshold' | 'entering' | 'hall'

const SLUG_RE = /^\/m\/([a-z0-9-]+)(\/)?$/

export default function App() {
  const engine = useMemo(() => new MusicEngine(), [])
  const music = useMusic(engine)
  const [phase, setPhase] = useState<Phase>('splash')
  const [profile, setProfile] = useState<MuseumProfile | null>(null)
  const [volume, setVolume] = useState(() => engine.getVolume())
  const [isPublic, setIsPublic] = useState(false)

  // Detect public share URL: /m/<slug>
  useEffect(() => {
    const match = window.location.pathname.match(SLUG_RE)
    if (match) {
      setIsPublic(true)
      void loadPublicProfile(match[1])
    }
  }, [])

  const loadPublicProfile = useCallback(async (slug: string) => {
    try {
      const saved = await loadProfileBySlug(slug)
      if (saved) {
        setProfile(saved)
        setPhase('threshold')
      } else {
        setPhase('setup')
      }
    } catch {
      setPhase('setup')
    }
  }, [])

  // Anonymous sign-in + load creator's profiles
  useEffect(() => {
    let alive = true
    const init = async () => {
      try {
        await signInAnonymously()
      } catch {
        /* sign-in may fail offline; app still works for public view */
      }
      if (!alive) return
      setPhase('setup')
    }
    init()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    // Try to unlock audio on first interaction
    const unlock = () => {
      engine.ensureUnlocked?.()
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('click', unlock)
    }
    document.addEventListener('touchstart', unlock, { once: true })
    document.addEventListener('click', unlock, { once: true })
    return () => {
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('click', unlock)
    }
  }, [engine])

  useEffect(() => () => engine.dispose(), [engine])

  const startMusic = useCallback(
    (target: MuseumProfile) => {
      const videoId = extractVideoId(target.youtubeUrl)
      // Prefer a direct Supabase audio URL, then YouTube id, then silence.
      if (target.audioKey && target.audioKey.startsWith('http')) {
        void engine.start({ audioUrl: target.audioKey, audioFileName: target.audioFileName })
        return
      }
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
    engine.ensureUnlocked?.()
    startMusic(profile)
    setPhase('entering')
  }, [engine, profile, startMusic])

  const handleSplashEnter = useCallback(() => {
    setPhase('loading')
  }, [])

  const handleSave = useCallback(
    async (next: MuseumProfile) => {
      try {
        const userId = await getCurrentUserId()
        if (userId) {
          const result = await supabaseSaveProfile(userId, { ...next, slug: next.slug || '' })
          if (result) {
            const saved: MuseumProfile = { ...next, id: result.id, slug: result.slug, userId }
            setProfile(saved)
            setPhase(saved.photos.length ? 'threshold' : 'setup')
            return
          }
        }
      } catch {
        /* fall through */
      }
      setProfile(next)
      setPhase(next.photos.length ? 'threshold' : 'setup')
    },
    [],
  )

  const handleSaveWithFiles = useCallback(
    async (
      next: MuseumProfile,
      photoFiles: File[],
      audioFile: File | null,
    ) => {
      const userId = await getCurrentUserId()
      if (!userId) return

      // Save profile first to get an id
      const result = await supabaseSaveProfile(userId, { ...next, slug: next.slug || '' })
      if (!result) return
      const profileId = result.id
      const slug = result.slug

      // Upload photos
      const uploadedPhotos: MemoryPhoto[] = []
      for (const file of photoFiles) {
        const uploaded = await uploadPhoto(userId, profileId, file)
        if (uploaded) {
          uploadedPhotos.push({
            id: crypto.randomUUID(),
            src: uploaded.publicUrl,
            caption: '',
            date: '',
          })
        }
      }

      // Upload audio
      let audioUrl = next.audioKey
      let audioFileName = next.audioFileName
      if (audioFile) {
        const uploaded = await uploadAudio(userId, profileId, audioFile)
        if (uploaded) {
          audioUrl = uploaded.publicUrl
          audioFileName = audioFile.name
        }
      }

      const finalProfile: MuseumProfile = {
        ...next,
        id: profileId,
        slug,
        userId,
        audioKey: audioUrl,
        audioFileName,
        photos: [...next.photos, ...uploadedPhotos],
        updatedAt: Date.now(),
      }

      // Persist photo/audio metadata
      await updateProfile(userId, profileId, {
        audioKey: audioUrl,
        audioFileName,
      })

      setProfile(finalProfile)
      setPhase(finalProfile.photos.length ? 'threshold' : 'setup')
    },
    [],
  )

  const handleReset = useCallback(() => {
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
        {phase === 'splash' ? (
          <motion.div
            key="splash"
            className="app__screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <SplashScreen onEnter={handleSplashEnter} />
          </motion.div>
        ) : null}

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
              onSave={isPublic ? undefined : handleSave}
              onSaveWithFiles={isPublic ? undefined : handleSaveWithFiles}
              onCancel={profile ? handleBackToHall : undefined}
              onReset={handleReset}
              isPublic={isPublic}
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
              isPublic={isPublic}
              shareUrl={isPublic && profile.slug ? `${window.location.origin}/m/${profile.slug}` : undefined}
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
      <DesktopModeGate />
    </main>
  )
}

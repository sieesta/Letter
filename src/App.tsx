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
import { supabase } from './lib/supabase'
import { DesktopModeGate } from './components/DesktopModeGate'
import { AuthScreen } from './components/AuthScreen'
import { ShareScreen } from './components/ShareScreen'
import { PinScreen } from './components/PinScreen'
import {
  signOut,
  saveProfile as supabaseSaveProfile,
  loadProfileBySlug,
  updateProfile,
  uploadPhoto,
  uploadAudio,
  updatePhotos,
} from './lib/supabaseService'

type Phase = 'auth' | 'loading' | 'setup' | 'share' | 'pin' | 'threshold' | 'entering' | 'hall'

const SLUG_RE = /^\/m\/([a-z0-9-]+)(\/)?$/

export default function App() {
  const engine = useMemo(() => new MusicEngine(), [])
  const music = useMusic(engine)
  const [phase, setPhase] = useState<Phase>('auth')
  const [profile, setProfile] = useState<MuseumProfile | null>(null)
  const [volume, setVolume] = useState(() => engine.getVolume())
  const [isPublic, setIsPublic] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [shareUrl, setShareUrl] = useState<string | null>(null)

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
        setPhase('pin')
      } else {
        setPhase('setup')
      }
    } catch {
      setPhase('setup')
    }
  }, [])

  // Check for existing session on load
  useEffect(() => {
    let alive = true
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const session = data?.session ?? null
        if (session && session.access_token) {
          // Logged in — go to setup (or public view if /m/:slug)
          setPhase('setup')
          return
        }
        // No session — show auth screen (login/signup)
        if (!alive) return
        setPhase('auth')
      } catch {
        if (!alive) return
        setPhase('auth')
      }
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
    engine.arm()
    engine.ensureUnlocked?.()
    startMusic(profile)
    setPhase('entering')
  }, [engine, profile, startMusic])

  const handleShareEnter = useCallback(() => {
    if (!profile) return
    setPhase('threshold')
  }, [profile])

  const handlePinUnlock = useCallback(() => {
    if (!profile) return
    engine.arm()
    engine.ensureUnlocked?.()
    setPhase('threshold')
  }, [engine, profile])

  const handleAuthenticate = useCallback(() => {
    setPhase('setup')
  }, [])

  const handleToggleAuthMode = useCallback(() => {
    setAuthMode((prev) => (prev === 'login' ? 'signup' : 'login'))
  }, [])

  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
    } catch {
      /* ignore */
    }
    setProfile(null)
    setPhase('auth')
    setAuthMode('login')
  }, [])

  const handleSave = useCallback(
    async (next: MuseumProfile) => {
      try {
        const result = await supabaseSaveProfile({ ...next, slug: next.slug || '' })
        if (result) {
          const saved: MuseumProfile = { ...next, id: result.id, slug: result.slug, userId: '' }
          setProfile(saved)
          const url = `${window.location.origin}/m/${saved.slug}`
          setShareUrl(url)
          setPhase('share')
          return
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
        return
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
      try {
        // Save profile first to get an id
        const result = await supabaseSaveProfile({ ...next, slug: next.slug || '' })
        if (!result) return
        const profileId = result.id
        const slug = result.slug

        // Upload photos
        const uploadedPhotos: MemoryPhoto[] = []
        const dbPhotos: MemoryPhoto[] = []
        for (const file of photoFiles) {
          const uploaded = await uploadPhoto('', profileId, file)
          if (uploaded) {
            const photo: MemoryPhoto = {
              id: crypto.randomUUID(),
              src: uploaded.publicUrl,
              caption: '',
              date: '',
            }
            uploadedPhotos.push(photo)
            dbPhotos.push({ ...photo, storage_path: uploaded.path } as MemoryPhoto)
          }
        }

        // Upload audio
        let audioUrl = next.audioKey
        let audioFileName = next.audioFileName
        if (audioFile) {
          const uploaded = await uploadAudio('', profileId, audioFile)
          if (uploaded) {
            audioUrl = uploaded.publicUrl
            audioFileName = audioFile.name
          }
        }

        const finalProfile: MuseumProfile = {
          ...next,
          id: profileId,
          slug,
          userId: '',
          audioKey: audioUrl,
          audioFileName,
          photos: [...next.photos, ...uploadedPhotos],
          updatedAt: Date.now(),
        }

        // Persist photo storage paths and audio metadata to Supabase
        await updatePhotos(profileId, [...next.photos, ...dbPhotos])
        await updateProfile(profileId, {
          audioKey: audioUrl,
          audioFileName,
        })

        setProfile(finalProfile)
        const url = `${window.location.origin}/m/${finalProfile.slug}`
        setShareUrl(url)
        setPhase('share')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
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
        {phase === 'auth' ? (
          <motion.div
            key="auth"
            className="app__screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AuthScreen
              mode={authMode}
              onAuthenticate={handleAuthenticate}
              onToggleMode={handleToggleAuthMode}
            />
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
            {error ? (
              <div className="setup__error">{error}</div>
            ) : null}
            <SetupScreen
              profile={profile}
              onSave={isPublic ? undefined : handleSave}
              onSaveWithFiles={isPublic ? undefined : handleSaveWithFiles}
              onCancel={profile ? handleBackToHall : undefined}
              onReset={handleReset}
              onSignOut={handleSignOut}
              isPublic={isPublic}
            />
          </motion.div>
        ) : null}

        {phase === 'share' && profile && shareUrl ? (
          <motion.div
            key="share"
            className="app__screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ShareScreen
              profile={profile}
              shareUrl={shareUrl}
              onEnter={handleShareEnter}
              onEdit={handleEdit}
            />
          </motion.div>
        ) : null}

        {phase === 'pin' && profile ? (
          <motion.div
            key="pin"
            className="app__screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <PinScreen
              profile={profile}
              onUnlock={handlePinUnlock}
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
              onSignOut={handleSignOut}
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
            <Hallway profile={profile} onEdit={handleEdit} onReset={handleReset} onSignOut={handleSignOut} />
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

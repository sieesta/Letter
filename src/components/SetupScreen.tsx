import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { MemoryPhoto, MuseumProfile } from '../types'
import { EMPTY_PROFILE } from '../types'
import { extractVideoId } from '../lib/youtube'
import { fetchYouTubeMetadata } from '../lib/youtube'

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function dataUrlToPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

interface SetupScreenProps {
  profile: MuseumProfile | null
  onSave?: (profile: MuseumProfile) => void
  onSaveWithFiles?: (
    profile: MuseumProfile,
    photoFiles: File[],
    audioFile: File | null,
  ) => void | Promise<void>
  onCancel?: () => void
  onReset: () => void
  onSignOut?: () => void
  isPublic?: boolean
}

export function SetupScreen({
  profile,
  onSave,
  onSaveWithFiles,
  onCancel,
  onReset,
  onSignOut,
  isPublic,
}: SetupScreenProps) {
  const [draft, setDraft] = useState<MuseumProfile>(() => ({ ...EMPTY_PROFILE, ...(profile ?? {}) }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [pendingAudio, setPendingAudio] = useState<File | null>(null)
  const [ytMetadata, setYtMetadata] = useState<{ title: string; thumbnail: string } | null>(null)
  const [ytChecking, setYtChecking] = useState(false)

  const videoId = useMemo(() => extractVideoId(draft.youtubeUrl), [draft.youtubeUrl])
  const canEnter = draft.photos.length > 0 && draft.herName.trim().length > 0

  const missing: string[] = []
  if (!draft.herName.trim()) missing.push("Her name")
  if (draft.photos.length === 0) missing.push("At least one picture")

  const update = (patch: Partial<MuseumProfile>) => setDraft((current) => ({ ...current, ...patch }))

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const newPhotos: MemoryPhoto[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      try {
        const src = await dataUrlToPreview(file)
        newPhotos.push({
          id: makeId(),
          src,
          caption: '',
          date: '',
        })
      } catch {
        /* skip files that can't be read */
      }
    }
    if (newPhotos.length) {
      setDraft((current) => ({ ...current, photos: [...current.photos, ...newPhotos] }))
    }
  }

  const handleAudio = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name)) {
      setError('That file does not look like an audio file.')
      return
    }
    setPendingAudio(file)
  }

  const updatePhoto = (id: string, patch: Partial<MemoryPhoto>) => {
    setDraft((current) => ({
      ...current,
      photos: current.photos.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo)),
    }))
  }

  const movePhoto = (id: string, direction: -1 | 1) => {
    setDraft((current) => {
      const index = current.photos.findIndex((photo) => photo.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.photos.length) return current
      const photos = [...current.photos]
      const [moved] = photos.splice(index, 1)
      photos.splice(target, 0, moved)
      return { ...current, photos }
    })
  }

  const removePhoto = (id: string) => {
    setDraft((current) => ({ ...current, photos: current.photos.filter((photo) => photo.id !== id) }))
  }

  const checkYouTube = async () => {
    if (!videoId) {
      setYtMetadata(null)
      return
    }
    setYtChecking(true)
    try {
      const meta = await fetchYouTubeMetadata(videoId)
      setYtMetadata(meta)
    } catch {
      setYtMetadata(null)
    } finally {
      setYtChecking(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (missing.length > 0) {
      setError('Please add: ' + missing.join(', '))
      return
    }

    if (onSaveWithFiles) {
      const photoFiles: File[] = []
      setBusy(true)
      try {
        await onSaveWithFiles(draft, photoFiles, pendingAudio)
        setPendingAudio(null)
        return
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed. Please try again.')
      } finally {
        setBusy(false)
      }
      return
    }

    if (onSave) {
      onSave({ ...draft, updatedAt: Date.now() })
      return
    }
  }

  const handleGenerateSlug = () => {
    const slug = draft.herName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'memory-lane'
    update({ slug })
  }

  const handleYtChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    update({ youtubeUrl: event.target.value })
    void checkYouTube()
  }

  return (
    <div className="setup">
      <motion.form
        className="setup__panel"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="setup__head">
          <h1 className="setup__title">Build the hallway</h1>
          <p className="setup__sub">
            Add the pictures, the words and the song. Everything stays on your device — nothing is uploaded.
          </p>
          {onSignOut ? (
            <button type="button" className="setup__ghostButton setup__ghostButton--quiet" onClick={onSignOut} style={{ marginTop: 1 }}>
              Sign out
            </button>
          ) : null}
        </header>

        <section className="setup__section">
          <h3 className="setup__sectionTitle">The pair of you</h3>
          <div className="setup__grid">
            <label className="setup__field">
              <span>Her name</span>
              <input
                type="text"
                value={draft.herName}
                onChange={(event) => update({ herName: event.target.value })}
                placeholder="Maya"
              />
            </label>
            <label className="setup__field">
              <span>Title of the hall</span>
              <input
                type="text"
                value={draft.hallTitle}
                onChange={(event) => update({ hallTitle: event.target.value })}
                placeholder="A Hallway of Us"
              />
            </label>
            {!isPublic && (
              <>
                <label className="setup__field">
                  <span>Share link (slug)</span>
                  <div className="setup__slugRow">
                    <input
                      type="text"
                      value={draft.slug}
                      onChange={(event) => update({ slug: event.target.value })}
                      placeholder="memory-lane-maya"
                    />
                    <button
                      type="button"
                      className="setup__ghostButton"
                      onClick={handleGenerateSlug}
                    >
                      Generate
                    </button>
                  </div>
                </label>
                <label className="setup__field">
                  <span>4-digit PIN (your girlfriend will enter this)</span>
                  <input
                    type="text"
                    value={draft.pin}
                    maxLength={4}
                    onChange={(event) => update({ pin: event.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="1234"
                  />
                </label>
              </>
            )}
          </div>
        </section>

        <section className="setup__section">
          <h3 className="setup__sectionTitle">The message</h3>
          <label className="setup__field">
            <span>Read out loud at the end of the hall</span>
            <textarea
              rows={4}
              value={draft.message}
              onChange={(event) => update({ message: event.target.value })}
              placeholder="Every corridor we walked through led back to this one…"
            />
          </label>
        </section>

        <section className="setup__section">
          <h3 className="setup__sectionTitle">
            The pictures
            <span className="setup__count">{draft.photos.length}</span>
          </h3>

          <div
            className="setup__drop"
            onDragEnter={(event) => {
              event.preventDefault()
              dragDepth.current += 1
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => {
              dragDepth.current = Math.max(0, dragDepth.current - 1)
            }}
            onDrop={(event) => {
              event.preventDefault()
              dragDepth.current = 0
              void addFiles(event.dataTransfer.files)
            }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') fileRef.current?.click()
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => void addFiles(event.target.files)}
            />
            <strong>Drop pictures here</strong>
            <span>or click to choose · JPG, PNG, HEIC</span>
          </div>

          <ul className="setup__photos">
            <AnimatePresence initial={false}>
              {draft.photos.map((photo, index) => (
                <motion.li
                  key={photo.id}
                  className="setup__photo"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.32 }}
                >
                  <img src={photo.src} alt="" className="setup__photoThumb" />
                  <div className="setup__photoFields">
                    <input
                      type="text"
                      value={photo.caption}
                      onChange={(event) => updatePhoto(photo.id, { caption: event.target.value })}
                      placeholder="Caption for this memory"
                    />
                    <input
                      type="text"
                      value={photo.date}
                      onChange={(event) => updatePhoto(photo.id, { date: event.target.value })}
                      placeholder="Date (optional)"
                    />
                  </div>
                  <div className="setup__photoTools">
                    <button type="button" onClick={() => movePhoto(photo.id, -1)} disabled={index === 0} aria-label="Move earlier">
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(photo.id, 1)}
                      disabled={index === draft.photos.length - 1}
                      aria-label="Move later"
                    >
                      ↓
                    </button>
                    <button type="button" onClick={() => removePhoto(photo.id)} aria-label="Remove picture">
                      ✕
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>

        <section className="setup__section">
          <h3 className="setup__sectionTitle">The song</h3>
          <label className="setup__field">
            <span>YouTube link — it plays the moment she walks in</span>
            <input
              type="text"
              value={draft.youtubeUrl}
              onChange={handleYtChange}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </label>
          {ytChecking ? (
            <p className="setup__note">Looking up song…</p>
          ) : ytMetadata ? (
            <div className="setup__ytPreview">
              <img
                src={ytMetadata.thumbnail}
                alt=""
                className="setup__ytThumb"
              />
              <div>
                <strong>Song found:</strong> {ytMetadata.title}
              </div>
            </div>
          ) : videoId ? (
            <p className="setup__ok">Song found · id {videoId}</p>
          ) : null}

          <div className="setup__or">
            <span>or</span>
          </div>

          <div className="setup__fileRow">
            <button type="button" className="setup__ghostButton" onClick={() => audioRef.current?.click()}>
              {draft.audioFileName ? `Replace · ${draft.audioFileName}` : 'Use an audio file instead'}
            </button>
            <input
              ref={audioRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(event) => void handleAudio(event.target.files)}
            />
            {draft.audioFileName ? (
              <button
                type="button"
                className="setup__ghostButton setup__ghostButton--quiet"
                onClick={() => update({ audioKey: '', audioFileName: '' })}
              >
                remove
              </button>
            ) : null}
            {pendingAudio && (
              <span style={{ fontSize: 0.78, color: '#f0a95e' }}>
                {pendingAudio.name} · ready to upload
              </span>
            )}
          </div>
          <p className="setup__note">
            The song is stored and played from your link. It plays the moment she walks in.
          </p>
        </section>

        <section className="setup__section">
          <h3 className="setup__sectionTitle">The last step</h3>
          <label className="setup__field">
            <span>A link to open at the very end (optional)</span>
            <input
              type="text"
              value={draft.formLink}
              onChange={(event) => update({ formLink: event.target.value })}
              placeholder="https://…"
            />
          </label>
        </section>

        {error ? <p className="setup__error">{error}</p> : null}
        {busy ? <p className="setup__note">Saving…</p> : null}

        <footer className="setup__foot">
          {profile && onCancel ? (
            <button type="button" className="setup__ghostButton" onClick={onCancel}>
              Back to the hall
            </button>
          ) : null}
          <button type="button" className="setup__ghostButton setup__ghostButton--quiet" onClick={onReset}>
            Start over
          </button>
          <button type="submit" className="setup__submit" disabled={!canEnter || busy}>
            {canEnter ? 'Save and get link' : 'Add a name and a picture'}
          </button>
        </footer>
      </motion.form>
    </div>
  )
}

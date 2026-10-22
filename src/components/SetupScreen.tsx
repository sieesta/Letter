import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { MemoryPhoto, MuseumProfile } from '../types'
import { EMPTY_PROFILE } from '../types'
import { extractVideoId } from '../lib/youtube'
import { readFileAsBlob, readImageAsDataUrl } from '../lib/image'
import { putTrack } from '../lib/idb'

interface SetupScreenProps {
  profile: MuseumProfile | null
  onSave: (profile: MuseumProfile) => void
  onCancel?: () => void
  onReset: () => void
}

const AUDIO_KEY = 'file:upload'

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function SetupScreen({ profile, onSave, onCancel, onReset }: SetupScreenProps) {
  const [draft, setDraft] = useState<MuseumProfile>(() => ({ ...EMPTY_PROFILE, ...(profile ?? {}) }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  const videoId = useMemo(() => extractVideoId(draft.youtubeUrl), [draft.youtubeUrl])
  const canEnter = draft.photos.length > 0 && draft.herName.trim().length > 0

  const update = (patch: Partial<MuseumProfile>) => setDraft((current) => ({ ...current, ...patch }))

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const next: MemoryPhoto[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const src = await readImageAsDataUrl(file)
        next.push({ id: makeId(), src, caption: '', date: '' })
      }
      if (next.length) {
        setDraft((current) => ({ ...current, photos: [...current.photos, ...next] }))
      }
    } catch {
      setError('One of those images could not be read.')
    } finally {
      setBusy(false)
    }
  }

  const handleAudio = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name)) {
      setError('That file does not look like an audio file.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const blob = await readFileAsBlob(file)
      await putTrack({
        videoId: AUDIO_KEY,
        title: file.name,
        mimeType: blob.type || 'audio/mpeg',
        duration: 0,
        blob,
        bytes: blob.size,
        totalBytes: blob.size,
        complete: true,
        updatedAt: Date.now(),
      })
      update({ audioKey: AUDIO_KEY, audioFileName: file.name })
    } catch {
      setError('That audio file could not be stored.')
    } finally {
      setBusy(false)
    }
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canEnter) return
    onSave({ ...draft, updatedAt: Date.now() })
  }

  return (
    <div className="setup">
      <motion.aside
        className="setup__poster"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="setup__posterGlow" />
        <span className="setup__eyebrow">Memory Lane</span>
        <h2 className="setup__posterTitle">{draft.hallTitle || 'A Hallway of Us'}</h2>
        <p className="setup__posterText">
          {draft.message || 'Every picture you add becomes a print hanging on a string, waiting down the hall.'}
        </p>
        <div className="setup__strip">
          {draft.photos.length ? (
            draft.photos.slice(0, 4).map((photo, index) => (
              <motion.img
                key={photo.id}
                src={photo.src}
                alt=""
                initial={{ opacity: 0, y: 18, rotate: (index - 1.5) * 4 }}
                animate={{ opacity: 1, y: 0, rotate: (index - 1.5) * 4 }}
                transition={{ delay: 0.15 * index, duration: 0.7 }}
              />
            ))
          ) : (
            <div className="setup__stripEmpty">Your prints will hang here</div>
          )}
        </div>
        <span className="setup__posterFoot">
          {draft.photos.length} {draft.photos.length === 1 ? 'print' : 'prints'} · a song that plays on arrival
        </span>
      </motion.aside>

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
            Add the pictures, the words and the song. Everything stays on this device — nothing is uploaded.
          </p>
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
              onChange={(event) => update({ youtubeUrl: event.target.value })}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </label>
          {videoId ? <p className="setup__ok">Song found · id {videoId}</p> : null}

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
          </div>
          <p className="setup__note">
            The song is fetched once and kept on this device, so every later visit starts playing immediately.
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
        {busy ? <p className="setup__note">Working…</p> : null}

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
            {canEnter ? 'Enter the hallway' : 'Add a name and a picture'}
          </button>
        </footer>
      </motion.form>
    </div>
  )
}

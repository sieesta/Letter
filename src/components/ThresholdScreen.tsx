import { motion } from 'framer-motion'
import type { MuseumProfile } from '../types'

interface ThresholdScreenProps {
  profile: MuseumProfile
  onEnter: () => void
  onEdit: () => void
  onReset: () => void
}

/** The doorway of the experience: one button, then the hall opens. */
export function ThresholdScreen({ profile, onEnter, onEdit, onReset }: ThresholdScreenProps) {
  const preview = profile.photos.slice(0, 5)

  return (
    <div className="threshold">
      <div className="threshold__backdrop" />
      <div className="threshold__glow" />

      <motion.div
        className="threshold__inner"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.span
          className="threshold__eyebrow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          {profile.herName ? `Something I made for ${profile.herName}` : 'Something I made for you'}
        </motion.span>

        <motion.h1
          className="threshold__title"
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.3, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {profile.hallTitle || 'A Hallway of Us'}
        </motion.h1>

        <motion.p
          className="threshold__text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.9 }}
        >
          {profile.photos.length} prints are hanging on strings down the hall. Walk in and the song starts.
        </motion.p>

        {preview.length ? (
          <motion.div
            className="threshold__strip"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 1 }}
          >
            {preview.map((photo, index) => (
              <motion.img
                key={photo.id}
                src={photo.src}
                alt=""
                initial={{ opacity: 0, y: 26, rotate: (index - (preview.length - 1) / 2) * 5 }}
                animate={{ opacity: 1, y: 0, rotate: (index - (preview.length - 1) / 2) * 5 }}
                transition={{ delay: 0.75 + index * 0.09, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
          </motion.div>
        ) : null}

        <motion.div
          className="threshold__actions"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
        >
          <button type="button" className="threshold__enter" onClick={onEnter}>
            Walk in
          </button>
          <button type="button" className="threshold__link" onClick={onEdit}>
            Edit the memories
          </button>
          <button type="button" className="threshold__link threshold__link--quiet" onClick={onReset}>
            Start over
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}

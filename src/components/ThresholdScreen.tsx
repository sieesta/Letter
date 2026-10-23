import { motion } from 'framer-motion'
import type { MuseumProfile } from '../types'

interface ThresholdScreenProps {
  profile: MuseumProfile
  onEnter: () => void
  onEdit: () => void
  onReset: () => void
  onSignOut?: () => void
  isPublic?: boolean
  shareUrl?: string
}

/** The doorway of the experience: one button, then the hall opens. */
export function ThresholdScreen({ profile, onEnter, onEdit, onReset, onSignOut, isPublic, shareUrl }: ThresholdScreenProps) {
  const preview = profile.photos.slice(0, 5)

  return (
    <div className="threshold">
      <div className="threshold__backdrop" />
      <div className="threshold__glow" />
      <div className="threshold__sparkles" aria-hidden="true">
        {[...Array(12)].map((_, i) => (
          <motion.span
            key={i}
            className="threshold__sparkle"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0, 1, 0], 
              scale: [0, 1, 0],
              x: [0, (Math.random() - 0.5) * 100],
              y: [0, (Math.random() - 0.5) * 100]
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut"
            }}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

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
                animate={{ 
                  opacity: 1, 
                  y: [0, -8, 0], 
                  rotate: [(index - (preview.length - 1) / 2) * 5, (index - (preview.length - 1) / 2) * 5 + 2, (index - (preview.length - 1) / 2) * 5] 
                }}
                transition={{ 
                  opacity: { delay: 0.75 + index * 0.09, duration: 0.85, ease: [0.22, 1, 0.36, 1] },
                  y: { delay: 1.5 + index * 0.1, duration: 3, repeat: Infinity, ease: "easeInOut" },
                  rotate: { delay: 1.5 + index * 0.1, duration: 4, repeat: Infinity, ease: "easeInOut" }
                }}
              />
            ))}
          </motion.div>
        ) : null}

        {isPublic && shareUrl ? (
          <motion.div
            className="threshold__share"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            <span className="threshold__eyebrow">Share this hallway</span>
            <div className="threshold__shareRow">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="threshold__shareInput"
              />
              <button type="button" className="threshold__copy" onClick={() => copyUrl(shareUrl)}>
                Copy
              </button>
            </div>
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
          {!isPublic && (
            <>
              <button type="button" className="threshold__link" onClick={onEdit}>
                Edit the memories
              </button>
              <button type="button" className="threshold__link threshold__link--quiet" onClick={onReset}>
                Start over
              </button>
              {onSignOut && (
                <button type="button" className="threshold__link threshold__link--quiet" onClick={onSignOut}>
                  Sign out
                </button>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}

function copyUrl(url: string) {
  navigator.clipboard.writeText(url).catch(() => {
    /* clipboard may not be available */
  })
}

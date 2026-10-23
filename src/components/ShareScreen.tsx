import { useState } from 'react'
import { motion } from 'framer-motion'
import type { MuseumProfile } from '../types'

interface ShareScreenProps {
  profile: MuseumProfile
  shareUrl: string
  onEnter: () => void
  onEdit: () => void
}

export function ShareScreen({ profile, shareUrl, onEnter, onEdit }: ShareScreenProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl).catch(() => {
      /* clipboard may not be available */
    })
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      className="share"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="share__card">
        <motion.div
          className="share__glow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
        <span className="share__eyebrow">Your hallway is ready</span>
        <h1 className="share__title">
          {profile.hallTitle || 'A Hallway of Us'}
        </h1>
        <p className="share__subtitle">
          Send this link to your special someone. They will need the 4-digit PIN you set to enter.
        </p>

        <div className="share__linkRow">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="share__linkInput"
          />
          <button type="button" className="share__copy" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        <div className="share__actions">
          <button type="button" className="share__enter" onClick={onEnter}>
            Walk in
          </button>
          <button type="button" className="share__edit" onClick={onEdit}>
            Edit the memories
          </button>
        </div>

        <p className="share__pin">
          PIN: <strong>{profile.pin}</strong>
        </p>
      </div>
    </motion.div>
  )
}

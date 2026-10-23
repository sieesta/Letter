import { useState } from 'react'
import { motion } from 'framer-motion'
import type { MuseumProfile } from '../types'

interface PinScreenProps {
  profile: MuseumProfile
  onUnlock: () => void
}

export function PinScreen({ profile, onUnlock }: PinScreenProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const correctPin = profile.pin || ''

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && pin.length === 4) {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError(true)
      return
    }
    setBusy(true)
    if (pin === correctPin) {
      window.setTimeout(() => {
        setBusy(false)
        onUnlock()
      }, 600)
    } else {
      setError(true)
      setPin('')
      window.setTimeout(() => setError(false), 400)
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="pin"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="pin__card">
        <motion.div
          className="pin__glow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
        <span className="pin__eyebrow">Memory Lane</span>
        <h1 className="pin__title">Enter the PIN</h1>
        <p className="pin__subtitle">
          {profile.herName ? `A hallway for ${profile.herName}` : 'A hallway for you'}
        </p>

        <div className="pin__dots">
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className={`pin__dot${i < pin.length ? ' is-filled' : ''}${error ? ' is-error' : ''}`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
            />
          ))}
        </div>

        <input
          type="text"
          value={pin}
          onChange={(event) => {
            const value = event.target.value.replace(/\D/g, '').slice(0, 4)
            setPin(value)
          }}
          maxLength={4}
          onKeyDown={handleKeyDown}
          autoFocus
          className="pin__input"
          placeholder="····"
        />

        {error ? <p className="pin__error">Incorrect PIN. Try again.</p> : null}

        <button
          type="button"
          className="pin__enter"
          disabled={pin.length !== 4 || busy}
          onClick={handleSubmit}
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </div>
    </motion.div>
  )
}

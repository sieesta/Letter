import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RoomShell } from '../ui'

interface FinaleRoomProps {
  name: string
  message: string
  onReset: () => void
}

interface Confetti {
  id: number
  x: number
  delay: number
  rotation: number
  emoji: string
  hue: string
}

const EMOJIS = ['💖', '✨', '🌹', '💕', '🎉', '💫']

export function FinaleRoom({ name, message, onReset }: FinaleRoomProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [confetti, setConfetti] = useState<Confetti[]>([])

  useEffect(() => {
    if (!unlocked) return
    const items: Confetti[] = Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.9,
      rotation: Math.random() * 360,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      hue: `hsl(${340 + Math.random() * 40}, ${70 + Math.random() * 20}%, ${60 + Math.random() * 15}%)`,
    }))
    setConfetti(items)
    const t = setTimeout(() => setConfetti([]), 4200)
    return () => clearTimeout(t)
  }, [unlocked])

  return (
    <RoomShell
      eyebrow="Room 06 — The End (And The Beginning)"
      title="One Last Thing"
      subtitle="You found every room. What's left is the part I actually wanted to say."
      backdrop="bg-gradient-to-br from-wine-100 via-ember-50 to-rose-100"
      accent="text-wine-700"
      footer={
        unlocked && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onReset}
              className="px-6 py-3 rounded-full bg-white/80 text-dusk-800 font-medium hover:bg-white transition-colors"
            >
              ↺ Start over
            </button>
            <a
              href="#date"
              className="px-6 py-3 rounded-full bg-gradient-to-r from-ember-500 to-wine-500 text-white font-medium shadow-glow-ember"
            >
              Pick our next date ↓
            </a>
          </div>
        )
      }
    >
      {/* Confetti */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {confetti.map((c) => (
          <motion.span
            key={c.id}
            initial={{ y: -40, opacity: 0, rotate: 0, scale: 0.6 }}
            animate={{ y: '105vh', opacity: [0, 1, 1, 0], rotate: c.rotation, scale: 1 }}
            transition={{ duration: 3.4, delay: c.delay, ease: 'easeIn' }}
            style={{ left: `${c.x}%`, color: c.hue }}
            className="absolute text-2xl"
          >
            {c.emoji}
          </motion.span>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!unlocked ? (
          /* ---------- Locked state ---------- */
          <motion.div
            key="locked"
            exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center text-center py-8"
          >
            {/* Sealed envelope */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="relative text-8xl mb-8"
            >
              💌
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-4 -right-6 text-3xl"
              >
                ✨
              </motion.span>
            </motion.div>

            <p className="font-serif text-lg text-dusk-700 max-w-md leading-relaxed mb-8">
              You made it through every room. This last one I kept locked, just for you.
            </p>

            <motion.button
              type="button"
              onClick={() => setUnlocked(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-9 py-4 rounded-full bg-gradient-to-r from-ember-500 to-wine-500 text-white font-medium shadow-glow-ember text-lg"
            >
              Open the letter
            </motion.button>
          </motion.div>
        ) : (
          /* ---------- Unlocked state ---------- */
          <motion.div
            key="unlocked"
            initial={{ opacity: 0, scale: 0.92, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, type: 'spring', stiffness: 90, damping: 16 }}
            className="flex flex-col items-center text-center"
          >
            {/* Morphing heart core */}
            <div className="relative mb-8 grid place-items-center h-40 w-40">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle, rgba(249,111,43,${0.5 - i * 0.14}) 0%, transparent 70%)`,
                  }}
                  animate={{ scale: [1, 1.18, 1], opacity: [0.7, 0.35, 0.7] }}
                  transition={{ duration: 3.2, repeat: Infinity, delay: i * 0.5, ease: 'easeInOut' }}
                />
              ))}
              <motion.div
                animate={{
                  scale: [1, 1.08, 0.96, 1],
                  rotate: [0, 4, -4, 0],
                }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                className="text-7xl relative"
              >
                ❤️
              </motion.div>
            </div>

            <motion.h3
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="font-display text-3xl sm:text-4xl text-dusk-900 mb-5"
            >
              {name}, it was always you.
            </motion.h3>

            <motion.blockquote
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="font-serif italic text-lg sm:text-xl text-dusk-700 max-w-xl leading-relaxed mb-10"
            >
              &ldquo;{message}&rdquo;
            </motion.blockquote>

            {/* Date picker — real-world next step */}
            <motion.div
              id="date"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="w-full max-w-md rounded-3xl bg-white/80 backdrop-blur border border-white/80 p-6 shadow-card-lift"
            >
              <p className="text-[0.7rem] uppercase tracking-[0.3em] text-wine-600 mb-2">
                The next chapter
              </p>
              <p className="text-dusk-800 mb-5">When should we go on our next adventure?</p>

              <input
                type="date"
                className="w-full px-4 py-3 rounded-xl border-2 border-dusk-200 focus:border-ember-400 focus:outline-none focus:ring-4 focus:ring-ember-100 transition mb-4"
              />
              <input
                type="text"
                placeholder="Where should we go?"
                className="w-full px-4 py-3 rounded-xl border-2 border-dusk-200 focus:border-ember-400 focus:outline-none focus:ring-4 focus:ring-ember-100 transition"
              />

              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="mt-5 text-sm text-dusk-500"
              >
                I'll make it happen. 💌
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </RoomShell>
  )
}

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RoomShell } from '../ui'

interface LivingRoomRoomProps {
  name: string
  onComplete: () => void
}

const MEMORIES = [
  {
    tag: 'Where we always ended up',
    text: 'The couch nobody else wanted. Blankets, bad movie, your head on my shoulder. I never once wanted to move.',
  },
  {
    tag: 'The sound of you laughing',
    text: 'Loud enough to make the neighbours think something good was happening. It was.',
  },
  {
    tag: 'A quiet Tuesday',
    text: 'Nothing happened. That was the best part — you, the TV, and nowhere to be.',
  },
]

export function LivingRoomRoom({ name, onComplete }: LivingRoomRoomProps) {
  const [found, setFound] = useState<number | null>(null)

  return (
    <RoomShell
      eyebrow="Room 02 — Where We Sat"
      title="The Living Room"
      subtitle="Three memories live in this room. Find them all."
      backdrop="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100"
      accent="text-amber-700"
      footer={
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm text-dusk-600">
            {found === null ? '0' : found + 1} / {MEMORIES.length} found
          </span>
          <button
            type="button"
            onClick={onComplete}
            className="px-6 py-3 rounded-full bg-dusk-900 text-white font-medium hover:bg-dusk-800 transition-colors"
          >
            Next room →
          </button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {MEMORIES.map((m, i) => {
          const isFound = found === i
          const isOpen = found !== null && i <= found
          return (
            <motion.button
              key={m.tag}
              type="button"
              onClick={() => setFound(i)}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.97 }}
              className={`relative text-left rounded-2xl p-5 min-h-[11rem] overflow-hidden border transition-colors duration-500 ${
                isOpen
                  ? 'bg-white/85 border-amber-300 shadow-card-lift'
                  : 'bg-white/40 border-white/60 hover:bg-white/60'
              }`}
            >
              {/* Cover */}
              <AnimatePresence>
                {!isOpen && (
                  <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, rotateX: -90 }}
                    transition={{ duration: 0.5 }}
                    style={{ transformOrigin: 'top' }}
                    className="absolute inset-0 bg-gradient-to-br from-dusk-800 to-dusk-900 flex flex-col items-center justify-center gap-2 text-center px-4"
                  >
                    <motion.span
                      animate={{ scale: [1, 1.12, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                      className="text-3xl"
                    >
                      🕰️
                    </motion.span>
                    <span className="text-[0.7rem] uppercase tracking-[0.25em] text-dusk-300">
                      Tap to reveal
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                animate={{ opacity: isOpen ? 1 : 0 }}
                transition={{ delay: isOpen ? 0.25 : 0 }}
              >
                <p className="text-[0.7rem] uppercase tracking-[0.25em] text-amber-700 mb-2">
                  {m.tag}
                </p>
                <p className="font-serif text-dusk-800 leading-relaxed">{m.text}</p>
              </motion.div>

              {isFound && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-amber-500 text-white text-sm grid place-items-center"
                >
                  ✓
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>
    </RoomShell>
  )
}

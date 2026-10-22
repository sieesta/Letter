import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RoomShell } from '../ui'

interface BedroomRoomProps {
  name: string
  onComplete: () => void
}

const HUGS = [
  { count: 1, line: 'One hug, on a normal Tuesday.', icon: '🤗' },
  { count: 3, line: 'Three hugs, because you asked nicely.', icon: '🫂' },
  { count: 7, line: 'Seven hugs — now that is our number.', icon: '💞' },
  { count: 12, line: 'Twelve. You counted them yourself.', icon: '💗' },
]

export function BedroomRoom({ name, onComplete }: BedroomRoomProps) {
  const [hugs, setHugs] = useState(0)
  const max = HUGS[HUGS.length - 1].count

  return (
    <RoomShell
      eyebrow="Room 04 — Pillow Talk"
      title="The Bedroom"
      subtitle="How many hugs did we get to keep? Tap the bear to count them out."
      backdrop="bg-gradient-to-br from-purple-50 via-pink-50 to-rose-100"
      accent="text-purple-700"
      footer={
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm text-dusk-600">{hugs} / {max} hugs</span>
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
      <div className="flex flex-col items-center gap-8">
        {/* Teddy */}
        <motion.button
          type="button"
          onClick={() => setHugs((h) => Math.min(h + 1, max))}
          whileHover={{ scale: 1.06, rotate: -3 }}
          whileTap={{ scale: 0.94 }}
          animate={{ rotate: hugs % 2 === 0 ? 0 : 2 }}
          className="text-8xl relative"
        >
          🧸
          <AnimatePresence>
            {hugs > 0 && (
              <motion.span
                key={hugs}
                initial={{ scale: 0, y: -20, opacity: 0 }}
                animate={{ scale: 1, y: -30, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                className="absolute -top-2 -right-6 text-3xl"
              >
                💕
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Hug meter */}
        <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
          {Array.from({ length: max }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: i < hugs ? 1 : 0.35, opacity: i < hugs ? 1 : 0.25 }}
              transition={{ delay: i * 0.015, type: 'spring', stiffness: 220, damping: 14 }}
              className="w-5 h-5 rounded-full bg-gradient-to-br from-wine-400 to-wine-600"
            />
          ))}
        </div>

        {/* Milestone messages */}
        <div className="h-16 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {hugs > 0 && (
              <motion.p
                key={hugs}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.96 }}
                transition={{ duration: 0.35 }}
                className="font-serif text-lg text-purple-900 text-center"
              >
                {HUGS.filter((h) => h.count <= hugs).slice(-1)[0].line}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <p className="text-sm text-dusk-500 text-center">
          Some people count days. We counted hugs, {name}.
        </p>
      </div>
    </RoomShell>
  )
}

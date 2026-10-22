import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RoomShell } from '../ui'

interface GarageRoomProps {
  name: string
  onComplete: () => void
}

const STOPS = [
  {
    place: 'The coast',
    detail: 'Salt in the air, sand in the car, windows down the whole way.',
    emoji: '🌊',
  },
  {
    place: 'The mountain road',
    detail: 'You picked the music. We took the long way, and neither of us minded.',
    emoji: '⛰️',
  },
  {
    place: 'Home',
    detail: 'Same car, same song, better coffee waiting at the end.',
    emoji: '🏡',
  },
]

export function GarageRoom({ name, onComplete }: GarageRoomProps) {
  const [stop, setStop] = useState(0)
  const [driving, setDriving] = useState(false)

  return (
    <RoomShell
      eyebrow="Room 05 — The Long Way Round"
      title="The Garage"
      subtitle="Three stops on a trip we never wanted to end. Pick a destination."
      backdrop="bg-gradient-to-br from-emerald-50 via-sky-50 to-slate-100"
      accent="text-emerald-700"
      footer={
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setDriving(true)
              setTimeout(onComplete, 800)
            }}
            className="px-6 py-3 rounded-full bg-dusk-900 text-white font-medium hover:bg-dusk-800 transition-colors"
          >
            {driving ? 'Arriving…' : 'Final room →'}
          </button>
        </div>
      }
    >
      <div className="relative">
        {/* Road */}
        <div className="relative h-2 rounded-full bg-dusk-200/70 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 w-24 rounded-full bg-gradient-to-r from-transparent via-ember-400 to-transparent"
            animate={{ x: driving ? ['-10rem', '40rem'] : ['-10rem', '-10rem'] }}
            transition={{ duration: 2.2, repeat: driving ? Infinity : 0, ease: 'linear' }}
          />
        </div>

        {/* Stop markers */}
        <div className="grid grid-cols-3 gap-2 mt-6">
          {STOPS.map((s, i) => (
            <button
              key={s.place}
              type="button"
              onClick={() => setStop(i)}
              className="group flex flex-col items-center gap-2 text-center"
            >
              <motion.span
                animate={{
                  scale: stop === i ? 1.15 : 1,
                  y: stop === i ? -4 : 0,
                }}
                transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                className={`w-12 h-12 rounded-full grid place-items-center text-2xl border-2 transition-colors ${
                  stop === i
                    ? 'bg-white border-ember-400 shadow-glow-ember'
                    : 'bg-white/60 border-dusk-200 group-hover:bg-white'
                }`}
              >
                {s.emoji}
              </motion.span>
              <span
                className={`text-xs sm:text-sm font-medium transition-colors ${
                  stop === i ? 'text-dusk-900' : 'text-dusk-500'
                }`}
              >
                {s.place}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={stop}
            initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
            transition={{ duration: 0.45 }}
            className="mt-8 rounded-2xl bg-white/70 backdrop-blur border border-white/70 p-6"
          >
            <p className="font-serif text-lg text-dusk-800 leading-relaxed">{STOPS[stop].detail}</p>
            <p className="mt-3 text-sm text-dusk-500">
              Distance covered together: immeasurable, {name}.
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </RoomShell>
  )
}

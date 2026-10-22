import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RoomShell } from '../ui'

interface KitchenRoomProps {
  name: string
  onComplete: () => void
}

const STEPS = [
  {
    label: 'Brew',
    icon: '☕',
    line: 'Every morning started with the sound of the grinder.',
  },
  {
    label: 'Pour',
    icon: '🥛',
    line: 'Two mugs. Yours first, even though mine was ready.',
  },
  {
    label: 'Sip',
    icon: '🌤️',
    line: 'Across the table, you smiled before the first sip. That was my whole morning.',
  },
]

export function KitchenRoom({ name, onComplete }: KitchenRoomProps) {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)

  return (
    <RoomShell
      eyebrow="Room 03 — First Coffee"
      title="The Kitchen"
      subtitle="Three small steps, one big memory. Walk through the ritual."
      backdrop="bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100"
      accent="text-orange-700"
      footer={
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setDone(true)
              setTimeout(onComplete, 700)
            }}
            className="px-6 py-3 rounded-full bg-dusk-900 text-white font-medium hover:bg-dusk-800 transition-colors"
          >
            {done ? 'Lovely…' : 'Next room →'}
          </button>
        </div>
      }
    >
      <div className="grid gap-6 sm:grid-cols-[auto,1fr] sm:items-center">
        {/* Cup */}
        <div className="relative mx-auto sm:mx-0 h-44 w-44 grid place-items-center">
          <motion.div
            animate={{ rotate: step === 2 ? [0, 3, -3, 0] : 0 }}
            transition={{ duration: 0.6 }}
            className="relative text-8xl"
          >
            {STEPS[step].icon}
          </motion.div>

          {/* Steam */}
          <AnimatePresence>
            {step >= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: -34 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
                className="absolute -top-2 text-2xl"
              >
                ☁️
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ring progress */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1.5" />
            <motion.circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="#f96f2b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="289"
              animate={{ strokeDashoffset: 289 - (289 * (step + 1)) / STEPS.length }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </svg>
        </div>

        {/* Steps */}
        <div>
          <div className="flex gap-2 mb-6">
            {STEPS.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setStep(i)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  i === step
                    ? 'bg-orange-500 text-white shadow-glow-ember'
                    : i < step
                      ? 'bg-orange-200/70 text-orange-900'
                      : 'bg-white/60 text-dusk-600 hover:bg-white/90'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
              transition={{ duration: 0.45 }}
              className="font-serif text-lg text-dusk-800 leading-relaxed min-h-[3.5rem]"
            >
              {STEPS[step].line}
            </motion.p>
          </AnimatePresence>

          <p className="mt-4 text-sm text-dusk-500">
            {name}, you still take it exactly the way I remember.
          </p>
        </div>
      </div>
    </RoomShell>
  )
}

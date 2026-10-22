import { motion } from 'framer-motion'
import { Button } from '../ui'

interface IntroStepProps {
  name: string
  message: string
  photo: string | null
  onStart: () => void
}

export function IntroStep({ name, message, photo, onStart }: IntroStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-2xl mx-auto text-center h-screen flex flex-col items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8, type: 'spring', stiffness: 120, damping: 15 }}
        className="mb-8"
      >
        {photo ? (
          <img
            src={photo}
            alt={name}
            className="w-40 h-40 sm:w-48 sm:h-48 rounded-full object-cover mx-auto border-4 border-ember-200 shadow-2xl"
          />
        ) : (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-8xl sm:text-9xl"
          >
            💕
          </motion.div>
        )}
      </motion.div>

      <motion.h1
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="text-4xl sm:text-5xl md:text-6xl font-display text-dusk-900 mb-6 tracking-tight"
      >
        Hi <span className="text-ember-500">{name}</span>...
      </motion.h1>

      <motion.p
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="text-lg sm:text-xl text-dusk-700 mb-10 max-w-md mx-auto leading-relaxed font-serif italic"
      >
        &ldquo;{message}&rdquo;
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      >
        <Button onClick={onStart} size="lg" className="px-10 py-4 text-lg">
          <span className="flex items-center gap-3">
            <span className="text-2xl">🗝️</span>
            Start The Hunt
            <motion.span
              animate={{ x: [0, 6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              →
            </motion.span>
          </span>
        </Button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="mt-8 text-dusk-500 text-sm"
      >
        Six rooms. Six memories. One love story. 💫
      </motion.p>
    </motion.div>
  )
}
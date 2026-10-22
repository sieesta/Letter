import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface SplashScreenProps {
  onEnter: () => void
}

/**
 * The very first thing seen: a heart drawn line by line, then the title,
 * then an invitation to walk in. A tap (or the animation finishing) hands
 * off to the loading phase so audio can be unlocked by the same gesture.
 */
export function SplashScreen({ onEnter }: SplashScreenProps) {
  const [entered, setEntered] = useState(false)

  const handleEnter = useCallback(() => {
    if (entered) return
    setEntered(true)
    onEnter()
  }, [entered, onEnter])

  return (
    <AnimatePresence>
      {!entered ? (
        <motion.div
          key="splash"
          className="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={handleEnter}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') handleEnter()
          }}
          role="button"
          tabIndex={0}
          aria-label="Enter Memory Lane"
        >
          <div className="splash__glow" aria-hidden="true" />
          <div className="splash__heart">
            <svg viewBox="0 0 100 104" aria-hidden="true" focusable="false">
              <motion.path
                className="splash__heart-line"
                d="M50,82 C50,82 50,22 67,22 C84,22 84,82 84,82 C84,96 64,100 50,100 C36,100 16,96 16,82 C16,22 50,22 50,82Z"
                fill="none"
                stroke="url(#splashHeartGradient)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
              />
              <defs>
                <linearGradient id="splashHeartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f96f2b" />
                  <stop offset="50%" stopColor="#dc5c6d" />
                  <stop offset="100%" stopColor="#a52f45" />
                </linearGradient>
              </defs>
            </svg>
            <motion.span
              className="splash__heartPulse"
              initial={{ scale: 0.9, opacity: 0.35 }}
              animate={{ scale: 1.05, opacity: 0.55 }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
                delay: 1.6,
              }}
            />
          </div>

          <motion.h1
            className="splash__title"
            initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
              delay: 1.35,
              duration: 1.1,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            Memory Lane
          </motion.h1>

          <motion.p
            className="splash__subtitle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.1, duration: 0.9 }}
          >
            A hallway of photographs hanging on strings — made for one person.
          </motion.p>

          <motion.div
            className="splash__actions"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.6, duration: 0.8 }}
          >
            <button type="button" className="splash__enter" onClick={handleEnter}>
              Walk in
            </button>
            <span className="splash__hint" aria-hidden="true">
              tap anywhere · or press enter
            </span>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

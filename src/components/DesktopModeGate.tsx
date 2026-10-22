import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * The hall is a wide corridor: on a phone in portrait it collapses into a
 * postage stamp. Rather than asking the visitor to turn the phone sideways we
 * ask them to open the desktop version of the site, which is what the design
 * was drawn for. The gate lifts itself as soon as the browser reports the
 * wide desktop viewport.
 */

const BYPASS_KEY = 'memoryLaneDesktopBypass'
const DESKTOP_WIDTH = 900

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk/i

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (MOBILE_UA.test(ua)) return true
  // iPadOS pretends to be a desktop Safari, but it still has touch points.
  if (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
    return true
  }
  return false
}

function browserHint(): { name: string; steps: string } {
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return {
      name: 'Safari on iPhone',
      steps: 'Tap the Share button, then choose “Request Desktop Website”.',
    }
  }
  if (/Android/i.test(ua)) {
    return {
      name: 'Chrome on Android',
      steps: 'Tap the ⋮ menu in the corner and turn on “Desktop site”.',
    }
  }
  return {
    name: 'your browser',
    steps: 'Open the browser menu and switch on “Desktop site” / “Request Desktop Website”.',
  }
}

export function DesktopModeGate() {
  const [bypassed, setBypassed] = useState(false)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    try {
      setBypassed(localStorage.getItem(BYPASS_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const check = () => {
      const touch = isTouchDevice()
      const compact = window.innerWidth < DESKTOP_WIDTH
      // A wide viewport means the visitor already switched to the desktop site.
      setLocked(touch && compact)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  const visible = locked && !bypassed

  const steps = useMemo(() => browserHint(), [])

  const bypass = () => {
    setBypassed(true)
    try {
      localStorage.setItem(BYPASS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="desktop-gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          role="dialog"
          aria-modal="true"
          aria-label="Desktop mode required"
        >
          <div className="desktop-gate__aurora" aria-hidden="true" />
          <div className="desktop-gate__motes" aria-hidden="true">
            {[...Array(18)].map((_, i) => (
              <span
                key={i}
                style={
                  {
                    '--i': i,
                    left: `${(i * 37) % 100}%`,
                    top: `${(i * 61) % 100}%`,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          <motion.div
            className="desktop-gate__card"
            initial={{ opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="desktop-gate__devices"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="desktop-gate__phone">
                <span className="desktop-gate__phoneScreen" />
              </div>
              <div className="desktop-gate__laptop">
                <span className="desktop-gate__laptopScreen" />
                <span className="desktop-gate__laptopBase" />
              </div>
            </motion.div>

            <span className="desktop-gate__eyebrow">One small thing</span>
            <h1 className="desktop-gate__title">Open the desktop version</h1>
            <p className="desktop-gate__text">
              This hallway is drawn wide — like a real corridor — so it needs the desktop
              layout. Switch to the desktop site and the whole hall opens up.
            </p>

            <div className="desktop-gate__steps">
              <span className="desktop-gate__stepBadge">{steps.name}</span>
              <span className="desktop-gate__stepText">{steps.steps}</span>
            </div>

            <div className="desktop-gate__actions">
              <button type="button" className="desktop-gate__primary" onClick={() => window.location.reload()}>
                I switched — reload
              </button>
            </div>

            <button type="button" className="desktop-gate__bypass" onClick={bypass}>
              continue on the phone anyway
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

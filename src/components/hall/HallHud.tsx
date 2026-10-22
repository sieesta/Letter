import { AnimatePresence, motion } from 'framer-motion'
import type { MuseumProfile } from '../../types'
import { useTypewriter } from '../../lib/useTypewriter'
import type { HallLayout } from './geometry'
import { QuoteCard } from './QuoteCard'

interface HallHudProps {
  profile: MuseumProfile
  layout: HallLayout
  focusIndex: number | null
  activeIndex: number
  autoWalk: boolean
  atEnd: boolean
  hintVisible: boolean
  onToggleAuto: () => void
  onJump: (distance: number) => void
  onEdit: () => void
  onReset: () => void
  onCloseFocus: () => void
}

export function HallHud({
  profile,
  layout,
  focusIndex,
  activeIndex,
  autoWalk,
  atEnd,
  hintVisible,
  onToggleAuto,
  onJump,
  onEdit,
  onReset,
  onCloseFocus,
}: HallHudProps) {
  const focusedSlot = focusIndex !== null ? layout.slots[focusIndex] : null

  return (
    <div className="hall-hud">
      <header className="hall-topbar">
        <div className="hall-topbar__title">
          <motion.span
            className="hall-topbar__eyebrow"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            {profile.herName ? `For ${profile.herName}` : 'For you'}
          </motion.span>
          <motion.h1
            className="hall-topbar__name"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            {profile.hallTitle || 'A Hallway of Us'}
          </motion.h1>
        </div>

        <div className="hall-topbar__actions">
          <button
            type="button"
            className={`hall-chip${autoWalk ? ' is-on' : ''}`}
            onClick={onToggleAuto}
            aria-pressed={autoWalk}
          >
            {autoWalk ? 'Walking' : 'Paused'}
          </button>
          <button type="button" className="hall-chip" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="hall-chip hall-chip--ghost" onClick={onReset}>
            Reset
          </button>
        </div>
      </header>

      {/* timeline of prints */}
      {layout.slots.length > 1 ? (
        <nav className="hall-timeline" aria-label="Memories">
          {layout.slots.map((slot) => (
            <button
              key={slot.index}
              type="button"
              className={`hall-timeline__dot${slot.index === activeIndex ? ' is-active' : ''}${
                slot.index === focusIndex ? ' is-focus' : ''
              }`}
              onClick={() => onJump(-slot.z)}
              aria-label={`Go to memory ${slot.index + 1}`}
            >
              <span />
            </button>
          ))}
        </nav>
      ) : null}

      <AnimatePresence>
        {focusedSlot ? (
          <QuoteCard key="quote" photo={focusedSlot.photo} onClose={onCloseFocus} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {hintVisible && focusIndex === null && !atEnd ? (
          <motion.p
            className="hall-hint"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.9, duration: 0.6 }}
          >
            <span className="hall-hint__fine">
              Scroll, drag or press <kbd>↑</kbd> to walk · click a picture to linger
            </span>
            <span className="hall-hint__coarse">Swipe up or down to walk · tap a picture to linger</span>
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {atEnd ? (
          <motion.div
            className="hall-finale"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              className="hall-finale__card"
              initial={{ opacity: 0, y: 34, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="hall-finale__eyebrow">The last frame</span>
              <FinaleMessage message={profile.message} />
              {profile.formLink ? (
                <a className="hall-finale__cta" href={profile.formLink} target="_blank" rel="noreferrer">
                  Open the letter
                </a>
              ) : null}
              <div className="hall-finale__actions">
                <button type="button" className="hall-chip" onClick={() => onJump(0)}>
                  Walk it again
                </button>
                <button type="button" className="hall-chip hall-chip--ghost" onClick={onEdit}>
                  Change the memories
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/** The last words of the hall, typed out slowly. */
function FinaleMessage({ message }: { message: string }) {
  const words = message?.trim() || 'Every room we have walked through led back to this one.'
  const { visible, done } = useTypewriter(words, { speed: 24, delay: 620 })
  return (
    <p className="hall-finale__message">
      {visible}
      <span className={`quote__caret${done ? ' is-done' : ''}`} aria-hidden="true" />
    </p>
  )
}

import { motion } from 'framer-motion'
import type { MemoryPhoto } from '../../types'
import { useTypewriter } from '../../lib/useTypewriter'

interface QuoteCardProps {
  photo: MemoryPhoto
  onClose: () => void
}

/**
 * The card that opens when a print is clicked: the photograph, the date, and
 * the words that belong to it — typed out one letter at a time, the way a
 * message would arrive. Tapping the card finishes the sentence at once.
 */
export function QuoteCard({ photo, onClose }: QuoteCardProps) {
  const words = photo.caption?.trim() || 'A memory worth keeping.'
  const { visible, done, skip } = useTypewriter(words, { speed: 30, delay: 420 })

  return (
    <motion.div
      className="quote"
      initial={{ opacity: 0, y: 44, scale: 0.95, filter: 'blur(12px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 26, scale: 0.97, filter: 'blur(8px)' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      onClick={skip}
      role="dialog"
      aria-label="Memory"
    >
      <span className="quote__halo" aria-hidden="true" />
      <span className="quote__handle" aria-hidden="true" />

      <figure className="quote__figure">
        <span className="quote__frame">
          <img src={photo.src} alt={photo.caption || 'A memory'} loading="lazy" decoding="async" />
        </span>
        {photo.date ? <figcaption className="quote__date">{photo.date}</figcaption> : null}
      </figure>

      <blockquote className="quote__body">
        <span className="quote__mark" aria-hidden="true">
          &ldquo;
        </span>
        <p className="quote__text">
          {visible}
          <span className={`quote__caret${done ? ' is-done' : ''}`} aria-hidden="true" />
        </p>
      </blockquote>

      <button type="button" className="quote__close" onClick={onClose}>
        Back to the hall
      </button>
    </motion.div>
  )
}

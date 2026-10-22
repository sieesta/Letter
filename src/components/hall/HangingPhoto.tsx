import { memo } from 'react'
import type { PhotoSlot } from './geometry'

interface HangingPhotoProps {
  slot: PhotoSlot
  focused: boolean
  dimmed: boolean
  onOpen: (index: number) => void
  register: (index: number, el: HTMLElement | null) => void
}

/**
 * A print clipped to a string: a wooden peg at the top, a short wire, and a
 * framed photograph that swings like a real weight on a line.
 */
export const HangingPhoto = memo(function HangingPhoto({
  slot,
  focused,
  dimmed,
  onOpen,
  register,
}: HangingPhotoProps) {
  const { width, height, hangY } = slot
  const printTop = slot.y - height / 2
  // The wire runs from the string down to the top edge of the print.
  const wireLength = Math.max(6, printTop - hangY)

  return (
    <div
      ref={(el) => register(slot.index, el)}
      className={`world-pos${focused ? ' is-focused' : ''}${dimmed ? ' is-dimmed' : ''}`}
      style={{ transform: `translate3d(${slot.x}px, ${slot.y}px, ${slot.z}px)` }}
    >
      <div className="world-wire" style={{ bottom: `${height / 2}px`, height: `${wireLength}px` }} />

      <div
        className="world-yaw"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          marginLeft: `${-width / 2}px`,
          marginTop: `${-height / 2}px`,
          transform: `rotateY(${slot.ry}deg)`,
        }}
      >
        <div className="world-scale">
          <div className="world-peg" />
          <div className="world-sway" style={{ animationDelay: `${-(slot.index % 7) * 0.83}s` }}>
            <button
              type="button"
              className="world-print"
              onClick={() => onOpen(slot.index)}
              aria-label={slot.photo.caption || `Photo ${slot.index + 1}`}
            >
              <span className="world-print__mat">
                <img
                  src={slot.photo.src}
                  alt={slot.photo.caption || `Memory ${slot.index + 1}`}
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span className="world-print__label">
                <span className="world-print__caption">{slot.photo.caption}</span>
                {slot.photo.date ? <span className="world-print__date">{slot.photo.date}</span> : null}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="world-glow" style={{ width: `${width * 2.2}px`, height: `${height * 2.4}px` }} />
    </div>
  )
})

import { memo } from 'react'

export interface Point3 {
  x: number
  y: number
  z: number
}

interface PolylineProps {
  points: Point3[]
  thickness?: number
  className?: string
}

/**
 * A string drawn in 3D as a chain of thin quads.
 * Segments that run along Z are laid flat into the depth axis, segments that
 * run along X stay in the picture plane, so garlands read as curves and
 * clotheslines recede into the distance.
 */
export const Polyline = memo(function Polyline({
  points,
  thickness = 2,
  className = '',
}: PolylineProps) {
  const segments: Array<{ transform: string; width: number }> = []

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dz = b.z - a.z
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const mz = (a.z + b.z) / 2

    if (Math.abs(dz) < 0.5) {
      const len = Math.hypot(dx, dy)
      if (len < 0.5) continue
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      segments.push({
        transform: `translate3d(${mx}px, ${my}px, ${mz}px) translate(-50%,-50%) rotateZ(${angle}deg)`,
        width: len * 1.08,
      })
    } else {
      const len = Math.hypot(dy, dz)
      if (len < 0.5) continue
      const angle = (Math.atan2(dy, -dz) * 180) / Math.PI
      segments.push({
        transform: `translate3d(${mx}px, ${my}px, ${mz}px) translate(-50%,-50%) rotateX(${angle}deg) rotateY(90deg)`,
        width: len * 1.08,
      })
    }
  }

  return (
    <>
      {segments.map((segment, i) => (
        <div
          key={i}
          className={`world-seg ${className}`}
          style={{
            transform: segment.transform,
            width: `${segment.width}px`,
            height: `${thickness}px`,
          }}
        />
      ))}
    </>
  )
})

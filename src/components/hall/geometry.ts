import type { MemoryPhoto } from '../../types'

/**
 * World space is measured in pixels at the camera plane.
 *   x -> right, y -> down (negative is up), z -> depth (negative is away).
 * The camera sits at the origin looking down -Z.
 */
export const HALL = {
  wallX: 470,
  ceilY: -250,
  floorY: 250,
  perspective: 1050,
  spacing: 430,
  lineX: 182,
  lineY: -198,
  garlandSag: 58,
  eyeHeight: 0,
  /** The first print hangs this far ahead of the entrance. */
  startOffset: 250,
} as const

export type SlotKind = 'line' | 'garland'

export interface PhotoSlot {
  index: number
  /** centre of the print */
  x: number
  y: number
  z: number
  /** yaw around the vertical axis, in degrees */
  ry: number
  /** anchor point on the string the print hangs from */
  hangX: number
  hangY: number
  width: number
  height: number
  kind: SlotKind
  photo: MemoryPhoto
}

export interface HallLayout {
  slots: PhotoSlot[]
  /** total length of the corridor in world units */
  length: number
  /** distance along the hall of every photo, ascending */
  photoDistances: number[]
}

/** Height of the cross-garland string at a given x. */
export function garlandY(x: number): number {
  const t = Math.min(1, Math.abs(x) / HALL.wallX)
  return HALL.ceilY + 46 + HALL.garlandSag * (1 - t * t)
}

/** Gentle wave of the two long clotheslines so they never look like a ruler. */
export function lineY(z: number): number {
  return HALL.lineY + Math.sin(z / 310) * 7 + Math.sin(z / 137) * 2.5
}

function pseudo(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function buildLayout(photos: MemoryPhoto[]): HallLayout {
  const slots: PhotoSlot[] = photos.map((photo, i) => {
    const z = -(i * HALL.spacing + HALL.startOffset)
    const phase = i % 4
    const jitter = pseudo(i + 1)
    const scale = 0.86 + jitter * 0.34
    const width = Math.round(244 * scale)
    const height = Math.round(180 * scale)

    if (phase === 3) {
      // A print hanging from the middle of a cross-garland.
      const hangY = garlandY(0)
      const drop = 48 + jitter * 42
      return {
        index: i,
        x: 0,
        y: hangY + drop + height / 2,
        z,
        ry: (jitter - 0.5) * 8,
        hangX: 0,
        hangY,
        width,
        height,
        kind: 'garland' as SlotKind,
        photo,
      }
    }

    const side = phase === 0 || phase === 2 ? -1 : 1
    const hangX = side * HALL.lineX
    const hangY = lineY(z)
    const drop = 84 + jitter * 54
    return {
      index: i,
      x: hangX,
      y: hangY + drop + height / 2,
      z,
      ry: side * (4 + jitter * 7),
      hangX,
      hangY,
      width,
      height,
      kind: 'line' as SlotKind,
      photo,
    }
  })

  const length = Math.max(1500, photos.length * HALL.spacing + 1250)
  return {
    slots,
    length,
    photoDistances: slots.map((s) => -s.z).sort((a, b) => a - b),
  }
}

/**
 * Points of the two long clotheslines. They begin at the camera plane and run
 * to the far wall, so a segment never has to cross behind the lens.
 */
export function clotheslinePoints(side: number, length: number): Array<{ x: number; y: number; z: number }> {
  const points: Array<{ x: number; y: number; z: number }> = []
  const step = 190
  for (let z = 0; z > -length - 160; z -= step) {
    points.push({ x: side * HALL.lineX, y: lineY(z), z })
  }
  return points
}

/** Points of one cross-garland at a given depth. */
export function garlandPoints(z: number): Array<{ x: number; y: number; z: number }> {
  const points: Array<{ x: number; y: number; z: number }> = []
  const segments = 16
  for (let i = 0; i <= segments; i += 1) {
    const x = -HALL.wallX + (i / segments) * (HALL.wallX * 2)
    points.push({ x, y: garlandY(x), z })
  }
  return points
}

/** Garlands are placed every fourth slot, matching the layout rhythm. */
export function garlandDepths(photos: number): number[] {
  const depths: number[] = []
  for (let i = 3; i < photos; i += 4) {
    depths.push(-(i * HALL.spacing + HALL.startOffset))
  }
  return depths
}

/** Ceiling lamps, spaced down the hall, to give the corridor a rhythm. */
export function lampDepths(photos: number): number[] {
  const depths: number[] = []
  for (let i = 0; i < photos; i += 3) {
    depths.push(-(i * HALL.spacing + HALL.startOffset))
  }
  return depths
}

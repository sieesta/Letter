import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MuseumProfile } from '../../types'
import { HALL, buildLayout, clotheslinePoints, garlandDepths, garlandPoints, lampDepths } from './geometry'
import { HangingPhoto } from './HangingPhoto'
import { Polyline } from './Polyline'
import { HallHud } from './HallHud'

interface HallwayProps {
  profile: MuseumProfile
  onEdit: () => void
  onReset: () => void
  onSignOut?: () => void
}

interface CameraState {
  target: number
  current: number
  auto: boolean
  dwelling: boolean
  dwellUntil: number
  manualUntil: number
  pointerX: number
  pointerY: number
  lookX: number
  lookY: number
  camX: number
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

export function Hallway({ profile, onEdit, onReset, onSignOut }: HallwayProps) {
  const layout = useMemo(() => buildLayout(profile.photos), [profile.photos])
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const photoEls = useRef(new Map<number, HTMLElement>())
  const fadeCache = useRef(new Map<number, number>())

  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [autoWalk, setAutoWalk] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [hintVisible, setHintVisible] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)

  const focusRef = useRef<number | null>(null)
  const autoRef = useRef(true)
  const maxZ = Math.max(400, layout.length - 300)

  const cam = useRef<CameraState>({
    target: 0,
    current: 0,
    auto: true,
    dwelling: false,
    dwellUntil: 0,
    manualUntil: 0,
    pointerX: 0,
    pointerY: 0,
    lookX: 0,
    lookY: 0,
    camX: 0,
  })
  const nearestRef = useRef(-1)
  // On a narrow screen the corridor is wider than the phone, so the whole
  // world is scaled down until it fits. Desktop visitors keep it at 1.
  const scaleRef = useRef(1)

  useEffect(() => {
    focusRef.current = focusIndex
  }, [focusIndex])

  useEffect(() => {
    autoRef.current = autoWalk
    cam.current.auto = autoWalk
  }, [autoWalk])

  useEffect(() => {
    const measure = () => {
      const width = window.innerWidth || 1
      scaleRef.current = Math.min(1, Math.max(0.4, width / 980))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [])

  const register = useCallback((index: number, el: HTMLElement | null) => {
    if (el) photoEls.current.set(index, el)
    else photoEls.current.delete(index)
  }, [])

  /* ----------------------------------------------------------- camera loop */

  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.06, (now - last) / 1000)
      last = now
      const s = cam.current
      const focused = focusRef.current

      if (s.auto && focused === null && now > s.manualUntil) {
        // Walk to the next print, linger on it, then carry on.
        let nextIndex = -1
        for (let i = 0; i < layout.photoDistances.length; i += 1) {
          if (layout.photoDistances[i] > s.current + 30) {
            nextIndex = i
            break
          }
        }

        if (s.dwelling) {
          // Standing in front of a print, looking at it.
          if (now >= s.dwellUntil) s.dwelling = false
        } else if (nextIndex === -1) {
          s.target = Math.min(s.target + 46 * dt, maxZ)
        } else {
          const next = layout.photoDistances[nextIndex]
          const remaining = next - s.target
          if (remaining < 3) {
            s.target = next
            s.dwelling = true
            s.dwellUntil = now + 2900
          } else {
            const speed = remaining < 300 ? 24 : 64
            s.target = Math.min(s.target + speed * dt, next)
          }
        }
      }

      if (focused !== null) {
        const slot = layout.slots[focused]
        if (slot) {
          s.target = -slot.z
          s.dwelling = false
        }
      }

      s.target = clamp(s.target, 0, maxZ)
      s.current += (s.target - s.current) * (1 - Math.pow(0.0012, dt))
      if (Math.abs(s.target - s.current) < 0.05) s.current = s.target

      const focusSlot = focused !== null ? layout.slots[focused] : null
      const wantX = focusSlot ? focusSlot.x * 0.58 : 0
      s.camX += (wantX - s.camX) * Math.min(1, dt * 3.4)
      s.lookX += (s.pointerX - s.lookX) * Math.min(1, dt * 3.6)
      s.lookY += (s.pointerY - s.lookY) * Math.min(1, dt * 3.6)

      const world = worldRef.current
      if (world) {
        const bob = Math.sin(now / 760) * (s.auto && focused === null ? 3.2 : 1.4)
        const roll = Math.sin(now / 1240) * 0.2
        const scale = scaleRef.current
        world.style.transform = `translate3d(${s.camX + s.lookX * 26}px, ${bob + s.lookY * 14}px, ${s.current}px) rotateX(${-s.lookY * 1.5}deg) rotateY(${s.lookX * 2.1}deg) rotateZ(${roll}deg) scale(${scale})`
      }

      // Depth fade: prints dissolve into the dark at the far end of the hall.
      for (const slot of layout.slots) {
        const el = photoEls.current.get(slot.index)
        if (!el) continue
        const rel = slot.z + s.current
        let fade = 0
        if (rel < -70) {
          const distance = Math.abs(rel)
          fade = smoothstep(1 - (distance - 1000) / 2700)
        }
        if (focused === slot.index) fade = 1
        const previous = fadeCache.current.get(slot.index)
        if (previous === undefined || Math.abs(previous - fade) > 0.02) {
          fadeCache.current.set(slot.index, fade)
          el.style.setProperty('--fade', fade.toFixed(3))
          el.style.visibility = fade < 0.015 ? 'hidden' : 'visible'
        }
      }

      setAtEnd(s.current > maxZ - 55)

      // Keep the timeline in sync with the print the visitor is closest to.
      let nearest = -1
      let nearestGap = Infinity
      for (let i = 0; i < layout.slots.length; i += 1) {
        const gap = Math.abs(-layout.slots[i].z - s.current)
        if (gap < nearestGap) {
          nearestGap = gap
          nearest = i
        }
      }
      if (nearest !== nearestRef.current) {
        nearestRef.current = nearest
        if (nearest >= 0) setActiveIndex(nearest)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [layout, maxZ])

  /* ---------------------------------------------------------------- inputs */

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const s = cam.current
      s.target = clamp(s.target + event.deltaY * 1.15, 0, maxZ)
      s.manualUntil = performance.now() + 4200
      s.dwelling = false
      if (focusRef.current !== null) setFocusIndex(null)
    }

    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [maxZ])

  useEffect(() => {
    let dragging = false
    let lastY = 0
    let pointerId = -1

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('button, a, input, .hall-hud')) return
      dragging = true
      pointerId = event.pointerId
      lastY = event.clientY
      stageRef.current?.setPointerCapture?.(pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      const s = cam.current
      s.pointerX = (event.clientX / window.innerWidth) * 2 - 1
      s.pointerY = (event.clientY / window.innerHeight) * 2 - 1
      if (!dragging || event.pointerId !== pointerId) return
      const delta = event.clientY - lastY
      lastY = event.clientY
      s.target = clamp(s.target - delta * 2.4, 0, maxZ)
      s.manualUntil = performance.now() + 4200
      s.dwelling = false
      if (focusRef.current !== null) setFocusIndex(null)
    }
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      dragging = false
      pointerId = -1
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [maxZ])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const s = cam.current
      const step = event.shiftKey ? 420 : 170
      switch (event.key) {
        case 'ArrowDown':
        case 's':
        case 'S':
          s.target = clamp(s.target - step, 0, maxZ)
          s.manualUntil = performance.now() + 4200
          s.dwelling = false
          break
        case 'ArrowUp':
        case 'w':
        case 'W':
          s.target = clamp(s.target + step, 0, maxZ)
          s.manualUntil = performance.now() + 4200
          s.dwelling = false
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          s.target = clamp(s.target - step * 0.55, 0, maxZ)
          s.manualUntil = performance.now() + 4200
          s.dwelling = false
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          s.target = clamp(s.target + step * 0.55, 0, maxZ)
          s.manualUntil = performance.now() + 4200
          s.dwelling = false
          break
        case 'Escape':
          setFocusIndex(null)
          break
        case ' ':
          event.preventDefault()
          setAutoWalk((value) => !value)
          break
        default:
          return
      }
      if (focusRef.current !== null && event.key !== 'Escape') setFocusIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [maxZ])

  useEffect(() => {
    const timer = window.setTimeout(() => setHintVisible(false), 9000)
    return () => window.clearTimeout(timer)
  }, [])

  /* ---------------------------------------------------------------- render */

  const handleOpen = useCallback((index: number) => {
    setFocusIndex((current) => (current === index ? null : index))
  }, [])

  const jumpTo = useCallback(
    (distance: number) => {
      const s = cam.current
      s.target = clamp(distance, 0, maxZ)
      s.manualUntil = performance.now() + 4200
      s.dwelling = false
      setFocusIndex(null)
    },
    [maxZ],
  )

  const leftLine = useMemo(() => clotheslinePoints(-1, layout.length), [layout.length])
  const rightLine = useMemo(() => clotheslinePoints(1, layout.length), [layout.length])
  const garlands = useMemo(() => garlandDepths(profile.photos.length), [profile.photos.length])
  const lamps = useMemo(() => lampDepths(profile.photos.length), [profile.photos.length])
  // The shell reaches from behind the end of the hall to past the camera, so
  // the corridor always fills the frame.
  const shellLength = layout.length + 900
  const shellCenter = 255 - layout.length / 2
  const dust = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        left: (pseudoRandom(i * 3.1) * 100).toFixed(2),
        top: (pseudoRandom(i * 7.7 + 5) * 100).toFixed(2),
        size: (1 + pseudoRandom(i * 2.3 + 11) * 2.4).toFixed(2),
        delay: (pseudoRandom(i * 5.9 + 3) * 12).toFixed(2),
        duration: (9 + pseudoRandom(i * 4.7 + 7) * 13).toFixed(2),
        opacity: (0.15 + pseudoRandom(i * 9.1 + 2) * 0.4).toFixed(2),
      })),
    [],
  )
  // Slow orbs of light that drift through the corridor in front of the walls.
  const orbs = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        left: (8 + pseudoRandom(i * 11.3) * 84).toFixed(2),
        top: (12 + pseudoRandom(i * 4.9 + 3) * 70).toFixed(2),
        size: (46 + pseudoRandom(i * 6.1 + 2) * 120).toFixed(0),
        delay: (pseudoRandom(i * 8.7) * 16).toFixed(2),
        duration: (18 + pseudoRandom(i * 3.3 + 4) * 22).toFixed(2),
        hue: pseudoRandom(i * 2.9 + 7) > 0.65 ? 'wine' : 'amber',
      })),
    [],
  )

  return (
    <div className="hall" ref={stageRef}>
      <div className="hall-stage">
        <div className="hall-world" ref={worldRef}>
          {/* shell — the planes reach past the camera so no void shows */}
          <div className="world-pos" style={{ transform: `translate3d(0px, ${HALL.floorY}px, ${shellCenter}px)` }}>
            <div
              className="hall-floor"
              style={{
                width: `${HALL.wallX * 2}px`,
                height: `${shellLength}px`,
                transform: 'translate(-50%,-50%) rotateX(90deg)',
              }}
            />
          </div>
          <div className="world-pos" style={{ transform: `translate3d(0px, ${HALL.ceilY}px, ${shellCenter}px)` }}>
            <div
              className="hall-ceiling"
              style={{
                width: `${HALL.wallX * 2}px`,
                height: `${shellLength}px`,
                transform: 'translate(-50%,-50%) rotateX(-90deg)',
              }}
            />
          </div>
          <div className="world-pos" style={{ transform: `translate3d(${-HALL.wallX}px, 0px, ${shellCenter}px)` }}>
            <div
              className="hall-wall hall-wall--left"
              style={{
                width: `${shellLength}px`,
                height: `${HALL.floorY - HALL.ceilY}px`,
                transform: 'translate(-50%,-50%) rotateY(90deg)',
              }}
            />
          </div>
          <div className="world-pos" style={{ transform: `translate3d(${HALL.wallX}px, 0px, ${shellCenter}px)` }}>
            <div
              className="hall-wall hall-wall--right"
              style={{
                width: `${shellLength}px`,
                height: `${HALL.floorY - HALL.ceilY}px`,
                transform: 'translate(-50%,-50%) rotateY(-90deg)',
              }}
            />
          </div>

          {/* the far door */}
          <div className="world-pos" style={{ transform: `translate3d(0px, 0px, ${-layout.length}px)` }}>
            <div className="hall-endcap">
              <div className="hall-endcap__arch" />
              <div className="hall-endcap__glow" />
            </div>
          </div>

          {/* strings */}
          <Polyline points={leftLine} thickness={2.2} className="world-seg--line" />
          <Polyline points={rightLine} thickness={2.2} className="world-seg--line" />
          {garlands.map((z) => (
            <Polyline key={z} points={garlandPoints(z)} thickness={2} className="world-seg--garland" />
          ))}

          {/* ceiling lamps */}
          {lamps.map((z) => (
            <div key={`lamp-${z}`} className="world-pos" style={{ transform: `translate3d(0px, ${HALL.ceilY + 14}px, ${z}px)` }}>
              <div className="hall-lamp">
                <span className="hall-lamp__bulb" />
                <span className="hall-lamp__shaft" />
                <span className="hall-lamp__pool" />
              </div>
            </div>
          ))}

          {/* prints */}
          {layout.slots.map((slot) => (
            <HangingPhoto
              key={slot.index}
              slot={slot}
              focused={focusIndex === slot.index}
              dimmed={focusIndex !== null && focusIndex !== slot.index}
              onOpen={handleOpen}
              register={register}
            />
          ))}
        </div>
      </div>

      <div className="hall-fog" aria-hidden="true" />
      <div className="hall-sweep" aria-hidden="true" />
      <div className="hall-bokeh" aria-hidden="true">
        {orbs.map((orb, i) => (
          <span
            key={i}
            className={`hall-orb hall-orb--${orb.hue}`}
            style={{
              left: `${orb.left}%`,
              top: `${orb.top}%`,
              width: `${orb.size}px`,
              height: `${orb.size}px`,
              animationDelay: `${orb.delay}s`,
              animationDuration: `${orb.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="hall-dust" aria-hidden="true">
        {dust.map((mote, i) => (
          <span
            key={i}
            className="hall-mote"
            style={{
              left: `${mote.left}%`,
              top: `${mote.top}%`,
              width: `${mote.size}px`,
              height: `${mote.size}px`,
              animationDelay: `${mote.delay}s`,
              animationDuration: `${mote.duration}s`,
              opacity: mote.opacity,
            }}
          />
        ))}
      </div>
      <div className="hall-vignette" aria-hidden="true" />
      <div className="hall-grain" aria-hidden="true" />

      <HallHud
        profile={profile}
        layout={layout}
        focusIndex={focusIndex}
        activeIndex={activeIndex}
        autoWalk={autoWalk}
        atEnd={atEnd}
        hintVisible={hintVisible}
        onToggleAuto={() => setAutoWalk((value) => !value)}
        onJump={jumpTo}
        onEdit={onEdit}
        onReset={onReset}
        onCloseFocus={() => setFocusIndex(null)}
        onSignOut={onSignOut}
      />
    </div>
  )
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

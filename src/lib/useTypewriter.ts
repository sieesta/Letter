import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface TypewriterOptions {
  /** Characters revealed per second. */
  speed?: number
  /** Milliseconds before the first letter appears. */
  delay?: number
  /** Skip the animation and show the whole text. */
  instant?: boolean
  /** Restart the animation whenever the text changes. */
  restartOnChange?: boolean
}

export interface Typewriter {
  /** The part of the text that has been typed so far. */
  visible: string
  /** True once every character is on screen. */
  done: boolean
  /** Reveal the rest right now. */
  skip: () => void
  /** Type it again from the beginning. */
  replay: () => void
}

const PUNCTUATION_WEIGHT = /[.,!?;:]/
const LONG_PAUSE_WEIGHT = /[—–\n]/

/**
 * Reveals a string one character at a time, the way a message would arrive.
 * Punctuation buys a little extra time, so the rhythm reads like speech.
 */
export function useTypewriter(text: string, options: TypewriterOptions = {}): Typewriter {
  const { speed = 42, delay = 260, instant = false, restartOnChange = true } = options

  const chars = useMemo(() => Array.from(text ?? ''), [text])
  const marks = useMemo(() => {
    const list: number[] = []
    let acc = 0
    for (const char of chars) {
      acc += PUNCTUATION_WEIGHT.test(char) ? 6 : LONG_PAUSE_WEIGHT.test(char) ? 10 : 1
      list.push(acc)
    }
    return list
  }, [chars])

  const [count, setCount] = useState(instant ? chars.length : 0)
  const [done, setDone] = useState(instant || chars.length === 0)
  const frame = useRef(0)
  const started = useRef(0)

  useEffect(() => {
    if (instant || chars.length === 0) {
      setCount(chars.length)
      setDone(true)
      return undefined
    }
    if (!restartOnChange) return undefined

    setCount(0)
    setDone(false)
    started.current = 0

    const tick = (now: number) => {
      if (!started.current) started.current = now
      const elapsed = (now - started.current) / 1000
      const units = elapsed * speed
      let revealed = 0
      while (revealed < marks.length && marks[revealed] <= units) revealed += 1
      setCount(revealed)
      if (revealed >= chars.length) {
        setDone(true)
        return
      }
      frame.current = requestAnimationFrame(tick)
    }

    const startTimer = window.setTimeout(() => {
      frame.current = requestAnimationFrame(tick)
    }, delay)

    return () => {
      window.clearTimeout(startTimer)
      cancelAnimationFrame(frame.current)
    }
  }, [chars, marks, instant, delay, speed, restartOnChange])

  const skip = useCallback(() => {
    cancelAnimationFrame(frame.current)
    setCount(chars.length)
    setDone(true)
  }, [chars.length])

  const replay = useCallback(() => {
    cancelAnimationFrame(frame.current)
    started.current = 0
    setCount(0)
    setDone(false)

    const tick = (now: number) => {
      if (!started.current) started.current = now
      const elapsed = (now - started.current) / 1000
      const units = elapsed * speed
      let revealed = 0
      while (revealed < marks.length && marks[revealed] <= units) revealed += 1
      setCount(revealed)
      if (revealed >= chars.length) {
        setDone(true)
        return
      }
      frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)
  }, [marks, chars.length, speed])

  const visible = chars.slice(0, count).join('')

  return { visible, done, skip, replay }
}

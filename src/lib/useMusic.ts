import { useEffect, useState } from 'react'
import type { MusicState } from '../types'
import type { MusicEngine } from './audioEngine'

export function useMusic(engine: MusicEngine): MusicState {
  const [state, setState] = useState<MusicState>(() => engine.getState())
  useEffect(() => engine.subscribe(setState), [engine])
  return state
}

import type { MusicSource, MusicState, MusicStatus } from '../types'
import { getTrack, putTrack } from './idb'
import {
  embedUrl,
  hasYouTubeIframeApi,
  loadYouTubeIframeApi,
  resolveAudioStream,
  type AudioStream,
} from './youtube'

const VOLUME_KEY = 'memoryLaneVolume'

interface StartOptions {
  videoId?: string | null
  /** IndexedDB key of a locally stored audio file, or a direct audio URL */
  audioKey?: string | null
  audioFileName?: string
  /** Direct public URL to an audio file (e.g. Supabase storage) */
  audioUrl?: string | null
}

type Listener = (state: MusicState) => void

interface EmbedPlayer {
  playVideo?: () => void
  pauseVideo?: () => void
  setVolume?: (v: number) => void
  seekTo?: (s: number, allowSeekAhead?: boolean) => void
  getCurrentTime?: () => number
  getDuration?: () => number
  muteVideo?: () => void
  unMute?: () => void
  isMuted?: () => boolean
  getIframe?: () => HTMLIFrameElement | undefined
}

const IDLE_STATE: MusicState = {
  status: 'idle',
  source: 'none',
  downloadProgress: 0,
  progress: 0,
  duration: 0,
  title: '',
  error: null,
}

/**
 * The music brain of the app.
 *
 * Playback ladder, best first:
 *   1. local cache   – the track was already fetched, so it starts instantly
 *   2. local file    – the creator uploaded an audio file instead of a link
 *   3. direct stream – InnerTube hands us an `audio/mp4` URL and we hand that
 *                      URL straight to the media element. It starts playing
 *                      while it streams, and we mirror it into IndexedDB so
 *                      the next visit is instant and ad free.
 *   4. hidden player – a 2x2 YouTube iframe that only ever makes sound. This
 *                      one always works, even when YouTube refuses to talk to
 *                      our origin, so it runs in parallel with step 3.
 *
 * No visible YouTube player, ever.
 */
export class MusicEngine {
  private audio: HTMLAudioElement | null = null
  private blobObjectUrl: string | null = null
  private silentUrl: string | null = null
  private embedHost: HTMLDivElement | null = null
  private embedPlayer: EmbedPlayer | null = null
  /** idle | loading | playing | failed */
  private embedState: 'idle' | 'loading' | 'playing' | 'failed' = 'idle'
  /** Bumped every time the hidden player is torn down, so stale callbacks die. */
  private embedEpoch = 0
  private listeners = new Set<Listener>()
  private state: MusicState = { ...IDLE_STATE }
  private abort: AbortController | null = null
  private volume = 0.7
  private desiredPlay = true
  private currentKey: string | null = null
  /** Bumped every time a new track starts, so stale async work is ignored. */
  private generation = 0
  /** The direct YouTube URL we resolved, kept for a manual retry. */
  private directUrl: string | null = null
  /** The YouTube id of the track we are playing, kept for a full retry. */
  private currentVideoId: string | null = null
  /** True when the phone refused to start the stream on its own. */
  private directBlocked = false
  /** True while the direct stream is claiming the room from the hidden player. */
  private directWinning = false
  private progressTimer: number | null = null
  private gestureBound = false

  constructor() {
    this.volume = this.readVolume()
  }

  /* --------------------------------------------------------------- public */

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): MusicState {
    return this.state
  }

  /**
   * Must be called synchronously from a user gesture. It creates the media
   * element and asks for playback immediately so the browser's autoplay policy
   * unlocks audio for the rest of the session.
   */
  arm(): void {
    if (this.audio) {
      void this.audio.play().catch(() => undefined)
      return
    }
    const audio = new Audio()
    audio.preload = 'auto'
    audio.loop = true
    audio.setAttribute('playsinline', '')
    audio.volume = this.volume
    this.audio = audio

    audio.addEventListener('timeupdate', () => {
      const duration = this.state.duration || audio.duration || 0
      const progress = duration > 0 ? Math.min(1, audio.currentTime / duration) : 0
      if (Math.abs(progress - this.state.progress) > 0.002) {
        this.patch({ progress })
      }
    })
    audio.addEventListener('durationchange', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this.patch({ duration: audio.duration })
      }
    })
    audio.addEventListener('playing', () => {
      if (this.state.source !== 'embed') this.patch({ status: 'playing', error: null })
    })
    audio.addEventListener('waiting', () => {
      if (this.state.source !== 'embed' && this.state.status === 'playing') {
        this.patch({ status: 'downloading' })
      }
    })
    audio.addEventListener('error', () => {
      if (this.state.source === 'embed') return
      if (this.state.status !== 'error') {
        this.patch({ status: 'error', error: 'Playback failed' })
      }
    })

    // A real, decodable silent track is what actually unlocks the element on
    // iOS and Android; a MediaSource that never opens does not.
    this.silentUrl = createSilentWavUrl()
    if (this.silentUrl) audio.src = this.silentUrl
    void audio.play().catch(() => undefined)

    this.bindGestureUnlock()
    this.patch({ status: 'arming' })
  }

  /** Kick off playback for the given source. Safe to call more than once. */
  async start(options: StartOptions): Promise<void> {
    const audioKey = options.audioKey?.trim() || null
    const videoId = options.videoId?.trim() || null
    const audioUrl = options.audioUrl?.trim() || null
    const key = audioKey ? `idb:${audioKey}` : audioUrl ? `url:${audioUrl}` : videoId ? `yt:${videoId}` : null

    if (!key) {
      this.patch({ status: 'none', source: 'none', error: null })
      return
    }
    const busy = this.state.status === 'playing' || this.state.status === 'downloading' || this.state.status === 'resolving'
    if (this.currentKey === key && busy) return
    this.currentKey = key

    const generation = ++this.generation
    this.abort?.abort()
    this.abort = null
    this.directUrl = null
    this.currentVideoId = videoId
    this.directBlocked = false
    this.directWinning = false
    this.stopEmbed()

    this.patch({
      status: 'resolving',
      source: 'none',
      downloadProgress: 0,
      progress: 0,
      duration: 0,
      error: null,
    })

    if (audioUrl) {
      await this.startFromUrl(audioUrl, options.audioFileName || 'Our song')
      return
    }
    if (audioKey) {
      await this.startFromLocalFile(audioKey, options.audioFileName || 'Our song', generation)
      return
    }
    if (videoId) {
      await this.startFromYouTube(videoId, generation)
    }
  }

  /** Retry after the browser blocked playback until the user interacted. */
  async retry(): Promise<void> {
    // The hidden player comes first: it is the one that always works.
    if (this.embedPlayer?.playVideo) {
      try {
        this.embedPlayer.playVideo()
        this.desiredPlay = true
        this.patch({ status: 'playing', error: null })
        return
      } catch {
        /* keep going */
      }
    }

    const audio = this.audio
    if (audio) {
      if (this.state.source === 'stream' && this.directUrl && audio.src !== this.directUrl) {
        audio.src = this.directUrl
        audio.loop = true
      }
      try {
        await audio.play()
        this.desiredPlay = true
        this.patch({ status: 'playing', error: null })
        return
      } catch {
        /* keep going */
      }
    }

    if (!this.audio) {
      await this.armAndPlay()
      return
    }

    // Nothing is playing at all: start the whole ladder again, in case the
    // network was simply having a bad moment when the visitor walked in.
    if (this.state.source === 'none' && this.currentVideoId) {
      await this.start({ videoId: this.currentVideoId })
    }
  }

  /** Arm the element and try to start it, used when nothing is playing yet. */
  private async armAndPlay(): Promise<void> {
    this.arm()
    const audio = this.audio
    try {
      await audio?.play()
      this.desiredPlay = true
      this.patch({ status: 'playing', error: null })
    } catch {
      /* the dock will offer a retry */
    }
  }

  async toggle(): Promise<void> {
    if (this.state.source === 'none') return
    if (this.state.source === 'embed') {
      if (this.desiredPlay) {
        this.embedPlayer?.pauseVideo?.()
        this.desiredPlay = false
        this.patch({ status: 'paused' })
      } else {
        this.embedPlayer?.playVideo?.()
        this.desiredPlay = true
        this.patch({ status: 'playing' })
      }
      return
    }
    const audio = this.audio
    if (!audio) return
    if (audio.paused) {
      try {
        await audio.play()
        this.desiredPlay = true
        this.patch({ status: 'playing' })
      } catch {
        this.patch({ status: 'blocked' })
      }
    } else {
      audio.pause()
      this.desiredPlay = false
      this.patch({ status: 'paused' })
    }
  }

  setVolume(value: number): void {
    const v = Math.max(0, Math.min(1, value))
    this.volume = v
    try {
      localStorage.setItem(VOLUME_KEY, String(v))
    } catch {
      /* ignore */
    }
    if (this.audio) this.audio.volume = v
    this.embedPlayer?.setVolume?.(v * 100)
  }

  /**
   * Try to unlock audio playback on mobile/autoplay-restricted browsers.
   */
  ensureUnlocked(): void {
    if (this.audio) {
      void this.audio.play().catch(() => {
        /* will be handled by user interaction */
      })
    }
  }

  getVolume(): number {
    return this.volume
  }

  dispose(): void {
    this.abort?.abort()
    this.abort = null
    this.generation += 1
    this.stopEmbed()
    this.listeners.clear()
    this.stopProgressTimer()
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer)
      this.progressTimer = null
    }
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
      this.audio = null
    }
    if (this.blobObjectUrl) URL.revokeObjectURL(this.blobObjectUrl)
    if (this.silentUrl) URL.revokeObjectURL(this.silentUrl)
    this.blobObjectUrl = null
    this.silentUrl = null
    this.embedHost = null
    this.embedPlayer = null
  }

  /* -------------------------------------------------------------- internals */

  private patch(partial: Partial<MusicState>): void {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach((listener) => {
      try {
        listener(this.state)
      } catch {
        /* a broken listener must not break playback */
      }
    })
  }

  private readVolume(): number {
    try {
      const raw = localStorage.getItem(VOLUME_KEY)
      if (raw !== null) {
        const parsed = Number(raw)
        if (Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed))
      }
    } catch {
      /* ignore */
    }
    return 0.7
  }

  /**
   * Mobile browsers only allow sound after a real interaction. Any tap or
   * click anywhere in the hall is treated as the moment the visitor wants the
   * music, so we retry the playback right there.
   */
  private bindGestureUnlock(): void {
    if (this.gestureBound) return
    this.gestureBound = true
    const unlock = () => {
      if (this.state.status === 'blocked' || this.state.status === 'error') {
        void this.retry()
        return
      }
      if (this.state.source === 'embed' && this.desiredPlay && this.state.status !== 'playing') {
        this.embedPlayer?.playVideo?.()
        this.patch({ status: 'playing' })
        return
      }
      if (this.audio && this.audio.paused && this.desiredPlay && this.state.source === 'stream') {
        void this.audio.play().catch(() => undefined)
      }
    }
    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('touchstart', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })
  }

  /* -------------------------------------------------------------- url path */

  private async startFromUrl(audioUrl: string, name: string): Promise<void> {
    try {
      this.patch({ source: 'url', title: name, downloadProgress: 1 })
      const audio = this.audio
      if (!audio) return
      audio.src = audioUrl
      audio.loop = true
      this.patch({ status: this.desiredPlay ? 'playing' : 'paused' })
      try {
        await audio.play()
        this.patch({ status: 'playing' })
      } catch {
        this.patch({ status: 'blocked' })
      }
    } catch (err) {
      this.patch({ status: 'error', error: err instanceof Error ? err.message : 'Audio failed' })
    }
  }

  /* -------------------------------------------------------- local file path */

  private async startFromLocalFile(audioKey: string, name: string, generation: number): Promise<void> {
    try {
      const cached = await getTrack(audioKey)
      if (generation !== this.generation) return
      const blob = cached?.complete ? cached.blob : null
      if (!blob || blob.size === 0) {
        this.patch({ status: 'none', source: 'none', error: 'That audio file is missing' })
        return
      }
      this.patch({ source: 'file', title: cached?.title || name, downloadProgress: 1 })
      await this.playBlob(blob)
    } catch (err) {
      this.patch({ status: 'error', error: err instanceof Error ? err.message : 'Audio failed' })
    }
  }

  /* ----------------------------------------------------------- youtube path */

  private async startFromYouTube(videoId: string, generation: number): Promise<void> {
    const cached = await getTrack(videoId)
    if (generation !== this.generation) return
    if (cached?.complete && cached.blob && cached.blob.size > 0) {
      this.patch({ source: 'cache', title: cached.title || 'Our song', downloadProgress: 1 })
      await this.playBlob(cached.blob)
      return
    }

    this.patch({ status: 'resolving', source: 'none', title: 'Our song', error: null })

    // Two doors into the same song. The hidden player always works; the direct
    // stream is faster and ad free when YouTube lets the browser resolve it.
    // Both start at once and the first one that really plays takes over.
    const direct = this.playDirectStream(videoId, generation)
    const embed = this.playHiddenPlayer(videoId, generation)

    const winner = await firstTruthy([direct, embed])
    if (generation !== this.generation) return
    if (!winner) {
      if (this.directBlocked) {
        // The song was found but the phone would not start it on its own:
        // one tap and it plays.
        this.patch({ status: 'blocked', source: 'stream', error: null })
      } else {
        this.patch({ status: 'error', source: 'none', error: 'This song could not be played' })
      }
    }
  }

  /** Resolve a direct audio URL and let the media element play it. */
  private async playDirectStream(videoId: string, generation: number): Promise<boolean> {
    let stream: AudioStream | null = null
    try {
      stream = await resolveAudioStream(videoId)
    } catch {
      stream = null
    }
    if (generation !== this.generation) return false
    if (!stream) return false

    this.directUrl = stream.url
    if (stream.title) this.patch({ title: stream.title })
    if (stream.durationSec) this.patch({ duration: stream.durationSec })

    // Mirror the track into the cache in the background so the next visit is
    // instant and free of adverts. This never blocks playback.
    void this.cacheStream(stream, videoId, generation)

    const audio = this.audio
    if (!audio) return false
    // The hidden player already has the song; do not play them on top of each other.
    if (this.embedState === 'playing') return false

    try {
      // Claim the room before starting, so the hidden player stands down
      // instead of playing on top of the stream for a moment.
      this.directWinning = true
      audio.src = stream.url
      audio.loop = true
      await audio.play()
    } catch {
      this.directWinning = false
      this.directBlocked = true
      this.patch({ status: 'blocked', source: 'stream' })
      return false
    }
    if (generation !== this.generation) return false

    this.stopEmbed()
    this.patch({ source: 'stream', status: 'playing', error: null })
    return true
  }

  /** Best effort download of the track so the next visit needs no network. */
  private async cacheStream(stream: AudioStream, videoId: string, generation: number): Promise<void> {
    const controller = new AbortController()
    this.abort = controller
    try {
      const response = await fetch(stream.url, {
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
      })
      if (!response.ok || !response.body) return

      const total = stream.contentLength ?? 0
      const reader = response.body.getReader()
      const parts: BlobPart[] = []
      let received = 0

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue
        received += value.byteLength
        const copy = value.slice()
        parts.push(copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength))
        if (generation === this.generation) {
          const ratio = total > 0 ? Math.min(1, received / total) : 0
          this.patch({ downloadProgress: ratio })
        }
      }
      try {
        reader.releaseLock()
      } catch {
        /* ignore */
      }

      if (received === 0) return
      const mimeType = stream.mimeType || 'audio/mp4'
      await putTrack({
        videoId,
        title: stream.title || 'Our song',
        mimeType,
        duration: stream.durationSec,
        blob: new Blob(parts, { type: mimeType }),
        bytes: received,
        totalBytes: received,
        complete: true,
        updatedAt: Date.now(),
      })
      if (generation === this.generation) this.patch({ downloadProgress: 1 })
    } catch {
      /* the cache is a nicety, never a blocker */
    }
  }

  /* -------------------------------------------------------- hidden fallback */

  private async playHiddenPlayer(videoId: string, generation: number): Promise<boolean> {
    if (this.embedState !== 'idle') return false
    this.embedState = 'loading'
    try {
      await loadYouTubeIframeApi()
      if (generation !== this.generation) {
        this.embedState = 'idle'
        return false
      }
      if (!hasYouTubeIframeApi()) {
        return await this.playPlainEmbed(videoId, generation)
      }
      return await this.createEmbedPlayer(videoId, generation)
    } catch {
      this.embedState = 'failed'
      return false
    }
  }

  private createEmbedPlayer(videoId: string, generation: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const w = window as unknown as {
        YT?: { Player: new (target: string | HTMLElement, options: Record<string, unknown>) => unknown }
      }
      const Player = w.YT?.Player
      if (!Player) {
        this.embedState = 'failed'
        resolve(false)
        return
      }

      this.embedHost?.remove()
      const host = document.createElement('div')
      host.id = `memory-lane-yt-${Math.random().toString(36).slice(2, 9)}`
      host.className = 'yt-audio-host'
      host.setAttribute('aria-hidden', 'true')
      document.body.appendChild(host)
      this.embedHost = host

      const epoch = ++this.embedEpoch
      let settled = false
      const timer = window.setTimeout(() => {
        if (settled) return
        this.embedState = 'failed'
        resolve(false)
      }, 14000)
      const settle = (value: boolean) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(value)
      }

      try {
        const player = new Player(host.id, {
          videoId,
          width: 2,
          height: 2,
          playerVars: {
            autoplay: 1,
            controls: 0,
            playsinline: 1,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            rel: 0,
            modestbranding: 1,
            color: 'transparent',
            origin: window.location.origin,
          },
          events: {
            onReady: (event: { target: EmbedPlayer }) => {
              const target = event.target
              target.setVolume?.(this.volume * 100)
              // Chrome only lets an iframe autoplay with sound when the frame
              // is allowed to. The player builds the iframe for us, so the
              // permission is granted here.
              try {
                const frame = target.getIframe?.()
                if (frame) frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture')
              } catch {
                /* ignore */
              }
              if (generation !== this.generation || epoch !== this.embedEpoch) {
                settle(false)
                return
              }
              // The direct stream already won the race, so drop the player.
              if (this.directWinning || (this.state.source === 'stream' && this.state.status === 'playing')) {
                this.stopEmbed()
                settle(false)
                return
              }
              try {
                target.playVideo?.()
              } catch {
                /* the state handler will sort it out */
              }
              // If the browser refuses to start with sound, muted playback is
              // always allowed — so mute it, let it run, then bring the sound
              // back. The music keeps playing from there.
              window.setTimeout(() => {
                if (settled || generation !== this.generation || epoch !== this.embedEpoch) return
                try {
                  if (target.isMuted?.() === false) {
                    target.muteVideo?.()
                    window.setTimeout(() => target.unMute?.(), 350)
                  }
                } catch {
                  /* ignore */
                }
              }, 1600)
              // Some browsers never report a state change; assume it works.
              window.setTimeout(() => {
                if (settled || generation !== this.generation || epoch !== this.embedEpoch) return
                this.embedState = 'playing'
                this.patch({ source: 'embed', status: 'playing', error: null })
                this.startProgressTimer()
                settle(true)
              }, 2600)
            },
            onStateChange: (event: { data: number; target: EmbedPlayer }) => {
              if (generation !== this.generation || epoch !== this.embedEpoch) return
              const data = event.data
              if (data === 0) {
                // The song ended: start it again so the hall never falls silent.
                event.target.seekTo?.(0, true)
                event.target.playVideo?.()
                return
              }
              if (data === 1) {
                this.embedState = 'playing'
                // If the muted fallback was used, the sound comes back now.
                try {
                  if (event.target.isMuted?.()) event.target.unMute?.()
                } catch {
                  /* ignore */
                }
                this.patch({ source: 'embed', status: 'playing', error: null })
                this.startProgressTimer()
                settle(true)
              } else if (data === 3) {
                this.patch({ status: 'downloading' })
              }
            },
            onError: () => {
              if (epoch !== this.embedEpoch) return
              this.embedState = 'failed'
              this.patch({ status: 'error', error: 'This song could not be played' })
              settle(false)
            },
          },
        })
        this.embedPlayer = player as unknown as EmbedPlayer
      } catch {
        this.embedState = 'failed'
        settle(false)
      }
    })
  }

  /** No player API available: a bare embed still autoplays the audio. */
  private playPlainEmbed(videoId: string, generation: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const host = document.createElement('div')
      host.className = 'yt-audio-host'
      host.setAttribute('aria-hidden', 'true')
      const frame = document.createElement('iframe')
      frame.src = embedUrl(videoId)
      frame.title = 'Our song'
      frame.allow = 'autoplay; encrypted-media; picture-in-picture'
      frame.setAttribute('frameborder', '0')
      host.appendChild(frame)
      document.body.appendChild(host)
      this.embedHost = host
      this.embedEpoch += 1
      this.embedState = 'playing'

      window.setTimeout(() => {
        if (generation !== this.generation) {
          resolve(false)
          return
        }
        this.patch({ source: 'embed', status: 'playing', error: null })
        this.startProgressTimer()
        resolve(true)
      }, 1400)
    })
  }

  private stopEmbed(): void {
    this.embedEpoch += 1
    try {
      this.embedPlayer?.pauseVideo?.()
    } catch {
      /* ignore */
    }
    this.embedPlayer = null
    this.embedHost?.remove()
    this.embedHost = null
    if (this.embedState !== 'failed') this.embedState = 'idle'
    this.stopProgressTimer()
  }

  /* ---------------------------------------------------------- blob playback */

  private async playBlob(blob: Blob): Promise<void> {
    const audio = this.audio
    if (!audio) return

    if (this.blobObjectUrl) URL.revokeObjectURL(this.blobObjectUrl)
    this.blobObjectUrl = URL.createObjectURL(blob)
    audio.src = this.blobObjectUrl
    audio.loop = true
    this.patch({ status: this.desiredPlay ? 'playing' : 'paused' })
    try {
      await audio.play()
      this.patch({ status: 'playing' })
    } catch {
      this.patch({ status: 'blocked' })
    }
  }

  /* ------------------------------------------------------------- progress */

  private startProgressTimer(): void {
    if (this.progressTimer !== null) return
    this.progressTimer = window.setInterval(() => {
      const player = this.embedPlayer
      if (!player?.getCurrentTime || !player.getDuration) return
      const duration = player.getDuration() || 0
      const current = player.getCurrentTime() || 0
      if (duration > 0) {
        this.patch({ duration, progress: Math.min(1, current / duration) })
      }
    }, 1000)
  }

  private stopProgressTimer(): void {
    if (this.progressTimer === null) return
    window.clearInterval(this.progressTimer)
    this.progressTimer = null
  }
}

/* ------------------------------------------------------------- utilities */

/** Resolves with the first truthy value, or false when every attempt failed. */
function firstTruthy(promises: Array<Promise<boolean>>): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let pending = promises.length
    if (pending === 0) {
      resolve(false)
      return
    }
    for (const promise of promises) {
      promise.then(
        (value) => {
          if (value) {
            resolve(true)
            return
          }
          pending -= 1
          if (pending === 0) resolve(false)
        },
        () => {
          pending -= 1
          if (pending === 0) resolve(false)
        },
      )
    }
  })
}

/** A 0.4s silent wav, used to arm autoplay inside the opening gesture. */
function createSilentWavUrl(): string {
  try {
    const sampleRate = 8000
    const samples = Math.floor(sampleRate * 0.4)
    const buffer = new ArrayBuffer(44 + samples)
    const view = new DataView(buffer)
    const writeAscii = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
    }
    writeAscii(0, 'RIFF')
    view.setUint32(4, 36 + samples, true)
    writeAscii(8, 'WAVE')
    writeAscii(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate, true)
    view.setUint16(32, 1, true)
    view.setUint16(34, 8, true)
    writeAscii(36, 'data')
    view.setUint32(40, samples, true)
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
  } catch {
    return ''
  }
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [meta, payload] = dataUrl.split(',')
    if (!meta || payload === undefined) return null
    const mimeMatch = meta.match(/data:([^;]+)/)
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
    const isBase64 = meta.includes('base64')
    let binary: string
    if (isBase64) {
      binary = atob(payload)
    } else {
      binary = decodeURIComponent(payload)
    }
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

export type { MusicStatus, MusicSource }

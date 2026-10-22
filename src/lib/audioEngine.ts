import type { MusicSource, MusicState, MusicStatus } from '../types'
import {
  clearChunks,
  getChunks,
  getTrack,
  putChunk,
  putTrack,
} from './idb'
import {
  codecForItag,
  loadYouTubeIframeApi,
  resolveAudioStream,
  type AudioStream,
} from './youtube'

const VOLUME_KEY = 'memoryLaneVolume'

interface StartOptions {
  videoId?: string | null
  /** IndexedDB key of a locally stored audio file */
  audioKey?: string | null
  audioFileName?: string
}

type Listener = (state: MusicState) => void

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
 *   3. direct stream – InnerTube hands us an `audio/mp4` URL; we stream it into
 *                      a MediaSource so it *plays while it downloads*, and we
 *                      mirror every chunk into IndexedDB so the next visit is
 *                      instant
 *   4. hidden player – a 200x200 off-screen YouTube iframe, audio only. No
 *                      YouTube chrome is ever visible.
 *
 * No visible YouTube player, ever.
 */
export class MusicEngine {
  private audio: HTMLAudioElement | null = null
  private mediaSource: MediaSource | null = null
  private sourceBuffer: SourceBuffer | null = null
  private mediaObjectUrl: string | null = null
  private blobObjectUrl: string | null = null
  private embedHost: HTMLDivElement | null = null
  private embedPlayer: { playVideo?: () => void; pauseVideo?: () => void; setVolume?: (v: number) => void; seekTo?: (s: number, allowSeekAhead?: boolean) => void; getCurrentTime?: () => number } | null = null
  private listeners = new Set<Listener>()
  private state: MusicState = { ...IDLE_STATE }
  private abort: AbortController | null = null
  private volume = 0.7
  private desiredPlay = true
  private currentKey: string | null = null

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
    if (this.audio) return
    const audio = new Audio()
    audio.preload = 'auto'
    audio.loop = true
    audio.crossOrigin = 'anonymous'
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
      if (this.state.source !== 'embed' && this.state.status !== 'error') {
        this.patch({ status: 'error', error: 'Playback failed' })
      }
    })

    // A MediaSource keeps the element "playing" (buffering) from the very first
    // frame, so later data can flow in without a second gesture.
    if (typeof MediaSource !== 'undefined') {
      try {
        const ms = new MediaSource()
        this.mediaSource = ms
        this.mediaObjectUrl = URL.createObjectURL(ms)
        audio.src = this.mediaObjectUrl
      } catch {
        this.mediaSource = null
      }
    }
    if (!this.mediaSource) {
      audio.src = createSilentWavUrl()
    }
    audio.play().catch(() => {
      /* autoplay blocked until the next gesture — handled by `retry()` */
    })
    this.patch({ status: 'arming' })
  }

  /** Kick off playback for the given source. Safe to call more than once. */
  async start(options: StartOptions): Promise<void> {
    const audioKey = options.audioKey?.trim() || null
    const videoId = options.videoId?.trim() || null
    const key = audioKey ? `idb:${audioKey}` : videoId ? `yt:${videoId}` : null

    if (!key) {
      this.patch({ status: 'none', source: 'none', error: null })
      return
    }
    const busy = this.state.status === 'playing' || this.state.status === 'downloading' || this.state.status === 'resolving'
    if (this.currentKey === key && busy) return
    this.currentKey = key

    this.stopStream()
    this.patch({
      status: 'resolving',
      source: 'none',
      downloadProgress: 0,
      progress: 0,
      duration: 0,
      error: null,
    })

    if (audioKey) {
      await this.startFromLocalFile(audioKey, options.audioFileName || 'Our song')
      return
    }
    if (videoId) {
      await this.startFromYouTube(videoId)
    }
  }

  /** Retry after the browser blocked playback until the user interacted. */
  async retry(): Promise<void> {
    if (this.state.status === 'blocked' || this.state.status === 'error') {
      const audio = this.audio
      if (audio) {
        try {
          await audio.play()
          this.patch({ status: 'playing', error: null })
          return
        } catch {
          /* keep going */
        }
      }
      if (this.state.source === 'embed' && this.embedPlayer?.playVideo) {
        this.embedPlayer.playVideo()
        this.patch({ status: 'playing', error: null })
      }
    }
  }

  async toggle(): Promise<void> {
    const audio = this.audio
    if (!audio) return
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

  getVolume(): number {
    return this.volume
  }

  dispose(): void {
    this.stopStream()
    this.listeners.clear()
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
      this.audio = null
    }
    if (this.mediaObjectUrl) URL.revokeObjectURL(this.mediaObjectUrl)
    if (this.blobObjectUrl) URL.revokeObjectURL(this.blobObjectUrl)
    this.mediaObjectUrl = null
    this.blobObjectUrl = null
    this.embedHost?.remove()
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

  private stopStream(): void {
    this.abort?.abort()
    this.abort = null
    try {
      if (this.sourceBuffer && this.mediaSource && this.mediaSource.readyState === 'open') {
        this.sourceBuffer.remove(0, this.sourceBuffer.buffered.length)
      }
    } catch {
      /* ignore */
    }
    this.sourceBuffer = null
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      try {
        this.mediaSource.endOfStream()
      } catch {
        /* ignore */
      }
    }
  }

  /* -------------------------------------------------------- local file path */

  private async startFromLocalFile(audioKey: string, name: string): Promise<void> {
    try {
      const cached = await getTrack(audioKey)
      const blob = cached?.complete ? cached.blob : null
      if (!blob || blob.size === 0) {
        this.patch({ status: 'none', source: 'none', error: 'That audio file is missing' })
        return
      }
      this.patch({ source: 'file', title: cached?.title || name, downloadProgress: 1 })
      await this.playBlob(blob, cached?.mimeType || 'audio/mpeg')
    } catch (err) {
      this.patch({ status: 'error', error: err instanceof Error ? err.message : 'Audio failed' })
    }
  }

  /* ----------------------------------------------------------- youtube path */

  private async startFromYouTube(videoId: string): Promise<void> {
    const cached = await getTrack(videoId)
    if (cached?.complete && cached.blob && cached.blob.size > 0) {
      this.patch({ source: 'cache', title: cached.title || 'Our song', downloadProgress: 1 })
      await this.playBlob(cached.blob, cached.mimeType || 'audio/mp4')
      return
    }

    let stream: AudioStream | null = null
    try {
      stream = await resolveAudioStream(videoId)
    } catch {
      stream = null
    }

    if (!stream) {
      await this.startWithEmbed(videoId)
      return
    }

    this.patch({
      source: 'stream',
      title: stream.title || 'Our song',
      duration: stream.durationSec,
      status: 'downloading',
    })

    try {
      await this.streamIntoCache(stream, videoId)
    } catch {
      // Streaming failed (CORS, offline, expired URL) — fall back to the
      // invisible YouTube player so the hall still has music.
      await this.startWithEmbed(videoId)
    }
  }

  private async streamIntoCache(stream: AudioStream, videoId: string): Promise<void> {
    const controller = new AbortController()
    this.abort = controller

    let startByte = 0
    let cachedChunks = await getChunks(videoId)
    if (cachedChunks.length) {
      startByte = cachedChunks.reduce((sum, c) => sum + c.data.byteLength, 0)
    }

    const headers: Record<string, string> = {}
    if (startByte > 0) headers.Range = `bytes=${startByte}-`

    const response = await fetch(stream.url, {
      headers,
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
    })

    if (!response.ok && response.status !== 206) {
      throw new Error(`Stream request failed (${response.status})`)
    }
    if (!response.body) throw new Error('Stream returned no body')

    // If the server ignored our Range header we would duplicate bytes.
    if (response.status !== 206 && startByte > 0) {
      cachedChunks = []
      startByte = 0
      await clearChunks(videoId)
    }

    const contentRange = response.headers.get('content-range')
    let totalBytes = stream.contentLength ?? 0
    if (contentRange) {
      const slash = contentRange.lastIndexOf('/')
      if (slash !== -1) {
        const parsedTotal = Number(contentRange.slice(slash + 1))
        if (Number.isFinite(parsedTotal) && parsedTotal > 0) totalBytes = parsedTotal
      }
    }

    const buffer = await this.ensureSourceBuffer(codecForItag(stream.itag))

    // The element was already armed during the click that opened the door;
    // nudge it once more in case the browser parked the first request.
    void this.audio?.play().catch(() => undefined)

    // Replay what we already have locally so the track starts immediately.
    for (const chunk of cachedChunks) {
      await appendToBuffer(buffer, new Uint8Array(chunk.data))
    }

    const parts: BlobPart[] = cachedChunks.map((c) => c.data)
    const reader = response.body.getReader()
    let received = startByte
    let seq = cachedChunks.length

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue

        received += value.byteLength
        const copy = value.slice()
        await appendToBuffer(buffer, copy)
        parts.push(copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength))
        await putChunk({
          id: `${videoId}:${seq}`,
          videoId,
          seq,
          data: copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength),
        })
        seq += 1

        const ratio = totalBytes > 0 ? Math.min(1, received / totalBytes) : 0
        this.patch({
          downloadProgress: ratio,
          status: this.desiredPlay ? 'playing' : 'paused',
        })
      }
    } finally {
      try {
        reader.releaseLock()
      } catch {
        /* ignore */
      }
    }

    const mimeType = stream.mimeType || 'audio/mp4'
    const blob = new Blob(parts, { type: mimeType })
    await putTrack({
      videoId,
      title: stream.title || 'Our song',
      mimeType,
      duration: stream.durationSec,
      blob,
      bytes: received,
      totalBytes: received,
      complete: true,
      updatedAt: Date.now(),
    })
    await clearChunks(videoId)

    this.patch({ downloadProgress: 1, status: this.desiredPlay ? 'playing' : 'paused' })
    if (this.desiredPlay) {
      await this.audio?.play().catch(() => {
        this.patch({ status: 'blocked' })
      })
    }
  }

  /* ---------------------------------------------------------- blob playback */

  private async playBlob(blob: Blob, mimeType: string): Promise<void> {
    const audio = this.audio
    if (!audio) return

    // Only fragmented-friendly MP4 can be pushed through a MediaSource; other
    // formats (an uploaded mp3, a wav) are played straight from their blob.
    const isMp4 = /audio\/mp4/i.test(mimeType) || /audio\/mp4/i.test(blob.type)

    if (isMp4 && this.mediaSource && this.mediaSource.readyState === 'open') {
      try {
        const buffer = await this.ensureSourceBuffer(codecForItag(140))
        const reader = blob.stream().getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) await appendToBuffer(buffer, value)
        }
        this.patch({ status: this.desiredPlay ? 'playing' : 'paused' })
        if (this.desiredPlay) {
          await audio.play().catch(() => this.patch({ status: 'blocked' }))
        }
        return
      } catch {
        /* fall through to the plain blob url */
      }
    }

    if (this.blobObjectUrl) URL.revokeObjectURL(this.blobObjectUrl)
    this.blobObjectUrl = URL.createObjectURL(blob)
    this.mediaSource = null
    this.sourceBuffer = null
    audio.src = this.blobObjectUrl
    audio.loop = true
    this.patch({ status: this.desiredPlay ? 'playing' : 'paused' })
    try {
      await audio.play()
    } catch {
      this.patch({ status: 'blocked' })
    }
  }

  /* ------------------------------------------------------------- MSE helper */

  private async ensureSourceBuffer(codecs: string[]): Promise<SourceBuffer> {
    if (this.sourceBuffer) return this.sourceBuffer
    const ms = this.mediaSource
    if (!ms) throw new Error('MediaSource unavailable')

    if (ms.readyState !== 'open') {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('MediaSource timeout')), 4000)
        ms.addEventListener(
          'sourceopen',
          () => {
            window.clearTimeout(timer)
            resolve()
          },
          { once: true },
        )
      })
    }

    let chosen = ''
    for (const codec of codecs) {
      try {
        if (MediaSource.isTypeSupported(codec)) {
          chosen = codec
          break
        }
      } catch {
        /* ignore */
      }
    }
    if (!chosen) throw new Error('No supported audio codec')

    const buffer = ms.addSourceBuffer(chosen)
    try {
      buffer.mode = 'sequence'
    } catch {
      /* sequence mode is best-effort */
    }
    this.sourceBuffer = buffer
    return buffer
  }

  /* -------------------------------------------------------- embed fallback */

  private async startWithEmbed(videoId: string): Promise<void> {
    this.patch({ source: 'embed', status: 'resolving', title: 'Our song' })
    await loadYouTubeIframeApi()
    const w = window as unknown as {
      YT?: {
        Player: new (
          target: string | HTMLElement,
          options: Record<string, unknown>,
        ) => unknown
      }
    }
    if (!w.YT?.Player) {
      this.patch({ status: 'none', source: 'none', error: 'Music unavailable' })
      return
    }

    this.embedHost?.remove()
    const host = document.createElement('div')
    host.id = `memory-lane-yt-${Math.random().toString(36).slice(2, 9)}`
    host.className = 'yt-audio-host'
    document.body.appendChild(host)
    this.embedHost = host

    const player = new w.YT.Player(host.id, {
      videoId,
      width: 200,
      height: 200,
      playerVars: {
        autoplay: 1,
        controls: 0,
        playsinline: 1,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: { target: { setVolume?: (v: number) => void; playVideo?: () => void } }) => {
          event.target.setVolume?.(this.volume * 100)
          event.target.playVideo?.()
          this.patch({ status: 'playing', downloadProgress: 1 })
        },
        onStateChange: (event: { data: number; target: { seekTo?: (s: number, a: boolean) => void; playVideo?: () => void } }) => {
          if (event.data === 0) {
            event.target.seekTo?.(0, true)
            event.target.playVideo?.()
          } else if (event.data === 1) {
            this.patch({ status: 'playing' })
          }
        },
        onError: () => {
          this.patch({ status: 'error', error: 'This song could not be played' })
        },
      },
    })
    this.embedPlayer = player as unknown as typeof this.embedPlayer
    window.setTimeout(() => {
      if (this.state.source === 'embed' && this.state.status === 'resolving') {
        this.patch({ status: 'playing' })
      }
    }, 2500)
  }
}

/* ------------------------------------------------------------- utilities */

function appendToBuffer(buffer: SourceBuffer, chunk: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const push = () => {
      try {
        buffer.appendBuffer(chunk)
        buffer.addEventListener('updateend', () => resolve(), { once: true })
        buffer.addEventListener('error', () => reject(new Error('appendBuffer failed')), { once: true })
      } catch (err) {
        reject(err instanceof Error ? err : new Error('appendBuffer failed'))
      }
    }
    if (buffer.updating) {
      buffer.addEventListener('updateend', push, { once: true })
    } else {
      push()
    }
  })
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
/** A 0.2s silent wav, used to arm autoplay when MediaSource is unavailable. */
function createSilentWavUrl(): string {
  try {
    const sampleRate = 8000
    const samples = Math.floor(sampleRate * 0.2)
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

export type { MusicStatus }

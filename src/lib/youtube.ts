/**
 * YouTube helpers.
 *
 * Two jobs:
 *  1. Pull a video id out of whatever link shape the user pasted.
 *  2. Ask YouTube's InnerTube player endpoint for a *direct* audio-only stream
 *     (`audio/mp4`, itag 140 / 139). Unlike the WEB client, the mobile clients
 *     hand back a plain `url` instead of a `signatureCipher`, so the browser can
 *     stream the audio itself without ever showing a YouTube player.
 *
 * Important: InnerTube answers with `access-control-allow-origin: <origin>`, so
 * the call works from any origin — but YouTube also rate-limits and bot-checks
 * aggressive clients, in which case it answers `403`. That is why the audio
 * engine never depends on this alone: the hidden YouTube player is always
 * started in parallel as a guaranteed fallback.
 */

export interface YouTubeMetadata {
  title: string
  thumbnail: string
}

/** Fetch video title and thumbnail from YouTube's public oEmbed API. */
export async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeMetadata> {
  const response = await fetchWithTimeout(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    {},
    10000,
  )
  if (!response.ok) throw new Error(`YouTube lookup failed ${response.status}`)
  const json = await response.json()
  return {
    title: json.title ?? 'YouTube video',
    thumbnail: json.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  }
}

export interface AudioStream {
  url: string
  mimeType: string
  itag: number
  bitrate: number
  durationSec: number
  contentLength: number | null
  title: string
  expiresInSeconds: number
}

/** The public key the YouTube web client uses. It only helps the WEB client. */
const WEB_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'

const PLAYER_ENDPOINTS = [
  'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
  'https://www.youtube-nocookie.com/youtubei/v1/player?prettyPrint=false',
  'https://music.youtube.com/youtubei/v1/player?prettyPrint=false',
]

interface ClientProfile {
  id: number
  label: string
  context: Record<string, unknown>
  headers: Record<string, string>
  /** Some clients refuse to answer without the public web key. */
  apiKey?: boolean
}

const CLIENTS: ClientProfile[] = [
  {
    id: 5,
    label: 'IOS',
    context: {
      clientName: 'IOS',
      clientVersion: '20.10.4',
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      osName: 'iPhone',
      osVersion: '18.3.2.22D82',
      hl: 'en',
      gl: 'US',
      platform: 'MOBILE',
    },
    headers: {
      'X-YouTube-Client-Name': '5',
      'X-YouTube-Client-Version': '20.10.4',
    },
  },
  {
    id: 3,
    label: 'ANDROID',
    context: {
      clientName: 'ANDROID',
      clientVersion: '20.10.38',
      androidSdkVersion: 30,
      osName: 'Android',
      osVersion: '11',
      hl: 'en',
      gl: 'US',
      platform: 'MOBILE',
    },
    headers: {
      'X-YouTube-Client-Name': '3',
      'X-YouTube-Client-Version': '20.10.38',
    },
  },
  {
    id: 30,
    label: 'ANDROID_TESTSUITE',
    context: {
      clientName: 'ANDROID_TESTSUITE',
      clientVersion: '1.9',
      androidSdkVersion: 30,
      osName: 'Android',
      osVersion: '11',
      hl: 'en',
      gl: 'US',
      platform: 'MOBILE',
    },
    headers: {
      'X-YouTube-Client-Name': '30',
      'X-YouTube-Client-Version': '1.9',
    },
  },
  {
    id: 2,
    label: 'MWEB',
    context: {
      clientName: 'MWEB',
      clientVersion: '2.20240726.01.00',
      hl: 'en',
      gl: 'US',
    },
    headers: {
      'X-YouTube-Client-Name': '2',
      'X-YouTube-Client-Version': '2.20240726.01.00',
    },
  },
  {
    id: 1,
    label: 'WEB',
    context: {
      clientName: 'WEB',
      clientVersion: '2.20240726.01.00',
      hl: 'en',
      gl: 'US',
    },
    headers: {
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': '2.20240726.01.00',
    },
    apiKey: true,
  },
  {
    id: 67,
    label: 'WEB_REMIX',
    context: {
      clientName: 'WEB_REMIX',
      clientVersion: '1.20240723.03.00',
      hl: 'en',
      gl: 'US',
    },
    headers: {
      'X-YouTube-Client-Name': '67',
      'X-YouTube-Client-Version': '1.20240723.03.00',
    },
    apiKey: true,
  },
]

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/

/** Pull an 11 character video id out of any YouTube link shape.
 *
 * Only accepts actual YouTube URLs (youtube.com, youtu.be, youtube-nocookie.com).
 * Random text is not treated as a video id.
 */
export function extractVideoId(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null

  let url: URL
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '').toLowerCase()
  const isYouTube = host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com') || host.endsWith('youtu.be')

  if (!isYouTube) return null

  const fromQuery = url.searchParams.get('v')
  if (fromQuery && VIDEO_ID_RE.test(fromQuery)) return fromQuery

  const segments = url.pathname.split('/').filter(Boolean)
  const patterns = ['embed', 'shorts', 'live', 'v', 'e']
  for (let i = 0; i < segments.length - 1; i += 1) {
    if (patterns.includes(segments[i]) && VIDEO_ID_RE.test(segments[i + 1])) {
      return segments[i + 1]
    }
  }
  if (segments.length === 1 && VIDEO_ID_RE.test(segments[0])) {
    return segments[0]
  }

  return null
}

interface RawFormat {
  itag?: number
  mimeType?: string
  bitrate?: number
  contentLength?: string
  url?: string
  signatureCipher?: string
  approxDurationMs?: string
  audioQuality?: string
}

interface RawPlayerResponse {
  playabilityStatus?: { status?: string; reason?: string }
  videoDetails?: { title?: string; lengthSeconds?: string; author?: string }
  streamingData?: {
    expiresInSeconds?: string
    adaptiveFormats?: RawFormat[]
    formats?: RawFormat[]
  }
}

/**
 * Prefer a plain AAC-LC stream inside an MP4 container: every browser can play
 * it and it is what MediaSource wants when we mirror it into the cache.
 */
function pickAudioFormat(formats: RawFormat[]): RawFormat | null {
  const usable = formats.filter(
    (f) =>
      typeof f.mimeType === 'string' &&
      typeof f.url === 'string' &&
      f.url.length > 0,
  )
  if (!usable.length) return null

  const mp4 = usable.filter((f) => (f.mimeType ?? '').startsWith('audio/mp4'))
  const pool = mp4.length ? mp4 : usable

  // itag 140 is 128 kbps AAC-LC — the sweet spot for a background track.
  const itag140 = pool.find((f) => f.itag === 140)
  if (itag140) return itag140

  const progressive = pool.filter((f) => !f.itag || f.itag === 139)
  const candidates = progressive.length ? progressive : pool
  return candidates.reduce((best, current) =>
    (current.bitrate ?? 0) > (best.bitrate ?? 0) ? current : best,
  )
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function queryClient(
  client: ClientProfile,
  videoId: string,
  budgetMs: number,
): Promise<RawPlayerResponse | null> {
  const payload: Record<string, unknown> = {
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
    context: { client: client.context },
  }
  if (client.apiKey) payload.apiKey = WEB_API_KEY

  const body = JSON.stringify(payload)
  const perCall = Math.max(1200, Math.min(4000, budgetMs))

  // First try a *simple* request: a text/plain body with no extra headers
  // needs no CORS preflight, and the preflight is exactly the request
  // YouTube is most likely to bot-check. The client lives in the body, so
  // the headers are not needed.
  for (const endpoint of PLAYER_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body,
          mode: 'cors',
          credentials: 'omit',
        },
        perCall,
      )
      if (!response.ok) continue
      const json = (await response.json()) as RawPlayerResponse
      if (json && json.playabilityStatus?.status === 'OK') return json
      if (json && json.streamingData) return json
    } catch {
      /* try the next endpoint / client */
    }
  }

  // Then the full request, with the client headers and the web api key.
  for (const endpoint of PLAYER_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(client.apiKey ? { 'X-Goog-Api-Key': WEB_API_KEY } : {}),
            ...client.headers,
          },
          body,
          mode: 'cors',
          credentials: 'omit',
        },
        perCall,
      )
      if (!response.ok) continue
      const json = (await response.json()) as RawPlayerResponse
      if (json && json.playabilityStatus?.status === 'OK') return json
      if (json && json.streamingData) return json
    } catch {
      /* try the next endpoint / client */
    }
  }
  return null
}

/**
 * Resolve a playable, direct audio-only stream for a YouTube video.
 * Returns null when every client is blocked or only ciphered URLs are offered.
 *
 * `timeoutMs` is the whole budget for the search: YouTube bot-checks some
 * origins, and the hidden player is already playing by then.
 */
export async function resolveAudioStream(
  videoId: string,
  timeoutMs = 7000,
): Promise<AudioStream | null> {
  if (!videoId) return null

  const deadline = Date.now() + timeoutMs

  for (const client of CLIENTS) {
    const remaining = deadline - Date.now()
    if (remaining <= 400) return null

    const json = await queryClient(client, videoId, remaining)
    if (!json) continue

    const streaming = json.streamingData
    const formats = [...(streaming?.adaptiveFormats ?? []), ...(streaming?.formats ?? [])]
    const format = pickAudioFormat(formats)
    if (!format?.url) continue

    const durationSec = format.approxDurationMs
      ? Math.round(Number(format.approxDurationMs) / 1000)
      : Number(json.videoDetails?.lengthSeconds ?? 0)

    return {
      url: format.url,
      mimeType: (format.mimeType ?? 'audio/mp4; codecs="mp4a.40.2"').split(';')[0].trim(),
      itag: format.itag ?? 140,
      bitrate: format.bitrate ?? 128000,
      durationSec: Number.isFinite(durationSec) ? durationSec : 0,
      contentLength: format.contentLength ? Number(format.contentLength) : null,
      title: json.videoDetails?.title ?? '',
      expiresInSeconds: Number(streaming?.expiresInSeconds ?? 0) || 21600,
    }
  }

  return null
}

/** Codec hint for MSE, derived from the itag YouTube handed us. */
export function codecForItag(itag: number): string[] {
  if (itag === 139) return ['audio/mp4; codecs="mp4a.40.5"', 'audio/mp4']
  return ['audio/mp4; codecs="mp4a.40.2"', 'audio/mp4']
}

/* ------------------------------------------------------------- the player */

let iframeApiPromise: Promise<void> | null = null

/** Loads the YouTube IFrame Player API once, used only as a last-resort fallback. */
export function loadYouTubeIframeApi(): Promise<void> {
  if (iframeApiPromise) return iframeApiPromise
  iframeApiPromise = new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      resolve()
      return
    }
    const w = window as unknown as { YT?: { Player?: unknown }; onYouTubeIframeAPIReady?: () => void }
    if (w.YT && typeof w.YT.Player === 'function') {
      resolve()
      return
    }
    const previous = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous()
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => resolve()
    document.head.appendChild(script)
    // Never hang the app on a blocked CDN.
    window.setTimeout(() => resolve(), 6000)
  })
  return iframeApiPromise
}

/** True when the IFrame Player API is on the page and usable. */
export function hasYouTubeIframeApi(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as { YT?: { Player?: unknown } }
  return Boolean(w.YT && typeof w.YT.Player === 'function')
}

/**
 * A plain embed URL. Used when the player API cannot be loaded — the iframe
 * still autoplays the audio on its own, we just cannot drive it.
 */
export function embedUrl(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    playsinline: '1',
    controls: '0',
    disablekb: '1',
    fs: '0',
    rel: '0',
    iv_load_policy: '3',
    modestbranding: '1',
    enablejsapi: '1',
    origin: typeof window !== 'undefined' ? window.location.origin : '',
  })
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

/** True when the browser says it can play the given mime type natively. */
export function canPlayMime(mime: string): boolean {
  try {
    const audio = new Audio()
    return Boolean(audio.canPlayType(mime))
  } catch {
    return false
  }
}

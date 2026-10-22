/**
 * YouTube helpers.
 *
 * Two jobs:
 *  1. Pull a video id out of whatever link shape the user pasted.
 *  2. Ask YouTube's InnerTube player endpoint for a *direct* audio-only stream
 *     (`audio/mp4`, itag 140 / 139). Unlike the WEB client, the mobile clients
 *     hand back a plain `url` instead of a `signatureCipher`, so the browser can
 *     stream and cache the audio itself without ever showing a YouTube player.
 */

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

const PLAYER_ENDPOINTS = [
  'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
  'https://release-youtubei.sandbox.googleapis.com/youtubei/v1/player?prettyPrint=false',
]

interface ClientProfile {
  id: number
  label: string
  context: Record<string, unknown>
  headers: Record<string, string>
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
    id: 85,
    label: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
    context: {
      clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
      clientVersion: '2.0',
      hl: 'en',
      gl: 'US',
      clientScreen: 'EMBED',
    },
    headers: {
      'X-YouTube-Client-Name': '85',
      'X-YouTube-Client-Version': '2.0',
    },
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
  },
]

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/

/** Pull an 11 character video id out of any YouTube link shape. */
export function extractVideoId(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null

  if (VIDEO_ID_RE.test(raw)) return raw

  let url: URL
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    const loose = raw.match(/[A-Za-z0-9_-]{11}/)
    return loose ? loose[0] : null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const isYouTube = host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com') || host.endsWith('youtu.be')

  if (!isYouTube) {
    const loose = raw.match(/[A-Za-z0-9_-]{11}/)
    return loose && /v=|youtu/.test(raw) ? loose[0] : null
  }

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

  const loose = raw.match(/[A-Za-z0-9_-]{11}/)
  return loose ? loose[0] : null
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

function pickAudioFormat(formats: RawFormat[]): RawFormat | null {
  const candidates = formats.filter(
    (f) =>
      typeof f.mimeType === 'string' &&
      f.mimeType.startsWith('audio/mp4') &&
      typeof f.url === 'string' &&
      f.url.length > 0,
  )
  if (!candidates.length) return null

  // itag 140 is 128 kbps AAC-LC — the sweet spot for a background track.
  const itag140 = candidates.find((f) => f.itag === 140)
  if (itag140) return itag140

  const progressive = candidates.filter((f) => !f.itag || f.itag === 139)
  const pool = progressive.length ? progressive : candidates
  return pool.reduce((best, current) =>
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

async function queryClient(client: ClientProfile, videoId: string): Promise<RawPlayerResponse | null> {
  const body = JSON.stringify({
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
    context: { client: client.context },
  })

  for (const endpoint of PLAYER_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...client.headers,
          },
          body,
          mode: 'cors',
          credentials: 'omit',
        },
        8000,
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
 */
export async function resolveAudioStream(videoId: string): Promise<AudioStream | null> {
  if (!videoId) return null

  for (const client of CLIENTS) {
    const json = await queryClient(client, videoId)
    if (!json) continue

    const streaming = json.streamingData
    const formats = [...(streaming?.adaptiveFormats ?? []), ...(streaming?.formats ?? [])]
    const format = pickAudioFormat(formats)
    if (!format?.url) continue

    const durationMs = Number(format.approxDurationMs ?? json.videoDetails?.lengthSeconds ?? 0) || 0
    const durationSec = format.approxDurationMs
      ? Math.round(Number(format.approxDurationMs) / 1000)
      : Number(json.videoDetails?.lengthSeconds ?? 0)

    return {
      url: format.url,
      mimeType: (format.mimeType ?? 'audio/mp4; codecs="mp4a.40.2"').split(';')[0].trim(),
      itag: format.itag ?? 140,
      bitrate: format.bitrate ?? 128000,
      durationSec: Number.isFinite(durationSec) ? durationSec : durationMs / 1000,
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

let iframeApiPromise: Promise<void> | null = null

/** Loads the YouTube IFrame Player API once, used only as a last-resort fallback. */
export function loadYouTubeIframeApi(): Promise<void> {
  if (iframeApiPromise) return iframeApiPromise
  iframeApiPromise = new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      resolve()
      return
    }
    const w = window as unknown as { YT?: { Player: unknown }; onYouTubeIframeAPIReady?: () => void }
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

/** True when the browser says it can play the given mime type natively. */
export function canPlayMime(mime: string): boolean {
  try {
    const audio = new Audio()
    return Boolean(audio.canPlayType(mime))
  } catch {
    return false
  }
}

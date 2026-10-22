/**
 * Runtime checks for the music engine: the ladder that decides what plays
 * when. Everything YouTube related is faked, so the behaviour is deterministic.
 */

export {}

/* --------------------------------------------------------------- test rig */

class FakeAudio {
  src = ''
  currentTime = 0
  duration = 0
  paused = true
  loop = false
  volume = 1
  preload = ''
  /** When true every play() is refused, the way a phone blocks autoplay. */
  static blocked = false
  private listeners: Record<string, Array<() => void>> = {}

  addEventListener(name: string, fn: () => void) {
    this.listeners[name] = this.listeners[name] ?? []
    this.listeners[name].push(fn)
  }
  removeEventListener() {}
  setAttribute() {}
  async play() {
    if (FakeAudio.blocked) throw new Error('NotAllowedError')
    this.paused = false
    return undefined
  }
  pause() {
    this.paused = true
  }
  load() {}
}

class FakePlayer {
  static instances: FakePlayer[] = []
  private options: Record<string, any>
  private playing = false
  constructor(_target: string, options: Record<string, any>) {
    if (failEmbed) throw new Error('The player cannot be created')
    this.options = options
    FakePlayer.instances.push(this)
    // The real API calls onReady a moment later.
    setTimeout(() => options.events?.onReady?.({ target: this.api() }), 10)
  }
  api() {
    return {
      playVideo: () => {
        this.playing = true
        this.options.events?.onStateChange?.({ data: 1, target: this.api() })
      },
      pauseVideo: () => {
        this.playing = false
      },
      setVolume: () => {},
      seekTo: () => {},
      getCurrentTime: () => 0,
      getDuration: () => 0,
    }
  }
  get isPlaying() {
    return this.playing
  }
}

const players: FakePlayer[] = []

const globals = globalThis as unknown as Record<string, any>
globals.window = {
  addEventListener() {},
  removeEventListener() {},
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (id: number) => clearTimeout(id),
  setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
  clearInterval: (id: number) => clearInterval(id),
  location: { origin: 'http://localhost:5173' },
  YT: { Player: FakePlayer },
}
globals.document = {
  createElement: (tag: string) => {
    if (failEmbed && tag === 'iframe') throw new Error('The player cannot be created')
    const element = {
      tagName: tag,
      id: '',
      className: '',
      src: '',
      async: false,
      onerror: null,
      onload: null,
      style: {},
      children: [] as any[],
      setAttribute() {},
      appendChild(child: any) {
        this.children.push(child)
      },
      remove() {
        removed.push(this)
      },
    }
    return element
  },
  head: { appendChild() {} },
  body: { appendChild() {} },
}
globals.Audio = FakeAudio
globals.localStorage = {
  store: {} as Record<string, string>,
  getItem(key: string) {
    return this.store[key] ?? null
  },
  setItem(key: string, value: string) {
    this.store[key] = value
  },
  removeItem(key: string) {
    delete this.store[key]
  },
}
globals.URL.createObjectURL = () => 'blob:fake'
globals.URL.revokeObjectURL = () => {}

const removed: any[] = []

/** When true the hidden player cannot be created at all. */
let failEmbed = false

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) {
    failures += 1
    console.log(`FAIL  ${name}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`)
  } else {
    console.log(`ok    ${name}`)
  }
}

const innerTubeOk = {
  playabilityStatus: { status: 'OK' },
  videoDetails: { title: 'Esremborak - Mahal Magmahal', lengthSeconds: '296' },
  streamingData: {
    expiresInSeconds: '21600',
    adaptiveFormats: [
      {
        itag: 140,
        mimeType: 'audio/mp4; codecs="mp4a.40.2"',
        bitrate: 130824,
        contentLength: '4784970',
        approxDurationMs: '296000',
        url: 'https://rr1---sn-test.googlevideo.com/videoplayback?itag=140',
      },
    ],
  },
}

function installFetch(innerTubeWorks: boolean, streamWorks = true) {
  globals.fetch = async (url: string) => {
    if (String(url).includes('youtubei/v1/player')) {
      if (!innerTubeWorks) {
        return new Response('<html>bot check</html>', { status: 403 })
      }
      return new Response(JSON.stringify(innerTubeOk), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (String(url).includes('googlevideo')) {
      if (!streamWorks) return new Response('nope', { status: 500 })
      const body = new Uint8Array(2048)
      return new Response(body, { status: 200 })
    }
    return new Response('', { status: 404 })
  }
}

/* ----------------------------------------------------------------- tests */

const { MusicEngine } = await import('../src/lib/audioEngine.ts')

// 1. InnerTube answers: the direct stream wins and the hidden player is dropped.
{
  installFetch(true)
  players.length = 0
  const engine = new MusicEngine()
  engine.arm()
  await engine.start({ videoId: 'MLHCPeyp0Kg' })
  await new Promise((r) => setTimeout(r, 120))
  const state = engine.getState()
  check('direct stream becomes the source', state.source, 'stream')
  check('direct stream is playing', state.status, 'playing')
  check('the song title is known', state.title, 'Esremborak - Mahal Magmahal')
  engine.dispose()
}

// 2. InnerTube is bot-checked: the hidden player takes over.
{
  installFetch(false)
  players.length = 0
  const engine = new MusicEngine()
  engine.arm()
  await engine.start({ videoId: 'MLHCPeyp0Kg' })
  await new Promise((r) => setTimeout(r, 200))
  const state = engine.getState()
  check('hidden player takes over when InnerTube is blocked', state.source, 'embed')
  check('hidden player reports playing', state.status, 'playing')
  check('a hidden player was created', FakePlayer.instances.length > 0, true)
  engine.dispose()
}

// 3. InnerTube answers but the stream cannot be fetched: still playable.
{
  installFetch(true, false)
  players.length = 0
  const engine = new MusicEngine()
  engine.arm()
  await engine.start({ videoId: 'MLHCPeyp0Kg' })
  await new Promise((r) => setTimeout(r, 200))
  const state = engine.getState()
  check('the music still plays when the cache download fails', state.status, 'playing')
  engine.dispose()
}

// 4. No player API and no InnerTube: a bare embed still plays the song.
{
  installFetch(false)
  globals.window.YT = undefined as any
  const engine = new MusicEngine()
  engine.arm()
  await engine.start({ videoId: 'MLHCPeyp0Kg' })
  const state = engine.getState()
  check('a bare embed plays without the player API', state.status, 'playing')
  globals.window.YT = { Player: FakePlayer } as any
  engine.dispose()
}

// 5. Toggling pauses and resumes.
{
  installFetch(true)
  const engine = new MusicEngine()
  engine.arm()
  await engine.start({ videoId: 'MLHCPeyp0Kg' })
  await engine.toggle()
  check('toggle pauses', engine.getState().status, 'paused')
  await engine.toggle()
  check('toggle resumes', engine.getState().status, 'playing')
  engine.dispose()
}

// 6. The phone refuses to autoplay: the visitor is told, and one tap fixes it.
{
  installFetch(true)
  FakeAudio.blocked = true
  failEmbed = true
  const engine = new MusicEngine()
  engine.arm()
  await engine.start({ videoId: 'MLHCPeyp0Kg' })
  check('a blocked player says so', engine.getState().status, 'blocked')
  FakeAudio.blocked = false
  failEmbed = false
  await engine.retry()
  check('a tap starts the music', engine.getState().status, 'playing')
  engine.dispose()
}

// 7. Nothing worked at all: a tap starts the whole ladder again.
{
  installFetch(false)
  failEmbed = true
  const engine = new MusicEngine()
  engine.arm()
  await engine.start({ videoId: 'MLHCPeyp0Kg' })
  check('a dead song reports an error', engine.getState().status, 'error')
  installFetch(true)
  failEmbed = false
  await engine.retry()
  await new Promise((r) => setTimeout(r, 150))
  check('a tap tries the song again', engine.getState().status, 'playing')
  engine.dispose()
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)

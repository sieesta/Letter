/**
 * Renders the app once on the server to catch anything that blows up while
 * the component tree is being drawn: a bad hook, a missing property, a
 * component that reads the window in a way that throws.
 */

export {}

const globals = globalThis as unknown as Record<string, any>

globals.window = {
  addEventListener() {},
  removeEventListener() {},
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (id: number) => clearTimeout(id),
  setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
  clearInterval: (id: number) => clearInterval(id),
  location: { origin: 'http://localhost:5173', href: 'http://localhost:5173/' },
  innerWidth: 1440,
  innerHeight: 900,
  devicePixelRatio: 2,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  navigator: { userAgent: 'node', maxTouchPoints: 0 },
  requestAnimationFrame: (fn: FrameRequestCallback) => setTimeout(() => fn(0), 16) as unknown as number,
  cancelAnimationFrame: (id: number) => clearTimeout(id),
  scrollTo() {},
}
try {
  Object.defineProperty(globals, 'navigator', {
    value: { userAgent: 'node', maxTouchPoints: 0 },
    configurable: true,
  })
} catch {
  /* node already defines a navigator we can live with */
}
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
globals.indexedDB = undefined
globals.Audio = class {
  play() {
    return Promise.resolve()
  }
  pause() {}
  addEventListener() {}
  removeEventListener() {}
  setAttribute() {}
}

const React = (await import('react')).default
const { renderToString } = await import('react-dom/server')
const App = (await import('../src/App.tsx')).default

let failures = 0

function check(name: string, condition: boolean) {
  if (!condition) {
    failures += 1
    console.log(`FAIL  ${name}`)
  } else {
    console.log(`ok    ${name}`)
  }
}

let html = ''
try {
  html = renderToString(React.createElement(App))
  check('the app renders without throwing', true)
} catch (err) {
  check('the app renders without throwing', false)
  console.log(`      ${(err as Error).message}`)
}

check('the boot screen is drawn', html.includes('app__boot'))
check('no orientation prompt is left', !html.includes('orientation-hint'))

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)

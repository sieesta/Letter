/**
 * Logic checks for the parts that cannot be seen in a screenshot:
 * link parsing, the typewriter rhythm and the layout geometry.
 */
import { extractVideoId } from '../src/lib/youtube.ts'
import { buildLayout, HALL } from '../src/components/hall/geometry.ts'

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

/* ------------------------------------------------------------ link parsing */

check('plain watch url', extractVideoId('https://www.youtube.com/watch?v=MLHCPeyp0Kg'), 'MLHCPeyp0Kg')
check('watch url with extras', extractVideoId('https://www.youtube.com/watch?v=MLHCPeyp0Kg&t=42s&list=PL123'), 'MLHCPeyp0Kg')
check('short url', extractVideoId('https://youtu.be/MLHCPeyp0Kg'), 'MLHCPeyp0Kg')
check('embed url', extractVideoId('https://www.youtube.com/embed/MLHCPeyp0Kg'), 'MLHCPeyp0Kg')
check('shorts url', extractVideoId('https://www.youtube.com/shorts/MLHCPeyp0Kg'), 'MLHCPeyp0Kg')
check('bare id', extractVideoId('MLHCPeyp0Kg'), 'MLHCPeyp0Kg')
check('mobile url', extractVideoId('https://m.youtube.com/watch?v=MLHCPeyp0Kg'), 'MLHCPeyp0Kg')
check('nocookie url', extractVideoId('https://www.youtube-nocookie.com/embed/MLHCPeyp0Kg'), 'MLHCPeyp0Kg')
check('empty', extractVideoId(''), null)
check('nonsense', extractVideoId('not a link'), null)

/* ------------------------------------------------------------- typewriter */

/** The reveal schedule used by useTypewriter, mirrored here for the check. */
function revealedAt(text: string, seconds: number, speed: number): string {
  const chars = Array.from(text)
  const marks: number[] = []
  let acc = 0
  for (const char of chars) {
    acc += /[.,!?;:]/.test(char) ? 6 : /[—–\n]/.test(char) ? 10 : 1
    marks.push(acc)
  }
  const units = seconds * speed
  let revealed = 0
  while (revealed < marks.length && marks[revealed] <= units) revealed += 1
  return chars.slice(0, revealed).join('')
}

const line = 'The first summer we watched the sea.'
check('typewriter starts empty', revealedAt(line, 0, 30), '')
check('typewriter advances', revealedAt(line, 1, 30).length > 0, true)
check('typewriter finishes', revealedAt(line, 30, 30), line)
check('typewriter is monotonic', revealedAt(line, 0.5, 30).length <= revealedAt(line, 1, 30).length, true)
check(
  'punctuation slows the rhythm',
  revealedAt('one. two', 0.2, 30).length < revealedAt('one two', 0.2, 30).length,
  true,
)

/* --------------------------------------------------------------- geometry */

const photos = Array.from({ length: 6 }, (_, i) => ({
  id: `p${i}`,
  src: `data:image/png;base64,${i}`,
  caption: `memory ${i}`,
  date: `2024-0${i + 1}`,
}))
const layout = buildLayout(photos)
check('one slot per photo', layout.slots.length, photos.length)
check('slots ascend in depth', layout.slots.map((s) => s.z).every((z, i, all) => i === 0 || z < all[i - 1]), true)
check('prints stay inside the room', layout.slots.every((s) => Math.abs(s.x) <= HALL.wallX), true)
check('prints hang below the line', layout.slots.every((s) => s.y > s.hangY), true)
check('photo distances ascend', layout.photoDistances.every((d, i, all) => i === 0 || d > all[i - 1]), true)

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)

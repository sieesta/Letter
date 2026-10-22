# Memory Lane 💌

A private **hallway of photographs hanging on strings**, made for one person.

You walk down a dark corridor. Prints sway on two long clotheslines and on
cross-garlands strung across the hall, each one lit by a lamp and captioned in
your own words. The song starts playing the moment she walks in — no YouTube
player, no buttons, no setup. At the end of the hall there is a door, a
message, and a link.

Everything lives on the device. Nothing is uploaded.

## How it works

| Piece | What it does |
|------|--------------|
| **The hall** (`src/components/hall/`) | A CSS-3D corridor: floor, ceiling, two walls, two sagging clotheslines, catenary garlands, ceiling lamps, light shafts, dust and fog. The camera dollies down it. |
| **The camera** | Scroll, drag, `↑ ↓ ← →` or `W A S D` to walk. It glides on its own by default, slowing to a stop in front of every print. The pointer leans the view. |
| **The prints** | Each photo hangs from a peg on a wire, swings on a pendulum, lifts on hover and opens a caption card when clicked. |
| **The quote** (`src/components/hall/QuoteCard.tsx`) | The card that opens on click: the photograph, the date, and the words — typed out letter by letter, with a blinking caret. Tap the card to finish the sentence at once. |
| **The music** (`src/lib/audioEngine.ts`) | A hidden, off-screen player. No YouTube chrome is ever visible. |
| **The setup** (`src/components/SetupScreen.tsx`) | Name, title, message, photos with captions and dates, song, and a link for the end. |
| **The gate** (`src/components/DesktopModeGate.tsx`) | A phone is too narrow for a corridor, so a phone is asked to open the desktop version of the site. The gate lifts itself the moment the wide viewport appears. |

## Phones and the desktop site

The hall is drawn wide, like a real corridor. On a phone in portrait it
collapses into a postage stamp, so instead of asking for a landscape rotation
the app asks for the **desktop site** and explains how to switch it on:

- **Safari on iPhone/iPad** — Share → *Request Desktop Website*
- **Chrome on Android** — ⋮ → *Desktop site*

The gate watches the viewport width, so the moment the desktop version is
active it disappears on its own. A quiet “continue on the phone anyway” link
is kept at the bottom for the curious.

## The music, in detail

The song is the part that needs the most care, so it runs down a ladder and
never fails to produce sound:

1. **Local cache** — the track was already fetched on a previous visit, so it
   starts instantly from IndexedDB.
2. **Local file** — you uploaded an audio file instead of pasting a link.
3. **Direct stream** — YouTube's InnerTube `player` endpoint is asked for an
   `audio/mp4` stream using the mobile clients, which return a plain URL
   instead of a `signatureCipher`. That URL is handed straight to the media
   element, so it **plays while it streams**, and the bytes are mirrored into
   IndexedDB in the background. A later visit starts instantly and without
   adverts.
4. **Hidden player** — if YouTube refuses to answer the browser (it bot-checks
   some origins, and answers `403`), a 2×2 YouTube iframe is mounted in the
   corner and used for audio only. It is two pixels wide and effectively
   invisible, but it stays **inside the viewport**: iOS Safari stops playing
   an iframe that is parked off screen.

Steps 3 and 4 start at the same time and the first one that really plays takes
over, so the song never waits on a network round trip.

The browser's autoplay policy is satisfied because the media element is armed
*inside* the click that opens the door, so the music starts with the walk-in
rather than after it. If a browser still refuses, any tap in the hall retries
the playback, and the dock turns into a pulsing “tap to start” button.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:lan    # same, reachable from a phone on the wifi
npm run build      # production build into dist/
npm run preview    # serve the production build
npm run check      # typecheck + the logic and music checks
```

Deploy `dist/` to GitHub Pages, Netlify or Vercel.

## Where things live

```
src/
├── App.tsx                     # phase machine: setup → threshold → entering → hall
├── types.ts
├── lib/
│   ├── audioEngine.ts          # the music ladder: cache → file → stream → hidden player
│   ├── youtube.ts              # link parsing + InnerTube audio resolution
│   ├── useTypewriter.ts        # letter by letter text, with punctuation pauses
│   ├── idb.ts                  # IndexedDB: profile, tracks, resumable chunks
│   ├── image.ts                # downscale photos, read audio files
│   └── useMusic.ts
└── components/
    ├── SetupScreen.tsx         # the creator panel
    ├── ThresholdScreen.tsx     # the door: one button, then the hall opens
    ├── EnterSequence.tsx       # the loading animation at the threshold
    ├── MusicDock.tsx           # the only visible music control
    ├── DesktopModeGate.tsx     # asks a phone for the desktop site
    └── hall/
        ├── Hallway.tsx         # the scene, the camera, the input
        ├── HallHud.tsx         # title bar, timeline, the finale
        ├── QuoteCard.tsx       # the typed-out caption card
        ├── HangingPhoto.tsx    # a print clipped to a string
        ├── Polyline.tsx        # strings drawn in 3D
        └── geometry.ts         # corridor measurements and the layout rhythm
```

## Shortcuts

| Key | Action |
|-----|--------|
| `↑` `↓` / `W` `S` | walk forward and back |
| `←` `→` / `A` `D` | strafe |
| `Space` | pause or resume the automatic walk |
| `Esc` | step back from a print |
| `Shift` + arrows | move faster |

On a phone, swipe up and down to walk and tap a picture to linger.

---

Built with love ❤️

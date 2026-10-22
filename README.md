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
| **The hall** (`src/components/hall/`) | A CSS-3D corridor: floor, ceiling, two walls, two sagging clotheslines, catenary garlands, ceiling lamps, dust and fog. The camera dollies down it. |
| **The camera** | Scroll, drag, `↑ ↓ ← →` or `W A S D` to walk. It glides on its own by default, slowing to a stop in front of every print. The pointer leans the view. |
| **The prints** | Each photo hangs from a peg on a wire, swings on a pendulum, lifts on hover and opens a caption card when clicked. |
| **The music** (`src/lib/audioEngine.ts`) | A hidden, off-screen player. No YouTube chrome is ever visible. |
| **The setup** (`src/components/SetupScreen.tsx`) | Name, title, message, photos with captions and dates, song, and a link for the end. |

## The music, in detail

The song is the part that needs the most care, so it runs down a ladder and
never fails to produce sound:

1. **Local cache** — the track was already fetched on a previous visit, so it
   starts instantly from IndexedDB.
2. **Local file** — you uploaded an audio file instead of pasting a link.
3. **Direct stream** — YouTube's InnerTube `player` endpoint is asked for an
   `audio/mp4` stream using the mobile clients, which return a plain URL
   instead of a `signatureCipher`. The audio is streamed into a
   `MediaSource` (`mode: 'sequence'`), so it **plays while it downloads**, and
   every chunk is mirrored into IndexedDB as it arrives. A partial download
   resumes with an HTTP `Range` request next time.
4. **Hidden player** — if anything above fails, a 200×200 YouTube iframe is
   mounted off-screen and used for audio only.

The browser's autoplay policy is satisfied because the media element is armed
*inside* the click that opens the door, so the music starts with the walk-in
rather than after it.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:lan    # same, reachable from a phone on the wifi
npm run build      # production build into dist/
npm run preview    # serve the production build
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
│   ├── idb.ts                  # IndexedDB: profile, tracks, resumable chunks
│   ├── image.ts                # downscale photos, read audio files
│   └── useMusic.ts
└── components/
    ├── SetupScreen.tsx         # the creator panel
    ├── ThresholdScreen.tsx     # the door: one button, then the hall opens
    ├── EnterSequence.tsx       # the loading animation at the threshold
    ├── MusicDock.tsx           # the only visible music control
    └── hall/
        ├── Hallway.tsx         # the scene, the camera, the input
        ├── HallHud.tsx         # title bar, timeline, captions, the finale
        ├── HangingPhoto.tsx     # a print clipped to a string
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

---

Built with love ❤️

# Memory Lane Hunt 💌

A romantic website / scavenger hunt built with **React**, **Framer Motion**, **Tailwind CSS**, and **Vite**. It lets you create a personalized interactive experience where your girlfriend uploads a photo, writes a message, then explores six memory rooms one by one, ending with a finale reveal.

## What's Inside

| Feature | Tech Stack |
|---------|-----------|
| Photo upload + profile form | React Hooks + FileReader API |
| Six themed memory rooms | React Components + Framer Motion |
| Page transitions (morphing/blur) | Framer Motion `AnimatePresence` |
| Local persistence | `localStorage` |
| Responsive design | Tailwind CSS |
| Build tool | Vite |

## Folder Structure

```
memory-lane-hunt/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── package.json
├── index.css
├── src/
│   ├── main.jsx              # Entry point
│   ├── App.jsx               # App state & routing
│   ├── index.css             # Global styles + custom animations
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx    # Animated button component
│   │   │   ├── Container.tsx # Centered max-width container
│   │   │   ├── Room.tsx      # Base room wrapper
│   │   │   └── StepCard.tsx  # Glassmorphism card
│   │   └── rooms/
│   │       ├── index.ts      # Room exports
│   │       ├── UploadStep.tsx # Photo + name + message form
│   │       ├── IntroStep.tsx  # Welcome screen with user's photo
│   │       ├── FoyerRoom.tsx # Door opening animation
│   │       ├── LivingRoomRoom.tsx # First memory reveal
│   │       ├── KitchenRoom.tsx  # Coffee brewing interaction
│   │       ├── BedroomRoom.tsx   # Hug counter
│   │       ├── GarageRoom.tsx    # Road trip slider
│   │       └── FinaleRoom.tsx    # Morphing finale
```

## How to Run

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:5173`

3. **Build for production**
   ```bash
   npm run build
   ```
   Output goes to `dist/`

4. **Preview production build**
   ```bash
   npm run preview
   ```

## Customizing

- **Edit `ROOMS` array** in `App.jsx` to add/remove rooms or change icons/labels.
- **Edit messages** inside each `Room*.tsx` file to make them personal to your relationship.
- **Change colors** in `tailwind.config.js` (ember, wine, dusk palettes).
- **Swap emojis** for your own photos by replacing the emoji `<div>`s with `` tags.

## Deployment

Deploy the `dist/` folder to:
- **GitHub Pages** (free)
- **Netlify** (drag & drop `dist/`)
- **Vercel** (connect GitHub repo)

---

Built with love ❤️

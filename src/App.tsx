import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadStep } from './components/rooms/UploadStep'
import { IntroStep } from './components/rooms/IntroStep'
import { FoyerRoom } from './components/rooms/FoyerRoom'
import { LivingRoomRoom } from './components/rooms/LivingRoomRoom'
import { KitchenRoom } from './components/rooms/KitchenRoom'
import { BedroomRoom } from './components/rooms/BedroomRoom'
import { GarageRoom } from './components/rooms/GarageRoom'
import { FinaleRoom } from './components/rooms/FinaleRoom'

const ROOMS = [
  { id: 'foyer', icon: '🚪', label: 'Welcome' },
  { id: 'living', icon: '🛋️', label: 'Living' },
  { id: 'kitchen', icon: '🍳', label: 'Kitchen' },
  { id: 'bedroom', icon: '🛏️', label: 'Bedroom' },
  { id: 'garage', icon: '🚗', label: 'Road Trip' },
  { id: 'finale', icon: '✨', label: 'Finale' },
]

export default function App() {
  const [step, setStep] = useState<'upload' | 'intro' | 'rooms'>('upload')
  const [profile, setProfile] = useState<{
    name: string
    message: string
    photo: string | null
  } | null>(null)
  const [currentRoom, setCurrentRoom] = useState<string>('foyer')

  // Restore a previously created hunt (so you can preview it again later)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('memoryLaneProfile')
      if (saved) {
        setProfile(JSON.parse(saved))
        setStep('intro')
      }
    } catch {
      /* ignore malformed storage */
    }
  }, [])

  const handleProfileSave = (data: {
    name: string
    message: string
    photo: string | null
  }) => {
    setProfile(data)
    try {
      localStorage.setItem('memoryLaneProfile', JSON.stringify(data))
    } catch {
      /* storage may be unavailable (private mode / quota) */
    }
    setStep('intro')
  }

  const roomFor = (id: string) => {
    switch (id) {
      case 'foyer':
        return <FoyerRoom name={profile!.name} onComplete={() => setCurrentRoom('living')} />
      case 'living':
        return (
          <LivingRoomRoom name={profile!.name} onComplete={() => setCurrentRoom('kitchen')} />
        )
      case 'kitchen':
        return (
          <KitchenRoom name={profile!.name} onComplete={() => setCurrentRoom('bedroom')} />
        )
      case 'bedroom':
        return (
          <BedroomRoom name={profile!.name} onComplete={() => setCurrentRoom('garage')} />
        )
      case 'garage':
        return <GarageRoom name={profile!.name} onComplete={() => setCurrentRoom('finale')} />
      case 'finale':
        return (
          <FinaleRoom
            name={profile!.name}
            message={profile!.message}
            onReset={() => setCurrentRoom('foyer')}
          />
        )
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen bg-dusk-50 text-dusk-950 overflow-x-hidden">
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
            transition={{ duration: 0.5 }}
            className="min-h-screen flex items-center justify-center px-4 py-8"
          >
            <UploadStep onComplete={handleProfileSave} />
          </motion.div>
        )}

        {step === 'intro' && profile && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
            transition={{ duration: 0.6 }}
            className="min-h-screen flex items-center justify-center px-4 py-8"
          >
            <IntroStep
              name={profile.name}
              message={profile.message}
              photo={profile.photo}
              onStart={() => {
                setStep('rooms')
                setCurrentRoom('foyer')
              }}
            />
          </motion.div>
        )}

        {step === 'rooms' && profile && (
          <motion.div
            key="rooms"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="min-h-screen flex flex-col items-center px-4 py-8"
          >
            <motion.nav
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex gap-2 sm:gap-3 justify-center mb-8 flex-wrap max-w-3xl"
            >
              {ROOMS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setCurrentRoom(r.id)}
                  aria-current={currentRoom === r.id}
                  className={`px-4 py-2 rounded-full font-medium transition-all duration-300 ${
                    currentRoom === r.id
                      ? 'bg-ember-500 text-white shadow-glow-ember scale-105'
                      : 'bg-white/70 text-dusk-700 hover:bg-white/90 hover:scale-105'
                  }`}
                >
                  <span aria-hidden>{r.icon}</span> {r.label}
                </button>
              ))}
            </motion.nav>

            <div className="w-full max-w-3xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentRoom}
                  initial={{ opacity: 0, scale: 0.94, filter: 'blur(12px)', y: 24 }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
                  exit={{ opacity: 0, scale: 1.06, filter: 'blur(12px)', y: -24 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  {roomFor(currentRoom)}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

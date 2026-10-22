import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RoomShell } from '../ui'

interface FoyerRoomProps {
  name: string
  onComplete: () => void
}

export function FoyerRoom({ name, onComplete }: FoyerRoomProps) {
  const [doorOpen, setDoorOpen] = useState(false)

  return (
    <RoomShell
      eyebrow="Room 01 — The Threshold"
      title="The Front Door"
      subtitle="Every love story starts with one knock on a door. This one is yours to open."
      backdrop="bg-gradient-to-br from-ember-100 via-rose-50 to-wine-100"
      accent="text-ember-600"
      footer={
        <div className="flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!doorOpen ? (
              <motion.button
                key="open"
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setDoorOpen(true)}
                className="px-8 py-4 rounded-full bg-dusk-900 text-white font-medium shadow-xl hover:bg-dusk-800 transition-colors"
              >
                Knock on the door
              </motion.button>
            ) : (
              <motion.button
                key="enter"
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={onComplete}
                className="px-8 py-4 rounded-full bg-gradient-to-r from-ember-500 to-wine-500 text-white font-medium shadow-glow-ember"
              >
                Step inside →
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      }
    >
      <div className="relative flex items-center justify-center py-6 sm:py-12">
        {/* Light spill behind the door */}
        <motion.div
          animate={{
            opacity: doorOpen ? 0.9 : 0,
            scale: doorOpen ? 1.6 : 0.8,
          }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="absolute w-64 h-96 rounded-[50%] bg-gradient-to-t from-gold-200 via-gold-300/60 to-transparent blur-2xl"
        />

        {/* Door */}
        <motion.div
          className="relative"
          animate={{ rotateY: doorOpen ? -72 : 0, x: doorOpen ? -60 : 0 }}
          transition={{ duration: 1.2, type: 'spring', stiffness: 70, damping: 16 }}
          style={{ transformPerspective: 1400, transformOrigin: 'left center' }}
        >
          <div className="relative w-40 sm:w-52 h-56 sm:h-72 rounded-t-xl rounded-b-md bg-gradient-to-b from-dusk-800 via-dusk-700 to-dusk-900 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
            {/* Panels */}
            <div className="absolute inset-x-5 top-8 h-20 sm:h-28 rounded-lg border-2 border-dusk-600/60" />
            <div className="absolute inset-x-5 bottom-10 h-20 sm:h-28 rounded-lg border-2 border-dusk-600/60" />
            {/* Knob */}
            <motion.div
              animate={{ rotate: doorOpen ? -40 : 0 }}
              transition={{ duration: 0.8 }}
              className="absolute right-5 sm:right-7 top-1/2 w-3.5 h-3.5 rounded-full bg-gold-300 shadow-[0_0_14px_rgba(240,217,140,0.9)]"
            />
            {/* Wreath */}
            <motion.div
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 140, damping: 12 }}
              className="absolute -top-7 left-1/2 -translate-x-1/2 text-4xl"
            >
              💐
            </motion.div>
          </div>
        </motion.div>

        {/* Knock effect */}
        <AnimatePresence>
          {doorOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 120, damping: 14 }}
              className="absolute -bottom-2 text-center"
            >
              <p className="font-script text-3xl text-wine-700">Welcome in, {name}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </RoomShell>
  )
}

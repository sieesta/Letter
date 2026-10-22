import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button, StepCard } from '../ui'

interface UploadStepProps {
  onComplete: (data: { name: string; message: string; photo: string | null }) => void
}

export function UploadStep({ onComplete }: UploadStepProps) {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setPhoto(event.target.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = () => {
    if (name.trim() && message.trim()) {
      onComplete({ name, message, photo })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="text-center mb-12">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 3, -3, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="text-8xl mb-6 inline-block"
        >
          💌
        </motion.div>
        <h1 className="text-5xl sm:text-6xl font-display text-dusk-900 mb-4 tracking-tight">Memory Lane Hunt</h1>
        <p className="text-xl text-dusk-600 max-w-md mx-auto">
          A romantic scavenger hunt through your love story. Fill this in, and she'll discover each memory room by room.
        </p>
      </div>

      <StepCard>
        <h2 className="text-3xl font-display text-center text-dusk-900 mb-8">Tell Us About Her</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-lg font-medium text-dusk-700 mb-2">Her Name</label>
            <motion.input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah, Maya, Ana..."
              className="w-full px-5 py-4 rounded-xl border-2 border-dusk-200 focus:border-ember-400 focus:outline-none focus:ring-4 focus:ring-ember-100 transition-all duration-300 text-lg"
              whileFocus={{ scale: 1.01 }}
            />
          </div>

          <div>
            <label className="block text-lg font-medium text-dusk-700 mb-2">Your Special Message</label>
            <motion.textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write something only she knows... an inside joke, a memory, a promise..."
              rows={4}
              className="w-full px-5 py-4 rounded-xl border-2 border-dusk-200 focus:border-ember-400 focus:outline-none focus:ring-4 focus:ring-ember-100 transition-all duration-300 text-lg resize-none"
              whileFocus={{ scale: 1.01 }}
            />
          </div>

          <div className="relative">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="photo-upload" />
            <label htmlFor="photo-upload">
              <motion.button
                type="button"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                whileHover={{ scale: hovered ? 1.02 : 1 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full aspect-[4/3] rounded-2xl border-2 border-dashed transition-all duration-300 flex items-center justify-center overflow-hidden cursor-pointer ${
                  photo ? 'border-ember-400 bg-ember-50' : 'border-dusk-300 hover:border-ember-400 hover:bg-ember-50'
                }`}
              >
                {photo ? (
                  <>
                    <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <span className="text-white text-xl font-medium">Click to change photo</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="mx-auto w-20 h-20 bg-ember-100 rounded-full flex items-center justify-center mb-4 text-4xl"
                    >
                      📸
                    </motion.div>
                    <p className="text-dusk-600 text-lg">Click to upload her favorite photo</p>
                    <p className="text-dusk-400 text-sm mt-2">(or leave blank for a sweet placeholder)</p>
                  </div>
                )}
              </motion.button>
            </label>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !message.trim()}
            size="lg"
            className="w-full text-lg py-4"
          >
            <span className="flex items-center justify-center gap-2">
              Create Memory Lane
              <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                →
              </motion.span>
            </span>
          </Button>
        </div>
      </StepCard>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="text-center text-dusk-500 text-sm mt-6"
      >
        This creates a private, one-of-a-kind experience just for her. No data leaves this page.
      </motion.p>
    </motion.div>
  )
}
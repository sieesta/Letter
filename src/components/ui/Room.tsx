import { motion } from 'framer-motion'

interface RoomProps {
  children: React.ReactNode
  className?: string
  transitionDuration?: number
}

export function Room({ children, className = '', transitionDuration = 0.8 }: RoomProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)', y: 20 }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)', y: -20 }}
      transition={{ duration: transitionDuration, ease: 'easeInOut' }}
      className={`relative h-screen w-full flex flex-col items-center justify-center overflow-hidden rounded-3xl ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent pointer-events-none"></div>
      {children}
    </motion.div>
  )
}
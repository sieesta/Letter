import { motion } from 'framer-motion'

interface StepCardProps {
  children: React.ReactNode
  className?: string
}

export function StepCard({ children, className = '' }: StepCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-8 sm:p-12 ${className}`}
    >
      {children}
    </motion.div>
  )
}
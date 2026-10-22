import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface RoomShellProps {
  eyebrow: string
  title: string
  subtitle: string
  backdrop: string
  accent: string
  children: ReactNode
  footer?: ReactNode
}

export function RoomShell({
  eyebrow,
  title,
  subtitle,
  backdrop,
  accent,
  children,
  footer,
}: RoomShellProps) {
  return (
    <section
      className={`relative w-full min-h-[26rem] sm:min-h-[32rem] rounded-[2rem] overflow-hidden shadow-card-lift border border-white/50 ${backdrop}`}
    >
      {/* Soft vignette + grain */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(255,255,255,0.45),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.35] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.35%22/></svg>')]" />

      {/* Heading */}
      <header className="relative z-10 px-6 sm:px-10 pt-8 sm:pt-10">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`text-[0.7rem] uppercase tracking-[0.35em] font-semibold ${accent} mb-2`}
        >
          {eyebrow}
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6 }}
          className="font-display text-3xl sm:text-4xl text-dusk-900"
        >
          {title}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.6 }}
          className="mt-3 max-w-lg text-dusk-700/90 leading-relaxed font-serif"
        >
          {subtitle}
        </motion.p>
      </header>

      {/* Interactive stage */}
      <div className="relative z-10 px-6 sm:px-10 py-8">{children}</div>

      {footer && <footer className="relative z-10 px-6 sm:px-10 pb-8">{footer}</footer>}
    </section>
  )
}

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface ToastProps {
  message: string | null
  onDismiss: () => void
}

export function Toast({ message, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
      const timer = window.setTimeout(() => {
        setVisible(false)
        onDismiss()
      }, 5000)
      return () => window.clearTimeout(timer)
    }
    return () => {}
  }, [message, onDismiss])

  if (!message || !visible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="toast"
    >
      <span className="toast__message">{message}</span>
      <button type="button" className="toast__close" onClick={onDismiss}>
        ✕
      </button>
    </motion.div>
  )
}

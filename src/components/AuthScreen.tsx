import { useState } from 'react'
import { motion } from 'framer-motion'
import { signIn, signUp } from '../lib/supabaseService'

interface AuthScreenProps {
  onAuthenticate: (userId: string) => void
  onToggleMode: () => void
  mode: 'login' | 'signup'
}

export function AuthScreen({ onAuthenticate, onToggleMode, mode }: AuthScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLogin = mode === 'login'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const userId = isLogin ? await signIn(email, password) : await signUp(email, password)
      onAuthenticate(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="auth"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="auth__card">
        <motion.div
          className="auth__glow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
        <span className="auth__eyebrow">Memory Lane</span>
        <h1 className="auth__title">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="auth__subtitle">
          {isLogin
            ? 'Sign in to access your hallways'
            : 'Start building — no email confirmation needed'}
        </p>

        <form onSubmit={handleSubmit} className="auth__form">
          <label className="auth__field">
            <span>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="auth__field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error ? <p className="auth__error">{error}</p> : null}

          <button
            type="submit"
            className="auth__submit"
            disabled={busy}
          >
            {busy ? 'Working…' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth__toggle">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button type="button" className="auth__toggleLink" onClick={onToggleMode}>
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>

      <motion.div className="auth__foot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}>
        <p className="auth__footText">
          Everything stays on your device. Photos and audio are stored privately
          under your account.
        </p>
      </motion.div>
    </motion.div>
  )
}

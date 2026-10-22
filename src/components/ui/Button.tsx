import { motion } from 'framer-motion'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: 'primary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseStyles = 'rounded-2xl font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2'

  const variants: Record<string, string> = {
    primary: 'bg-gradient-to-r from-ember-500 to-wine-500 hover:from-ember-600 hover:to-wine-600 text-white focus:ring-ember-400',
    ghost: 'bg-white/60 hover:bg-white/80 text-dusk-800 focus:ring-dusk-400',
    outline: 'border-2 border-dusk-300 bg-white/60 hover:bg-white/90 text-dusk-800 focus:ring-dusk-400',
  }

  const sizes: Record<string, string> = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}
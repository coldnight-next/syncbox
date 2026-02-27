import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variantClasses = {
  primary: 'bg-syncbox-600 text-white hover:bg-syncbox-700 active:bg-syncbox-800',
  secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400',
  ghost: 'text-gray-600 hover:bg-gray-100 active:bg-gray-200',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-syncbox-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

import { type HTMLAttributes, type ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children:  ReactNode
  padding?:  'sm' | 'md' | 'lg' | 'none'
  hover?:    boolean
}

const paddingClasses = {
  none: '',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
}

export function Card({
  children,
  padding  = 'md',
  hover    = false,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'rounded-2xl',
        hover ? 'glass-hover' : 'glass',
        paddingClasses[padding],
        'animate-fade-in',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}

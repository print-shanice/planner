import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost'
  // while waiting, the button says what it's doing ("signing in"), pulses and can't be pressed again
  busy?: string | false
}

export function Button({ variant = 'ghost', className = '', type = 'button', busy, children, disabled, ...rest }: Props) {
  return (
    <button type={type} className={`btn ${variant} ${busy ? 'pulse ' : ''}${className}`.trim()} disabled={disabled || !!busy}
      aria-busy={busy ? true : undefined} {...rest}>
      {busy ? `${busy}…` : children}
    </button>
  )
}

export function IconButton({ label, className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type={type} aria-label={label} title={label} className={`icon-btn ${className}`.trim()} {...rest} />
}

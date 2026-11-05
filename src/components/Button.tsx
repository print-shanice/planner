import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }

export function Button({ variant = 'ghost', className = '', type = 'button', ...rest }: Props) {
  return <button type={type} className={`btn ${variant} ${className}`.trim()} {...rest} />
}

export function IconButton({ label, className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type={type} aria-label={label} title={label} className={`icon-btn ${className}`.trim()} {...rest} />
}

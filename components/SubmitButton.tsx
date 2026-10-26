'use client'
import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

export function SubmitButton({ children, className = 'btn-primary', pendingText, ...rest }: {
  children: ReactNode; className?: string; pendingText?: string; name?: string; value?: string
  formAction?: (fd: FormData) => void | Promise<void>
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className} {...rest}>
      {pending ? (pendingText ?? 'Please wait…') : children}
    </button>
  )
}

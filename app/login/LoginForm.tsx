'use client'
import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import { SubmitButton } from '@/components/SubmitButton'

export function LoginForm() {
  const [state, action] = useActionState(login, undefined)
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="phone">Mobile number</label>
        <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" required className="input" placeholder="98100 12345" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton className="btn-primary w-full py-3">Log in</SubmitButton>
    </form>
  )
}

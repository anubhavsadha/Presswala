import Link from 'next/link'
import { AuthFrame } from '@/components/AuthFrame'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Log in' }

export default function LoginPage() {
  return (
    <AuthFrame title="Welcome back" subtitle="Log in with your mobile number">
      <LoginForm />
      <p className="mt-4 text-center text-sm text-stone-600">
        New here? <Link href="/register" className="font-semibold text-brand-700">Create an account</Link>
      </p>
    </AuthFrame>
  )
}

import Link from 'next/link'
import { AuthFrame } from '@/components/AuthFrame'
import { listAreas } from '@/lib/data'
import { RegisterForm } from './RegisterForm'

export const metadata = { title: 'Sign up' }

export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  const { as } = await searchParams
  const role = as === 'presswala' ? 'presswala' : 'customer'
  const areas = await listAreas()
  return (
    <AuthFrame
      title={role === 'presswala' ? 'Join as a presswala' : 'Create your account'}
      subtitle={role === 'presswala' ? 'प्रेसवाला रजिस्ट्रेशन – get customers from your own sectors' : 'Takes a minute. Only presswalas from your area will see you.'}
    >
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
        <Link href="/register" className={`rounded-lg py-2 text-center ${role === 'customer' ? 'bg-white shadow-sm' : 'text-stone-500'}`}>Household</Link>
        <Link href="/register?as=presswala" className={`rounded-lg py-2 text-center ${role === 'presswala' ? 'bg-white shadow-sm' : 'text-stone-500'}`}>Presswala</Link>
      </div>
      <RegisterForm key={role} role={role} areas={areas.map((a) => ({ id: a.id, name: a.name, locality: a.locality }))} />
      <p className="mt-4 text-center text-sm text-stone-600">
        Already registered? <Link href="/login" className="font-semibold text-brand-700">Log in</Link>
      </p>
    </AuthFrame>
  )
}

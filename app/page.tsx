import { headers } from 'next/headers'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { HOME_FOR_ROLE } from '@/lib/session'

export default async function Landing() {
  const session = await getSession()
  // The Android app sends this marker; no point offering the APK inside the APK.
  const inApp = ((await headers()).get('user-agent') ?? '').includes('IstrifyApp')
  const steps = [
    ['📅', 'Pick a day & slot', 'Choose a morning pickup slot, or drop clothes at the shop yourself. Set it once to repeat every week.'],
    ['👕', 'Clothes get ironed', 'Your colony presswala collects, counts and bills by item. ₹6 a piece, sarees and bedsheets as per his rate card.'],
    ['🏠', 'Back when you are home', 'Tell us when you will be home in the evening. Track every order and keep a clean khata.'],
  ]
  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-stone-50">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2 font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white">i</span> Istrify<sup className="text-[10px] font-normal text-stone-400">™</sup>
        </div>
        {session ? (
          <Link href={HOME_FOR_ROLE[session.role]} className="btn-primary">Open app</Link>
        ) : (
          <div className="flex gap-2">
            <Link href="/login" className="btn-ghost">Log in</Link>
            <Link href="/register" className="btn-primary">Sign up</Link>
          </div>
        )}
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-12 pt-8 md:pt-16">
        <p className="mb-3 inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">Istrify · Now in Gurgaon</p>
        <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight md:text-5xl">
          Your colony presswala, <span className="text-brand-600">on your schedule.</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-stone-600">
          No more waiting at the door or shouting from the balcony. Book a pickup, choose when you are home for the drop, and pay once a month if you like.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">Book my presswala</Link>
          <Link href="/register?as=presswala" className="btn-secondary px-6 py-3 text-base">I am a presswala</Link>
          {!inApp && (
            <a href="/istrify.apk" download className="btn-ghost px-4 py-3 text-base">📱 Android app</a>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-12 md:grid-cols-3">
        {steps.map(([icon, title, body]) => (
          <div key={title} className="card">
            <div className="text-3xl">{icon}</div>
            <h3 className="mt-2 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-stone-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="card grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold">For presswalas · प्रेसवालों के लिए</h2>
            <ul className="mt-3 space-y-2 text-sm text-stone-700">
              <li>✔ Every morning, a ready route: which homes, in what order, with Google Maps.</li>
              <li>✔ Fewer wasted trips: customers book slots where you are already nearby.</li>
              <li>✔ Automatic bill and khata for every home. No more notebook.</li>
              <li>✔ Only customers from your own sectors see you.</li>
            </ul>
            <Link href="/register?as=presswala" className="btn-primary mt-4">Join as presswala</Link>
          </div>
          <div>
            <h2 className="text-xl font-bold">Monthly plans</h2>
            <p className="mt-3 text-sm text-stone-700">
              Prepay for a month of regular clothes at a lower rate per piece, from ₹5 a piece. Sarees, bedsheets and other large items are charged at the presswala&apos;s rate card.
            </p>
          </div>
        </div>
      </section>
      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">© {new Date().getFullYear()} Istrify™ · istrify.in</footer>
    </div>
  )
}

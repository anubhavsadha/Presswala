import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <div className="text-5xl">🧺</div>
        <h1 className="mt-2 text-xl font-bold">Page not found</h1>
        <Link href="/" className="btn-primary mt-4">Go home</Link>
      </div>
    </div>
  )
}

import Link from 'next/link'

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-brand-50 to-stone-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white">i</span> Istrify<sup className="text-[10px] font-normal text-stone-400">™</sup>
        </Link>
        <div className="card p-6">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="mb-5 text-sm text-stone-500">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

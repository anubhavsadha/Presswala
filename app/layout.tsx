import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'https://istrify.in'),
  title: { default: 'Istrify – your colony presswala, on your schedule', template: '%s · Istrify' },
  description: 'Istrify: book your colony presswala for pickup and drop. Pick a slot, track your clothes, keep a clean khata.',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = { themeColor: '#ea580c', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

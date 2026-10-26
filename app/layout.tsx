import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Presswala – doorstep ironing in Gurgaon', template: '%s · Presswala' },
  description: 'Book your colony presswala for pickup and drop. Pick a slot, track your clothes, keep a clean khata.',
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

import type { MetadataRoute } from 'next'

// Lets people "Add to Home Screen" so the site opens like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Presswala',
    short_name: 'Presswala',
    description: 'Doorstep ironing from your colony presswala',
    start_url: '/login',
    display: 'standalone',
    background_color: '#fafaf9',
    theme_color: '#ea580c',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['postgres'],
  async headers() {
    return [{
      source: '/istrify.apk',
      headers: [
        { key: 'Content-Type', value: 'application/vnd.android.package-archive' },
        { key: 'Content-Disposition', value: 'attachment; filename="istrify.apk"' },
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
      ],
    }]
  },
}

export default nextConfig

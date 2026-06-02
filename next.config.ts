import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bramley.intelligentgolf.co.uk',
        pathname: '/images/**',
      },
    ],
  },
}

export default nextConfig

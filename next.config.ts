import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },

  async rewrites() {
    return [
      {
        source: '/api/crewai-chat',
        destination: process.env.AGENT_URL
          ? `${process.env.AGENT_URL}/crewai-chat`
          : 'http://127.0.0.1:8000/crewai-chat',
      },
      {
        source: '/workflow/:path*',
        destination: process.env.AGENT_URL
          ? `${process.env.AGENT_URL}/workflow/:path*`
          : 'http://127.0.0.1:8000/workflow/:path*',
      },
      {
        source: '/api/:path((?!auth).*)',
        destination: process.env.AGENT_URL
          ? `${process.env.AGENT_URL}/:path*`
          : 'http://127.0.0.1:8000/:path*',
      }
    ]
  },
}

export default nextConfig


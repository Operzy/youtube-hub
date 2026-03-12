import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['apify-client', 'proxy-agent'],
  outputFileTracingIncludes: {
    '/api/*': ['./node_modules/apify-client/**/*', './node_modules/proxy-agent/**/*'],
  },
}

export default nextConfig

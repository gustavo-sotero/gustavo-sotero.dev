import type { NextConfig } from 'next';
import { env } from './src/lib/env';

function getS3RemotePattern() {
  const parsed = new URL(env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN);
  const basePath = parsed.pathname.replace(/\/$/, '');

  return {
    protocol: parsed.protocol.replace(':', '') as 'http' | 'https',
    hostname: parsed.hostname,
    ...(parsed.port ? { port: parsed.port } : {}),
    pathname: `${basePath || ''}/**`,
  };
}

const s3RemotePattern = getS3RemotePattern();

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  cacheComponents: true,
  // Prevent @react-pdf/renderer from being bundled on the server.
  // It is client-only and loaded via dynamic({ ssr: false }) at runtime.
  serverExternalPackages: ['@react-pdf/renderer'],
  images: {
    remotePatterns: [
      s3RemotePattern,
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
};

export default nextConfig;

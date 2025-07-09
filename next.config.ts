import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Habilita output standalone para Docker
  output: 'standalone',

  // Compressão para melhor performance
  compress: true
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Compressão para melhor performance
  compress: true,

  // Configurações de imagem otimizadas
  images: {
    formats: ['image/webp', 'image/avif']
  },

  // Headers de segurança e observabilidade
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          }
        ]
      }
    ];
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development'
    }
  }
};

export default nextConfig;

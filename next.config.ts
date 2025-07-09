import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Habilita output standalone para Docker
  output: 'standalone',

  // Compressão para melhor performance
  compress: true,

  // Configurações de imagem otimizadas
  images: {
    formats: ['image/webp', 'image/avif']
  }
};

export default nextConfig;

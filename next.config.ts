import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Otimizações para produção
  reactStrictMode: true,
  
  // Compressão de assets
  compress: true,
  
  // Otimização de imagens (se necessário no futuro)
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dsmpownnrbdozllcbgla.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  
  // Headers de segurança
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ]
  },
  
  // Configuração de output para Vercel
  output: 'standalone',
};

export default nextConfig;

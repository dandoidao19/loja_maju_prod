/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@supabase/supabase-js');
    }
    return config;
  },
  turbopack: {},
};

export default nextConfig;

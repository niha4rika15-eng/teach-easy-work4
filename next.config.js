/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  // The Vercel project stores Supabase credentials under lowercase names; expose them
  // under the NEXT_PUBLIC_* names the app reads (both are public, browser-safe values).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.supabase_publicurl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.supabase_anonkey,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

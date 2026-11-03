/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  // pdf-parse ships a pdf.js worker and a native canvas binding; keep them out of the bundle so
  // serverless functions load them from node_modules instead of crashing at module evaluation.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas', 'mammoth'],
  // The Vercel project stores Supabase credentials under lowercase names; expose them
  // under the NEXT_PUBLIC_* names the app reads (both are public, browser-safe values).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.supabase_publicurl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.supabase_anonkey,
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

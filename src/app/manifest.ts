import type { MetadataRoute } from 'next';

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    'http://localhost:3003'
  );
}

export default function manifest(): MetadataRoute.Manifest {
  const base = siteUrl();
  return {
    name: 'WNY Automation Portal',
    short_name: 'WNY Portal',
    description: 'The secure client portal for WNY Automation.',
    id: '/',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#0b1422',
    theme_color: '#0e1a2b',
    orientation: 'portrait-primary',
    icons: [
      {
        src: `${base}/icon`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${base}/apple-icon`,
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}

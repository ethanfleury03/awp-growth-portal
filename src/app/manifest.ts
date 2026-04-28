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
    start_url: '/',
    display: 'standalone',
    background_color: '#0b1422',
    theme_color: '#0e1a2b',
    icons: [
      {
        src: `${base}/icon.svg`,
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}

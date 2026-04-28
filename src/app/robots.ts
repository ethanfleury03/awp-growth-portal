import type { MetadataRoute } from 'next';

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    'http://localhost:3003'
  );
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app', '/api', '/super-admin'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

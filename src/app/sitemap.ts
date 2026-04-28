import type { MetadataRoute } from 'next';

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    'http://localhost:3003'
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  const pages = [
    '/',
    '/features',
    '/industries',
    '/pricing',
    '/about',
    '/contact',
    '/legal/terms',
    '/legal/privacy',
    '/legal/cookies',
    '/legal/dpa',
    '/legal/security',
    '/legal/aup',
  ];

  return pages.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }));
}

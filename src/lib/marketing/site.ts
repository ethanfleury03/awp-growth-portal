export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    'http://localhost:3003'
  );
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl().replace(/\/+$/, '');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

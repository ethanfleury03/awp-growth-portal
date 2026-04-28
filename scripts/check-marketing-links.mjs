const BASE = process.env.MARKETING_BASE_URL || 'http://localhost:3003';
const START_ROUTES = ['/', '/features', '/pricing', '/industries', '/about', '/contact'];
const ALLOWED_PREFIXES = ['/', '/features', '/pricing', '/industries', '/about', '/contact', '/legal'];

function normalizeHref(href) {
  if (!href) return null;
  if (href.startsWith('#')) return null;
  if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return null;
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      const url = new URL(href);
      const baseHost = new URL(BASE).host;
      if (url.host !== baseHost) return null;
      return `${url.origin}${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }
  if (href.startsWith('/')) {
    const clean = href.split('#')[0];
    if (clean.startsWith('/api') || clean.startsWith('/app') || clean.startsWith('/_next')) return null;
    if (!ALLOWED_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`))) {
      return null;
    }
    return `${BASE}${clean}`;
  }
  return null;
}

async function checkStatus(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    return { ok: res.status < 400, status: res.status };
  } catch (error) {
    return { ok: false, status: 0, error };
  }
}

function extractLinks(html) {
  const set = new Set();
  const regex = /href="([^"]+)"/g;
  let match = regex.exec(html);
  while (match) {
    const normalized = normalizeHref(match[1]);
    if (normalized) set.add(normalized);
    match = regex.exec(html);
  }
  return Array.from(set);
}

async function main() {
  const failures = [];
  const discovered = new Set(START_ROUTES.map((r) => `${BASE}${r}`));
  const checked = new Set();

  for (const url of START_ROUTES.map((r) => `${BASE}${r}`)) {
    const status = await checkStatus(url);
    checked.add(url);
    if (!status.ok) {
      failures.push({ url, status: status.status });
      continue;
    }
    const html = await fetch(url, { signal: AbortSignal.timeout(10000) }).then((r) => r.text());
    for (const link of extractLinks(html)) {
      discovered.add(link);
    }
  }

  for (const url of discovered) {
    if (checked.has(url)) continue;
    const status = await checkStatus(url);
    if (!status.ok) failures.push({ url, status: status.status });
    checked.add(url);
  }

  if (failures.length) {
    console.error('Broken marketing links detected:');
    for (const failure of failures) {
      console.error(`- ${failure.url} -> ${failure.status || 'request failed'}`);
    }
    process.exit(1);
  }
  console.log(`Checked ${discovered.size} marketing links with no failures.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

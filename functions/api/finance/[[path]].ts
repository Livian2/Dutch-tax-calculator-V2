// Cloudflare Pages Function: proxies /api/finance/* to Yahoo Finance,
// spoofing browser-like headers and handling crumb authentication.

interface PagesContext {
  request: Request;
  params: { path?: string[] };
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
};

const CRUMB_CACHE_KEY = 'https://internal.invalid/yahoo-crumb-v1';

interface CrumbData {
  crumb: string;
  cookie: string;
}

declare const caches: { default: Cache };

function getAllSetCookies(headers: Headers): string[] {
  // Cloudflare supports the non-standard getAll for Set-Cookie
  const h = headers as Headers & { getAll?: (name: string) => string[] };
  if (typeof h.getAll === 'function') return h.getAll('Set-Cookie');
  const single = headers.get('Set-Cookie');
  return single ? [single] : [];
}

async function getCrumb(): Promise<CrumbData | null> {
  const cache = caches.default;
  const cached = await cache.match(CRUMB_CACHE_KEY);
  if (cached) {
    try {
      return (await cached.json()) as CrumbData;
    } catch {
      // fall through to refetch
    }
  }

  // 1. Get the Yahoo consent cookie
  const cookieRes = await fetch('https://fc.yahoo.com/', {
    headers: BROWSER_HEADERS,
    redirect: 'manual',
  });
  const cookies = getAllSetCookies(cookieRes.headers)
    .map((c) => c.split(';')[0])
    .join('; ');
  if (!cookies) return null;

  // 2. Fetch the crumb with that cookie
  const crumbRes = await fetch(
    'https://query2.finance.yahoo.com/v1/test/getcrumb',
    { headers: { ...BROWSER_HEADERS, Cookie: cookies } }
  );
  if (!crumbRes.ok) return null;
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.length > 30 || crumb.startsWith('<')) return null;

  const data: CrumbData = { crumb, cookie: cookies };
  await cache.put(
    CRUMB_CACHE_KEY,
    new Response(JSON.stringify(data), {
      headers: { 'Cache-Control': 'max-age=1500' }, // crumbs valid ~1 hour
    })
  );
  return data;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/finance2?/, '');
  const host = path.startsWith('/autoc')
    ? 'autoc.finance.yahoo.com'
    : 'query2.finance.yahoo.com';
  const upstreamUrl = `https://${host}${path}${url.search}`;

  // First attempt: no crumb (works for chart endpoints)
  let res = await fetch(upstreamUrl, { headers: BROWSER_HEADERS });

  if ((res.status === 401 || res.status === 403) && host === 'query2.finance.yahoo.com') {
    const crumbData = await getCrumb();
    if (crumbData) {
      const sep = url.search ? '&' : '?';
      const withCrumb = `${upstreamUrl}${sep}crumb=${encodeURIComponent(crumbData.crumb)}`;
      res = await fetch(withCrumb, {
        headers: { ...BROWSER_HEADERS, Cookie: crumbData.cookie },
      });
    }
  }

  const body = await res.arrayBuffer();
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', res.headers.get('Content-Type') ?? 'application/json');
  headers.set(
    'Cache-Control',
    res.ok ? 'public, max-age=60, s-maxage=60' : 'no-store'
  );
  return new Response(body, { status: res.status, headers });
}

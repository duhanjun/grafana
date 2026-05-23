export const config = {
  matcher: '/(.*)',
};

const PROXY_HOST = 'jingni2.citongshuo.online';
const TARGET_HOST = 'grafana-production-0a56.up.railway.app';
const TARGET_URL = `https://${TARGET_HOST}`;

function rewriteSetCookie(value) {
  return value
    .replace(new RegExp(`Domain=${TARGET_HOST.replace('.', '\\.')}`, 'gi'), `Domain=${PROXY_HOST}`)
    .replace(new RegExp(`Domain=localhost`, 'gi'), '')
    .replace(/;\s*;/g, ';')
    .replace(/;\s*$/, '');
}

function rewriteLocation(location) {
  if (!location) return location;
  if (location.startsWith('/')) {
    return `https://${PROXY_HOST}${location}`;
  }
  if (location.includes(TARGET_HOST)) {
    return location.replace(TARGET_HOST, PROXY_HOST);
  }
  if (location.includes('localhost:3000')) {
    return location.replace('localhost:3000', PROXY_HOST);
  }
  return location;
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const targetPath = url.pathname + url.search;
  const targetUrl = `${TARGET_URL}${targetPath}`;

  const excludeHeaders = new Set([
    'host', 'connection', 'content-length', 'content-encoding', 'transfer-encoding',
  ]);

  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers) {
    if (!excludeHeaders.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  }
  forwardHeaders.set('Host', TARGET_HOST);
  forwardHeaders.set('X-Forwarded-Host', PROXY_HOST);
  forwardHeaders.set('X-Forwarded-Proto', 'https');
  forwardHeaders.set('Origin', TARGET_URL);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const clonedRequest = hasBody ? request.clone() : null;
  const body = clonedRequest ? await clonedRequest.text() : undefined;

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: body,
      redirect: 'manual',
    });

    const newHeaders = new Headers();
    const setCookieHeaders = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : [];

    for (const [key, value] of response.headers) {
      const lower = key.toLowerCase();
      if (lower === 'transfer-encoding' || lower === 'content-length') continue;
      if (lower === 'set-cookie') continue;
      if (lower === 'location') continue;
      newHeaders.append(key, value);
    }

    for (const cookie of setCookieHeaders) {
      newHeaders.append('set-cookie', rewriteSetCookie(cookie));
    }

    const location = response.headers.get('location');
    if ((response.status === 307 || response.status === 302 || response.status === 303) && location) {
      newHeaders.set('location', rewriteLocation(location));
    }

    newHeaders.set('X-Proxied-By', 'Vercel-Edge-Middleware');

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (error) {
    return new Response('Proxy error: ' + error.message, { status: 502 });
  }
}

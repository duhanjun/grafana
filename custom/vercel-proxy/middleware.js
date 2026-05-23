export const config = {
  matcher: '/(.*)',
};

const PROXY_HOST = 'jingni2.citongshuo.online';
const TARGET_HOST = 'grafana-production-0a56.up.railway.app';
const TARGET_URL = `https://${TARGET_HOST}`;

function rewriteSetCookie(value) {
  return value
    .replace(new RegExp(`Domain=${TARGET_HOST.replace('.', '\\.')}`, 'gi'), `Domain=${PROXY_HOST}`)
    .replace(new RegExp(`Domain=localhost[^;]*`, 'gi'), '')
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
    return location.replace('http://localhost:3000', `https://${PROXY_HOST}`);
  }
  return location;
}

export default async function middleware(request) {
  const url = new URL(request.url);

  if (url.pathname === '/__proxy_test_cookies') {
    const testResp = await fetch('https://httpbin.org/cookies/set?test_cookie=hello123', {
      redirect: 'manual',
    });
    const hasGetSetCookie = typeof testResp.headers.getSetCookie === 'function';
    const setCookies = hasGetSetCookie ? testResp.headers.getSetCookie() : null;
    const allHeaders = [];
    for (const [k, v] of testResp.headers) {
      allHeaders.push(`${k}: ${v}`);
    }
    return new Response(JSON.stringify({
      hasGetSetCookie,
      setCookiesCount: setCookies ? setCookies.length : null,
      setCookies,
      allHeaders,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
    const debugInfo = [];

    const hasGetSetCookie = typeof response.headers.getSetCookie === 'function';
    const setCookies = hasGetSetCookie ? response.headers.getSetCookie() : null;
    debugInfo.push(`sc-method=${hasGetSetCookie ? 'getSetCookie' : 'fallback'}`);
    debugInfo.push(`sc-count=${setCookies ? setCookies.length : 'N/A'}`);

    for (const [key, value] of response.headers) {
      const lower = key.toLowerCase();
      if (lower === 'transfer-encoding' || lower === 'content-length') continue;
      if (lower === 'location') continue;
      if (lower === 'set-cookie' && hasGetSetCookie && setCookies && setCookies.length > 0) continue;
      if (lower === 'set-cookie') {
        newHeaders.append('set-cookie', rewriteSetCookie(value));
        debugInfo.push(`sc-fallback=${value.substring(0, 50)}`);
        continue;
      }
      newHeaders.append(key, value);
    }

    if (hasGetSetCookie && setCookies && setCookies.length > 0) {
      for (const cookie of setCookies) {
        const rewritten = rewriteSetCookie(cookie);
        newHeaders.append('set-cookie', rewritten);
        debugInfo.push(`sc-rewritten=${rewritten.substring(0, 80)}`);
      }
    }

    const location = response.headers.get('location');
    if ((response.status === 307 || response.status === 302 || response.status === 303) && location) {
      const rewritten = rewriteLocation(location);
      newHeaders.set('location', rewritten);
      debugInfo.push(`loc=${location}->${rewritten}`);
    }

    newHeaders.set('X-Proxied-By', 'Vercel-Edge-Middleware');
    newHeaders.set('X-Debug', debugInfo.join(' | '));

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (error) {
    return new Response('Proxy error: ' + error.message, { status: 502 });
  }
}

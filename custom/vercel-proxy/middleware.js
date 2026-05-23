export const config = {
  matcher: '/(.*)',
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const targetPath = url.pathname + url.search;
  const targetUrl = `https://grafana-production-0a56.up.railway.app${targetPath}`;

  const excludeHeaders = new Set([
    'host', 'connection', 'content-length', 'content-encoding', 'transfer-encoding',
  ]);

  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers) {
    if (!excludeHeaders.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  }
  forwardHeaders.set('X-Forwarded-Host', 'jingni2.citongshuo.online');
  forwardHeaders.set('X-Forwarded-Proto', 'https');

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

    const location = response.headers.get('location');

    if ((response.status === 307 || response.status === 302) && location) {
      const redirectUrl = location.startsWith('/')
        ? `https://jingni2.citongshuo.online${location}`
        : location;
      const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="${redirectUrl}">${redirectUrl}</a></p>
</body>
</html>`;

      return new Response(redirectHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Proxied-By': 'Vercel-Edge-Middleware',
          'X-Original-Status': String(response.status),
          'X-Redirect-To': redirectUrl,
        },
      });
    }

    const newHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding' &&
          key.toLowerCase() !== 'content-length' &&
          key.toLowerCase() !== 'location') {
        newHeaders.set(key, value);
      }
    });

    newHeaders.set('X-Proxied-By', 'Vercel-Edge-Middleware');

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (error) {
    return new Response('Proxy error: ' + error.message, { status: 502 });
  }
}

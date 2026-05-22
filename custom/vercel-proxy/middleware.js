export const config = {
  matcher: '/(.*)',
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const targetPath = url.pathname + url.search;
  const targetUrl = `https://grafana-production-0a56.up.railway.app${targetPath}`;

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(
          Object.entries(request.headers).filter(
            ([key]) => !['host', 'connection', 'content-length'].includes(key.toLowerCase())
          )
        ),
        'X-Forwarded-Host': 'jingni2.citongshuo.online',
        'X-Forwarded-Proto': 'https',
      },
      redirect: 'manual',
    });

    const location = response.headers.get('location');
    const body = await response.text();
    
    const newHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding' && 
          key.toLowerCase() !== 'content-length' &&
          key.toLowerCase() !== 'location') {
        newHeaders.set(key, value);
      }
    });
    
    if ((response.status === 307 || response.status === 302) && location) {
      let redirectUrl;
      if (location.startsWith('/')) {
        redirectUrl = `https://jingni2.citongshuo.online${location}`;
      } else {
        redirectUrl = location;
      }
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
    
    newHeaders.set('X-Proxied-By', 'Vercel-Edge-Middleware');

    return new Response(body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (error) {
    return new Response('Proxy error: ' + error.message, { status: 502 });
  }
}

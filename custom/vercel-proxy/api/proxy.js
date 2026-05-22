export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req) {
  const url = new URL(req.url);
  const targetPath = url.pathname + url.search;
  const targetUrl = `https://grafana-production-0a56.up.railway.app${targetPath}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...Object.fromEntries(
          Object.entries(req.headers).filter(
            ([key]) => !['host', 'connection'].includes(key.toLowerCase())
          )
        ),
        'X-Forwarded-Host': 'jingni2.citongshuo.online',
        'X-Forwarded-Proto': 'https',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      redirect: 'manual',
    });

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    return new Response('Proxy error: ' + error.message, { status: 502 });
  }
}

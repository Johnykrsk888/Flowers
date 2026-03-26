/**
 * Прокси МойСклад для статического фронта (GitHub Pages): CORS + Basic auth на стороне Worker.
 *
 * Развёртывание (Cloudflare Workers):
 *   npm i -g wrangler
 *   cd proxy && wrangler login
 *   wrangler secret put MOYSKLAD_LOGIN
 *   wrangler secret put MOYSKLAD_PASSWORD
 *   wrangler deploy
 *
 * В GitHub → Secrets задайте VITE_MOYSKLAD_API_PREFIX:
 *   https://<subdomain>.workers.dev/api/moysklad
 */

function basicAuthHeader(login, password) {
  const raw = `${login}:${password}`;
  const bytes = new TextEncoder().encode(raw);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `Basic ${btoa(bin)}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept, Cache-Control",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/moysklad")) {
      return new Response("MoySklad proxy: use /api/moysklad/...", {
        status: 404,
        headers: corsHeaders,
      });
    }

    const login = env.MOYSKLAD_LOGIN;
    const password = env.MOYSKLAD_PASSWORD;
    if (!login || !password) {
      return new Response(
        JSON.stringify({ errors: [{ error: "Worker: задайте MOYSKLAD_LOGIN / MOYSKLAD_PASSWORD" }] }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const targetPath = url.pathname.replace(/^\/api\/moysklad/, "/api/remap/1.2");
    const targetUrl = `https://api.moysklad.ru${targetPath}${url.search}`;

    const headers = new Headers();
    headers.set("Authorization", basicAuthHeader(login, password));
    if (targetPath.includes("/download/")) {
      headers.set("Accept", "*/*");
    } else {
      headers.set("Accept", request.headers.get("Accept") || "application/json;charset=utf-8");
    }

    const init = {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    };

    const res = await fetch(targetUrl, init);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(corsHeaders)) {
      out.headers.set(k, v);
    }
    return out;
  },
};

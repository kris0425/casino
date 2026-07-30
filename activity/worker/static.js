export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.pathname === "/api/garage" ||
      url.pathname === "/api/garage/confirm" ||
      url.pathname.startsWith("/api/mahjong/") ||
      url.pathname === "/api/scratch" ||
      url.pathname.startsWith("/api/scratch/") ||
      url.pathname === "/api/jenga" ||
      url.pathname.startsWith("/api/jenga/")
    ) {
      if (!env.ACTIVITY_BACKEND_URL || !env.ACTIVITY_BACKEND_SECRET) {
        return Response.json({ ok: false, error: "改裝服務尚未完成設定" }, { status: 503 });
      }
      const path = url.pathname === "/api/garage"
        ? "/activity/garage"
        : url.pathname === "/api/garage/confirm"
          ? "/activity/garage/confirm"
          : `/activity${url.pathname.slice(4)}`;
      const target = new URL(path, env.ACTIVITY_BACKEND_URL);
      target.search = url.search;
      const headers = new Headers(request.headers);
      headers.set("x-activity-backend-secret", env.ACTIVITY_BACKEND_SECRET);
      headers.delete("cookie");
      const upstream = await fetch(target, {
        method: request.method,
        headers,
        body: request.method === "GET" ? undefined : request.body,
        redirect: "manual",
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    if (url.pathname === "/") url.pathname = "/index.html";
    if (url.pathname === "/mahjong") url.pathname = "/mahjong.html";
    if (url.pathname === "/scratch") url.pathname = "/scratch.html";
    if (url.pathname === "/jenga") url.pathname = "/jenga.html";
    return env.ASSETS.fetch(new Request(url, request));
  },
};

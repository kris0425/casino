/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  ACTIVITY_BACKEND_URL?: string;
  ACTIVITY_BACKEND_SECRET?: string;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
        return Response.json({ ok: false, error: "遊戲服務尚未完成設定" }, { status: 503 });
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
        headers: { "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    if (url.pathname === "/mahjong") {
      return env.ASSETS.fetch(new Request(new URL("/mahjong.html", request.url), request));
    }
    if (url.pathname === "/scratch") {
      return env.ASSETS.fetch(new Request(new URL("/scratch.html", request.url), request));
    }
    if (url.pathname === "/jenga") {
      return env.ASSETS.fetch(new Request(new URL("/jenga.html", request.url), request));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

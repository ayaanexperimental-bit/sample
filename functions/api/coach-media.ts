import type { R2Bucket } from "@cloudflare/workers-types";

type Env = {
  COACH_MEDIA_BUCKET?: R2Bucket;
};

type PagesContext = {
  env: Env;
  request: Request;
};

const ALLOWED_KEY_PREFIX = "coach-sites/";

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", {
      headers: {
        allow: "GET, HEAD"
      },
      status: 405
    });
  }

  if (!env.COACH_MEDIA_BUCKET) {
    return new Response("Coach media storage is not configured.", { status: 503 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  if (!isSafeMediaKey(key)) {
    return new Response("Not found.", { status: 404 });
  }

  const object = await env.COACH_MEDIA_BUCKET.get(key);
  if (!object) {
    return new Response("Not found.", { status: 404 });
  }

  const headers = new Headers();
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("content-type", object.httpMetadata?.contentType || "application/octet-stream");
  headers.set("etag", object.httpEtag);

  if (request.method === "HEAD") {
    return new Response(null, { headers, status: 200 });
  }

  return new Response(object.body as unknown as BodyInit, {
    headers,
    status: 200
  });
}

function isSafeMediaKey(key: string) {
  return (
    key.startsWith(ALLOWED_KEY_PREFIX) &&
    !key.includes("..") &&
    /^coach-sites\/[a-z0-9-]+\/(image|video)\/[a-z0-9.-]+$/i.test(key)
  );
}

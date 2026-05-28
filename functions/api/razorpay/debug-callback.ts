type PagesContext = {
  request: Request;
};

const NO_STORE_HEADERS = {
  "cache-control": "no-store"
};

export function onRequest({ request }: PagesContext) {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...NO_STORE_HEADERS, allow: "GET, POST" }
    });
  }

  const url = new URL("/success", request.url);

  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      location: url.toString()
    }
  });
}

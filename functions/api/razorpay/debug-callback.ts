type PagesContext = {
  request: Request;
};

const NO_STORE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
  "content-type": "text/html; charset=utf-8",
  "x-robots-tag": "noindex, nofollow"
};

export async function onRequest({ request }: PagesContext) {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...NO_STORE_HEADERS, allow: "GET, POST" }
    });
  }

  const params = await readCallbackParams(request);
  const entries = Array.from(params.entries()).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return new Response(renderDebugPage(entries, request.method), {
    status: 200,
    headers: NO_STORE_HEADERS
  });
}

async function readCallbackParams(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);

  if (request.method !== "POST") return params;

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      Object.entries(body).forEach(([key, value]) => {
        if (typeof value === "string" || typeof value === "number") {
          params.set(key, String(value));
        }
      });
      return params;
    }

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        if (typeof value === "string") {
          params.set(key, value);
        }
      });
      return params;
    }

    const body = await request.text();
    new URLSearchParams(body).forEach((value, key) => {
      params.set(key, value);
    });
  } catch {
    return params;
  }

  return params;
}

function renderDebugPage(entries: Array<[string, string]>, method: string) {
  const rows = entries.length
    ? entries
        .map(
          ([key, value]) => `
            <tr>
              <td>${escapeHtml(key)}</td>
              <td>${escapeHtml(maskValue(value))}</td>
            </tr>
          `
        )
        .join("")
    : `
      <tr>
        <td colspan="2">No callback parameters were received.</td>
      </tr>
    `;

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>Razorpay Callback Debug</title>
        <style>
          body {
            background: #fff7fb;
            color: #21162a;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            line-height: 1.55;
            margin: 0;
            padding: 32px 18px;
          }

          main {
            background: rgba(255, 255, 255, 0.84);
            border: 1px solid rgba(198, 44, 148, 0.18);
            border-radius: 18px;
            box-shadow: 0 18px 50px rgba(61, 34, 53, 0.12);
            margin: 0 auto;
            max-width: 760px;
            padding: 24px;
          }

          h1 {
            font-size: clamp(1.6rem, 5vw, 2.3rem);
            line-height: 1.08;
            margin: 0 0 12px;
          }

          p {
            color: #594c61;
            margin: 0 0 18px;
          }

          table {
            border-collapse: collapse;
            margin-top: 18px;
            width: 100%;
          }

          th,
          td {
            border-bottom: 1px solid rgba(89, 76, 97, 0.18);
            padding: 12px 8px;
            text-align: left;
            word-break: break-word;
          }

          code {
            background: rgba(198, 44, 148, 0.08);
            border-radius: 7px;
            padding: 2px 6px;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Razorpay callback debug</h1>
          <p>Method: <code>${escapeHtml(method)}</code></p>
          <p>This page shows only parameter names and masked value previews. It does not show secrets or full payment values.</p>
          <table>
            <thead>
              <tr>
                <th>Parameter name</th>
                <th>Masked preview</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </main>
      </body>
    </html>`;
}

function maskValue(value: string) {
  if (!value) return "(empty)";
  if (value.length <= 8) return `${value.slice(0, 2)}...${value.slice(-2)}`;

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

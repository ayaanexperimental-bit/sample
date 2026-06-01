import { BLOCKED_LINK_MESSAGE } from "../coach-platform";

const HTML_HEADERS = {
  "cache-control": "no-store",
  "content-type": "text/html; charset=utf-8"
};

export function blockedLinkResponse(status = 403) {
  return new Response(
    `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex,nofollow" />
          <title>Link Not Available</title>
          <style>
            :root {
              color-scheme: light;
              --ink: #251126;
              --muted: #6f566a;
              --line: rgba(140, 40, 93, 0.2);
              --paper: #fffaf7;
              --rose: #be185d;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background:
                linear-gradient(145deg, rgba(255, 241, 246, 0.92), rgba(248, 255, 250, 0.95)),
                var(--paper);
              color: var(--ink);
              font-family: Manrope, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            main {
              width: min(92vw, 34rem);
              padding: clamp(1.5rem, 5vw, 2.5rem);
              border: 1px solid var(--line);
              border-radius: 0.5rem;
              background: rgba(255, 255, 255, 0.88);
              box-shadow: 0 1rem 3rem rgba(70, 22, 46, 0.12);
            }
            p:first-child {
              margin: 0 0 0.7rem;
              color: var(--rose);
              font-size: 0.78rem;
              font-weight: 800;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            h1 {
              margin: 0 0 0.8rem;
              font-size: clamp(1.7rem, 7vw, 2.5rem);
              line-height: 1.05;
            }
            p:last-child {
              margin: 0;
              color: var(--muted);
              font-size: 1rem;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <main>
            <p>Link unavailable</p>
            <h1>Access blocked</h1>
            <p>${BLOCKED_LINK_MESSAGE}</p>
          </main>
        </body>
      </html>`,
    {
      status,
      headers: HTML_HEADERS
    }
  );
}

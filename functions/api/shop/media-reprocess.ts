type PagesContext = {
  request: Request;
};

export async function onRequestPost({ request }: PagesContext) {
  await request.text().catch(() => "");

  return shopJson(
    {
      error:
        "Server-side photo reprocessing is disabled. Re-upload the image so your browser can create the transparent cutout locally.",
      ok: false
    },
    410
  );
}

export async function onRequestOptions() {
  return shopJson({ ok: true });
}

function shopJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8"
    }
  });
}

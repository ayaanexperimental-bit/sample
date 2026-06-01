export type SuccessVideoSource =
  | { kind: "none" }
  | { kind: "youtube"; url: string }
  | { kind: "video"; url: string };

export function getSuccessVideoSource(videoUrl: string): SuccessVideoSource {
  const trimmedUrl = videoUrl.trim();
  if (!trimmedUrl) return { kind: "none" };

  const youtubeId = getYouTubeVideoId(trimmedUrl);
  if (youtubeId) {
    return {
      kind: "youtube",
      url: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`
    };
  }

  return { kind: "video", url: trimmedUrl };
}

function getYouTubeVideoId(videoUrl: string) {
  try {
    const parsedUrl = new URL(videoUrl);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      return sanitizeYouTubeId(parsedUrl.pathname.slice(1));
    }

    if (hostname === "youtube.com" || hostname === "youtube-nocookie.com") {
      if (parsedUrl.pathname.startsWith("/embed/")) {
        return sanitizeYouTubeId(parsedUrl.pathname.split("/")[2] || "");
      }

      return sanitizeYouTubeId(parsedUrl.searchParams.get("v") || "");
    }
  } catch {
    return null;
  }

  return null;
}

function sanitizeYouTubeId(value: string) {
  const match = value.match(/^[A-Za-z0-9_-]{6,}$/);

  return match ? match[0] : null;
}

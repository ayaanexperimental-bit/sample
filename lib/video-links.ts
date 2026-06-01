export function normalizeVideoEmbedUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const videoId = url.searchParams.get("v");
        return videoId ? createYoutubeEmbedUrl(videoId) : "";
      }

      if (url.pathname.startsWith("/embed/")) {
        return trimmed;
      }

      if (url.pathname.startsWith("/shorts/")) {
        const videoId = url.pathname.split("/").filter(Boolean)[1];
        return videoId ? createYoutubeEmbedUrl(videoId) : "";
      }
    }

    if (host === "youtu.be") {
      const videoId = url.pathname.replace("/", "").split("/")[0];
      return videoId ? createYoutubeEmbedUrl(videoId) : "";
    }

    return url.protocol === "https:" || url.protocol === "http:" ? trimmed : "";
  } catch {
    return "";
  }
}

export function isSupportedVideoUrl(value: string) {
  return Boolean(normalizeVideoEmbedUrl(value));
}

function createYoutubeEmbedUrl(videoId: string) {
  return `https://www.youtube.com/embed/${videoId}?playsinline=1&controls=1&rel=0&modestbranding=1`;
}

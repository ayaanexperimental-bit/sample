import type { Funnel } from "../coach-platform";

export type PrivateFunnelLinkEnv = Record<string, string | undefined> & {
  YW_PRIVATE_FUNNEL_LINKS_JSON?: string;
};

type PrivateFunnelLinks = Record<
  string,
  {
    whatsappGroupUrl?: string;
  }
>;

export function getPrivateWhatsappGroupUrl(funnel: Funnel, env: PrivateFunnelLinkEnv) {
  const directUrl = env[getWhatsappEnvName(funnel.id)]?.trim();
  const mappedUrl = getMappedWhatsappUrl(funnel.id, env)?.trim();
  const candidateUrl = directUrl || mappedUrl || "";

  return isAllowedWhatsappInviteUrl(candidateUrl) ? candidateUrl : null;
}

export function getWhatsappEnvName(funnelId: string) {
  return `WHATSAPP_GROUP_URL_${funnelId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

function getMappedWhatsappUrl(funnelId: string, env: PrivateFunnelLinkEnv) {
  const raw = env.YW_PRIVATE_FUNNEL_LINKS_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;

    const links = parsed as PrivateFunnelLinks;
    return typeof links[funnelId]?.whatsappGroupUrl === "string"
      ? links[funnelId].whatsappGroupUrl
      : null;
  } catch {
    return null;
  }
}

function isAllowedWhatsappInviteUrl(value: string) {
  if (!value) return false;

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" && url.hostname === "chat.whatsapp.com" && url.pathname !== "/"
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

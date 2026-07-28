export type AdminCoachCopyApiPayload<TContent = unknown> = {
  cache?: "hit" | "miss";
  code?: string;
  configured?: boolean;
  confirmationRequired?: boolean;
  content?: TContent;
  error?: string;
  message?: string;
  ok?: boolean;
  usageEstimate?: {
    approximateCostLevel: "High" | "Low" | "Medium";
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    warning: string;
  };
};

type AdminCoachCopyRequestOptions = {
  body: Readonly<Record<string, unknown>>;
  confirmLargeRequest: (message: string) => boolean | Promise<boolean>;
  csrfToken: string;
};

export async function requestAdminCoachCopyWithConfirmation<TContent = unknown>({
  body,
  confirmLargeRequest,
  csrfToken
}: AdminCoachCopyRequestOptions) {
  const requestBody = Object.freeze({ ...body });
  const initial = await postAdminCoachCopy<TContent>(requestBody, csrfToken);
  if (
    initial.response.status !== 409 ||
    initial.payload.code !== "large_input_confirmation_required" ||
    initial.payload.confirmationRequired !== true
  ) {
    return { ...initial, cancelled: false as const };
  }

  const approved = await confirmLargeRequest(formatLargeRequestConfirmation(initial.payload));
  if (!approved) return { ...initial, cancelled: true as const };

  const confirmed = await postAdminCoachCopy<TContent>(
    { ...requestBody, confirmLargeRequest: true },
    csrfToken
  );
  return { ...confirmed, cancelled: false as const };
}

async function postAdminCoachCopy<TContent>(
  body: Readonly<Record<string, unknown>>,
  csrfToken: string
) {
  const response = await fetch("/api/admin/coach-sites/generate-copy", {
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "x-yw-admin-csrf": csrfToken
    },
    method: "POST"
  });
  const payload = (await response.json().catch(() => ({}))) as AdminCoachCopyApiPayload<TContent>;
  return { payload, response };
}

function formatLargeRequestConfirmation(payload: AdminCoachCopyApiPayload) {
  const inputTokens = payload.usageEstimate?.estimatedInputTokens;
  const outputTokens = payload.usageEstimate?.estimatedOutputTokens;
  const estimate =
    Number.isFinite(inputTokens) && Number.isFinite(outputTokens)
      ? `Estimated usage: ${inputTokens?.toLocaleString("en-US")} input tokens and up to ${outputTokens?.toLocaleString("en-US")} output tokens.`
      : "";

  return [
    payload.message || "This AI copy request is large and may use additional provider capacity.",
    estimate,
    "Continue with AI copy generation?"
  ]
    .filter(Boolean)
    .join("\n\n");
}

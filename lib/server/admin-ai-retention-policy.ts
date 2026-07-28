export const ADMIN_AI_RETENTION_DAYS = 90;
export const ADMIN_AI_RETENTION_SECONDS = ADMIN_AI_RETENTION_DAYS * 24 * 60 * 60;

export function getAdminAIRetentionCutoffSeconds(nowSeconds = currentSeconds()) {
  return Math.floor(nowSeconds) - ADMIN_AI_RETENTION_SECONDS;
}

export function isAdminAIRetainedAt(
  recordTimestampSeconds: number,
  nowSeconds = currentSeconds()
) {
  return (
    Number.isFinite(recordTimestampSeconds) &&
    recordTimestampSeconds > getAdminAIRetentionCutoffSeconds(nowSeconds)
  );
}

function currentSeconds() {
  return Math.floor(Date.now() / 1000);
}

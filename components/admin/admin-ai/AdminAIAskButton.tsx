import { dispatchAdminAIAsk } from "../../../lib/admin-ai/adminAIEvents";
import type { AdminAIScope } from "../../../lib/admin-ai/adminAITypes";

export function AdminAIAskButton({
  className,
  label = "Ask Copilot",
  query,
  scope = "page",
}: {
  className?: string;
  label?: string;
  query: string;
  scope?: AdminAIScope;
}) {
  return (
    <button className={className} onClick={() => dispatchAdminAIAsk(query, scope)} type="button">
      {label}
    </button>
  );
}

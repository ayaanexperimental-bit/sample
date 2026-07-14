import type { AdminAICommand } from "../../../lib/admin-ai/adminAIRegistry";
import styles from "./admin-ai.module.css";

export function AdminAICommandList({
  busy,
  commands,
  onSelect,
  selectedId,
}: {
  busy: boolean;
  commands: AdminAICommand[];
  onSelect: (command: AdminAICommand) => void;
  selectedId: string;
}) {
  if (!commands.length) {
    return (
      <p className={styles.emptyState} role="status">
        No Copilot command is available for the permissions assigned to this admin.
      </p>
    );
  }

  return (
    <div aria-label="Contextual Copilot commands" className={styles.commandList}>
      {commands.map((command) => (
        <button
          aria-busy={busy && selectedId === command.id}
          data-active={selectedId === command.id ? "true" : "false"}
          data-risk={command.type}
          disabled={busy}
          key={command.id}
          onClick={() => onSelect(command)}
          type="button"
        >
          <span>
            <strong>{command.label}</strong>
            <small>{command.type === "dangerous" ? "Protected" : command.type}</small>
          </span>
          <p>{command.description}</p>
        </button>
      ))}
    </div>
  );
}

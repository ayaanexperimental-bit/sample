import type { AdminAICommand } from "../../../lib/admin-ai/adminAIRegistry";
import styles from "./admin-ai.module.css";

export function AdminAICommandList({
  busy,
  commands,
  onSelect,
  selectedId
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

  const primaryCommands = commands.slice(0, 4);
  const additionalCommands = commands.slice(4);
  const renderCommand = (command: AdminAICommand) => (
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
  );

  return (
    <div aria-label="Contextual Copilot commands" className={styles.commandList}>
      <div className={styles.commandGrid}>{primaryCommands.map(renderCommand)}</div>
      {additionalCommands.length ? (
        <details className={styles.commandDisclosure}>
          <summary>
            <span>
              <strong>More commands</strong>
              <small>{additionalCommands.length} additional permission-filtered actions</small>
            </span>
            <span aria-hidden="true">Review</span>
          </summary>
          <div className={styles.commandGrid}>{additionalCommands.map(renderCommand)}</div>
        </details>
      ) : null}
    </div>
  );
}

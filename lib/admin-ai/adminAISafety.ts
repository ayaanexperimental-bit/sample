import type { AdminAICommand } from "./adminAIRegistry";

export function requiresAdminAIConfirmation(command: AdminAICommand) {
  return command.confirmationRequired === true || command.type === "dangerous";
}

export function getAdminAIConfirmationCopy(command: AdminAICommand) {
  const securityLine = command.otpRequired
    ? "The existing OTP step remains mandatory. Copilot cannot read, submit, or bypass an OTP."
    : "This confirmation only prepares the registered workflow; it does not bypass existing security.";

  return {
    body: `${command.description} ${securityLine}`,
    confirmLabel: command.type === "dangerous" ? "Continue to protected workflow" : "Confirm action",
    title: command.label,
  };
}

export function isAdminAICommandReadOnly(command: AdminAICommand) {
  return command.type === "read" || command.type === "suggest";
}

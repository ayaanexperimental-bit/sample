import {
  getMinimumAdminAIApprovalLevel,
  type AdminAICommand,
} from "./adminAIRegistry";

function getEffectiveApprovalLevel(command: AdminAICommand) {
  return Math.max(command.approvalLevel, getMinimumAdminAIApprovalLevel(command.type));
}

export function requiresAdminAIConfirmation(command: AdminAICommand) {
  return command.confirmationRequired === true || getEffectiveApprovalLevel(command) >= 1;
}

export function getAdminAIConfirmationCopy(command: AdminAICommand) {
  const approvalLevel = getEffectiveApprovalLevel(command);
  const securityLine = command.otpRequired
    ? "The existing OTP step remains mandatory. Copilot cannot read, submit, or bypass an OTP."
    : approvalLevel === 1
      ? "Review this draft or recommendation before applying it. No protected data changes at this level."
      : "This confirmation only prepares the registered workflow; it does not bypass existing security.";

  return {
    body: `${command.description} ${securityLine}`,
    confirmLabel:
      approvalLevel >= 3
        ? "Continue to protected workflow"
        : approvalLevel === 1
          ? "Apply suggestion"
          : "Confirm action",
    title: command.label,
  };
}

export function isAdminAICommandReadOnly(command: AdminAICommand) {
  return command.type === "read" || command.type === "suggest";
}

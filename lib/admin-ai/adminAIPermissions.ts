import type { AdminV2AccessProfileClient } from "../admin-v2-access";
import type { AdminAICommand } from "./adminAIRegistry";

export function canUseAdminAICommand(
  profile: AdminV2AccessProfileClient | null | undefined,
  command: AdminAICommand
) {
  return getAdminAICommandAvailability(profile, command).available;
}

export function getAdminAICommandAvailability(
  profile: AdminV2AccessProfileClient | null | undefined,
  command: AdminAICommand
): { available: boolean; reason: string | null } {
  if (!profile) {
    return {
      available: false,
      reason: "Sign in with an authorized admin account to use this capability."
    };
  }
  if (command.ownerOnly && !profile.isOwner) {
    return {
      available: false,
      reason: "Your current admin role cannot use this capability."
    };
  }
  if (profile.isOwner) return { available: true, reason: null };
  const available = (command.requiredPermissions || []).every((permission) =>
    profile.permissions?.includes(permission)
  );
  return {
    available,
    reason: available ? null : "Your current admin role cannot use this capability."
  };
}

export function getAllowedAdminAICommands(
  profile: AdminV2AccessProfileClient | null | undefined,
  commands: AdminAICommand[]
) {
  return commands.filter((command) => canUseAdminAICommand(profile, command));
}

export function getAdminAIUnavailableCapabilityReason(
  profile: AdminV2AccessProfileClient | null | undefined,
  commands: AdminAICommand[]
) {
  for (const command of commands) {
    const availability = getAdminAICommandAvailability(profile, command);
    if (!availability.available) return availability.reason;
  }
  return null;
}

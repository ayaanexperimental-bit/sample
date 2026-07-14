import type { AdminV2AccessProfileClient } from "../admin-v2-access";
import type { AdminAICommand } from "./adminAIRegistry";

export function canUseAdminAICommand(
  profile: AdminV2AccessProfileClient | null | undefined,
  command: AdminAICommand
) {
  if (!profile) return false;
  if (command.ownerOnly) return Boolean(profile.isOwner);
  if (profile.isOwner) return true;
  return (command.requiredPermissions || []).every((permission) =>
    profile.permissions?.includes(permission)
  );
}

export function getAllowedAdminAICommands(
  profile: AdminV2AccessProfileClient | null | undefined,
  commands: AdminAICommand[]
) {
  return commands.filter((command) => canUseAdminAICommand(profile, command));
}

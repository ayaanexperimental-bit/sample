import type { PaidUserCreatedPayload } from "@/lib/registrations/types";

export const AUTOMATION_EVENT_TYPES = ["paid_user_created"] as const;

export type AutomationEventType = (typeof AUTOMATION_EVENT_TYPES)[number];

export const AUTOMATION_EVENT_STATUSES = ["pending", "sent", "failed"] as const;

export type AutomationEventStatus = (typeof AUTOMATION_EVENT_STATUSES)[number];

export type AutomationEventRecord = {
  id: string;
  registrationId: string;
  eventType: AutomationEventType;
  payloadJson: PaidUserCreatedPayload;
  status: AutomationEventStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
};

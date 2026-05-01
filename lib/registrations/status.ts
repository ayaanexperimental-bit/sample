export const PAYMENT_STATUSES = [
  "created",
  "attempted",
  "success",
  "failed",
  "pending",
  "refunded",
  "disputed"
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const MEMBER_STATUSES = [
  "paid_not_joined",
  "group_link_clicked",
  "active_member",
  "reminder_1_sent",
  "reminder_2_sent",
  "reminder_3_sent",
  "reminder_4_sent",
  "manual_followup_required"
] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const INITIAL_PAYMENT_STATUS: PaymentStatus = "created";
export const CONFIRMED_PAYMENT_STATUS: PaymentStatus = "success";
export const INITIAL_MEMBER_STATUS: MemberStatus = "paid_not_joined";
export const WHATSAPP_CLICKED_MEMBER_STATUS: MemberStatus = "group_link_clicked";

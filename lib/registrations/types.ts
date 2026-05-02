import type { MemberStatus, PaymentStatus } from "@/lib/registrations/status";

export type RegistrationRecord = {
  id: string;
  registrationToken: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  programSlug: string;
  workshopSlot: string | null;
  amount: number;
  currency: "INR";
  paymentStatus: PaymentStatus;
  memberStatus: MemberStatus;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  razorpaySignatureVerified: boolean;
  joinedWhatsappGroup: boolean;
  joinedWhatsappGroupAt: string | null;
  automationDispatched: boolean;
  automationDispatchError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConfirmedRegistrationInput = {
  fullName: string;
  phoneNumber: string;
  email: string;
  programSlug: string;
  workshopSlot?: string;
  amount: 5100;
  currency: "INR";
  razorpayOrderId: string;
  razorpayPaymentId: string;
};

export type PaidUserCreatedPayload = {
  event_type: "paid_user_created";
  registration_id: string;
  registration_token: string;
  full_name: string;
  phone_number: string;
  email: string;
  program_slug: string;
  workshop_slot: string;
  amount: 5100;
  currency: "INR";
  payment_status: "success";
  member_status: "paid_not_joined";
  razorpay_order_id: string;
  razorpay_payment_id: string;
  whatsapp_group_link: string;
  thank_you_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  created_at: string;
  lead_timestamp: string;
};

export type WhatsappGroupLinkClickedPayload = {
  event_type: "whatsapp_group_link_clicked";
  registration_id: string;
  registration_token: string;
  full_name: string;
  phone_number: string;
  email: string;
  program_slug: string;
  payment_status: "success";
  member_status: "group_link_clicked";
  clicked_at: string;
};

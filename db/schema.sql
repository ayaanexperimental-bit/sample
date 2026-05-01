-- Minimal database schema for the n8n-first payment flow.
-- PostgreSQL is the intended source of truth.
-- This file is a schema draft until the final database provider and migration tool are selected.

create table if not exists registrations (
  id uuid primary key,
  registration_token text not null unique,
  full_name text not null,
  phone_number text not null,
  email text not null,
  program_slug text not null,
  workshop_slot text,
  amount integer not null,
  currency text not null default 'INR',
  payment_status text not null default 'created' check (
    payment_status in (
      'created',
      'attempted',
      'success',
      'failed',
      'pending',
      'refunded',
      'disputed'
    )
  ),
  member_status text not null default 'paid_not_joined' check (
    member_status in (
      'paid_not_joined',
      'group_link_clicked',
      'active_member',
      'reminder_1_sent',
      'reminder_2_sent',
      'reminder_3_sent',
      'reminder_4_sent',
      'manual_followup_required'
    )
  ),
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  razorpay_signature_verified boolean not null default false,
  joined_whatsapp_group boolean not null default false,
  joined_whatsapp_group_at timestamptz,
  automation_dispatched boolean not null default false,
  automation_dispatch_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation_events (
  id uuid primary key,
  registration_id uuid not null references registrations(id) on delete cascade,
  event_type text not null default 'paid_user_created' check (event_type = 'paid_user_created'),
  payload_json jsonb not null,
  status text not null default 'pending' check (
    status in (
      'pending',
      'sent',
      'failed'
    )
  ),
  retry_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_registrations_registration_token on registrations(registration_token);
create index if not exists idx_registrations_payment_status on registrations(payment_status);
create index if not exists idx_registrations_member_status on registrations(member_status);
create index if not exists idx_registrations_razorpay_order_id on registrations(razorpay_order_id);
create index if not exists idx_registrations_razorpay_payment_id on registrations(razorpay_payment_id);
create index if not exists idx_automation_events_registration_id on automation_events(registration_id);
create index if not exists idx_automation_events_event_type on automation_events(event_type);
create index if not exists idx_automation_events_status on automation_events(status);

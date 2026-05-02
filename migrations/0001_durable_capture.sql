create table if not exists registrations (
  id text primary key,
  registration_token text not null unique,
  full_name text not null default '',
  phone_number text not null default '',
  email text not null default '',
  program_slug text not null,
  workshop_slot text,
  amount integer not null,
  currency text not null default 'INR',
  payment_status text not null default 'success',
  member_status text not null default 'paid_not_joined',
  razorpay_order_id text,
  razorpay_payment_id text not null unique,
  whatsapp_group_link text,
  thank_you_url text,
  payload_json text not null,
  created_at text not null,
  updated_at text not null default (datetime('now'))
);

create table if not exists automation_events (
  id text primary key,
  registration_id text not null,
  event_type text not null default 'paid_user_created',
  payload_json text not null,
  status text not null default 'pending',
  retry_count integer not null default 0,
  last_error text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  sent_at text,
  dead_at text,
  foreign key (registration_id) references registrations(id) on delete cascade,
  unique (registration_id, event_type)
);

create index if not exists idx_registrations_razorpay_payment_id on registrations(razorpay_payment_id);
create index if not exists idx_registrations_created_at on registrations(created_at);
create index if not exists idx_automation_events_status on automation_events(status);
create index if not exists idx_automation_events_retry on automation_events(status, retry_count, updated_at);
create index if not exists idx_automation_events_registration_id on automation_events(registration_id);
create index if not exists idx_automation_events_created_at on automation_events(created_at);

# Database Migration Plan

Micro-task: 2.1

## Goal

Create the initial PostgreSQL schema plan for the lighter n8n-first payment flow.

## Source Of Truth

The database is the operational source of truth.

Google Sheets is only a reporting and owner-dashboard sink managed by n8n.

## Initial Schema File

Draft schema:

```text
db/schema.sql
```

## Required Tables

- `registrations`
- `automation_events`

## Explicitly Deferred From Backend Schema

These are owned by n8n for now and should not be recreated as backend tables in this phase:

- Google Sheets sync jobs
- Email delivery logs
- WhatsApp delivery logs
- Reminder workers
- Manual follow-up dashboard queue
- Full CRM/admin tables

## Migration Tool Decision Pending

The schema is written as plain PostgreSQL SQL for now.

Before applying this to a real database, choose one:

- Plain SQL migrations
- Prisma
- Drizzle
- node-postgres with migration scripts
- Supabase migrations
- Managed provider migration tool

## Rules Before Applying

- Confirm database provider.
- Confirm migration tool.
- Confirm UUID generation strategy.
- Confirm status enum strategy.
- Confirm PII retention rules.
- Confirm backup and restore process.

## Known Draft Choices

- IDs are represented as `uuid`.
- Amount is stored as integer minor units.
- Currency defaults to `INR`.
- Razorpay is the default provider.
- Confirmed registrations are created only after verified Razorpay payment.
- `registration_token` is unique and used for Thank You page lookup.
- Backend-to-n8n `paid_user_created` dispatch attempts are stored in `automation_events`.
- `active_member` is never set from a WhatsApp link click alone.

-- Store per-portal login credentials so the apply engine can auto-login
-- to portals that require account creation (Workday, iCIMS, Handshake, etc.)
--
-- Structure: { "workday": {"email": "...", "password": "..."}, "icims": {...} }
-- Stored in Supabase which encrypts at rest. Never written to apply_runs.

alter table public.profiles
  add column if not exists portal_accounts jsonb not null default '{}'::jsonb;

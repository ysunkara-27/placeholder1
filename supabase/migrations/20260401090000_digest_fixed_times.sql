-- Per-user fixed local times for digest shortlist, cutoff, and goal submit.
-- This replaces the previous "review window in minutes" model with three
-- independent daily times (subject to validation in the app layer).

alter table public.profiles
  add column if not exists daily_digest_shortlist_time_local text not null default '18:00',
  add column if not exists daily_digest_cutoff_time_local text not null default '19:00',
  add column if not exists daily_digest_goal_submit_time_local text not null default '21:00';


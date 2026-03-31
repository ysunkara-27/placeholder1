-- Add second major and cover letter template to profiles
alter table public.profiles
  add column if not exists major2 text,
  add column if not exists cover_letter_template text;

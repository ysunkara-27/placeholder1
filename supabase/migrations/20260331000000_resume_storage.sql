-- Add resume_url column to profiles
alter table public.profiles
  add column if not exists resume_url text;

-- Create Supabase Storage bucket for resumes (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Users can upload their own resume
create policy "Users can upload their own resume"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update (overwrite) their own resume
create policy "Users can update their own resume"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own resume
create policy "Users can read their own resume"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

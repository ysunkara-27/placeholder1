-- Normalize level values to lowercase to fix filter mismatches (e.g. "Internship" vs "internship")
update public.jobs
set level = lower(level)
where level != lower(level);

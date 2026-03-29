alter table profiles
  add column if not exists linkedin_url        text,
  add column if not exists website_url         text,
  add column if not exists github_url          text,
  add column if not exists city                text,
  add column if not exists state_region        text,
  add column if not exists country             text not null default 'United States',
  add column if not exists major               text,
  add column if not exists authorized_to_work  boolean not null default true,
  add column if not exists visa_type           text check (visa_type in ('citizen','green_card','opt','cpt','h1b','tn','other')),
  add column if not exists earliest_start_date text,
  add column if not exists eeo                 jsonb;

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade not null,
  profile_name text not null,
  profile_student_id text,
  form_response jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_registrations_event on registrations(event_id);

alter table registrations enable row level security;

create policy "registrations_anon_read" on registrations
  for select to anon using (true);

create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade not null,
  nickname text not null,
  created_at timestamptz default now(),
  unique(event_id, nickname)
);

create index if not exists idx_attendees_event on attendees(event_id);

alter table attendees enable row level security;

create policy "attendees_anon_read" on attendees
  for select to anon using (true);

create policy "attendees_anon_insert" on attendees
  for insert to anon with check (true);

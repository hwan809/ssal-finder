-- events table
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  food_type text,
  food_note text,
  target_audience text,
  register_url text,
  source_type text,
  source_hash text unique,
  description text,
  form_id text,
  form_mapping jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- update_logs table
create table if not exists update_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  action text not null,
  diff jsonb,
  created_at timestamptz default now()
);

-- indexes
create index if not exists idx_events_start_at on events(start_at);
create index if not exists idx_events_food_type on events(food_type);
create index if not exists idx_update_logs_event_id on update_logs(event_id);
create index if not exists idx_update_logs_created_at on update_logs(created_at desc);

-- RLS: anon read-only
alter table events enable row level security;
alter table update_logs enable row level security;

create policy "events_anon_read" on events
  for select to anon using (true);

create policy "update_logs_anon_read" on update_logs
  for select to anon using (true);

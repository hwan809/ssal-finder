create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_at timestamptz not null,
  location text,
  food_type text check (food_type in ('버거','도시락','샌드위치','간식','식사','기타')),
  food_note text,
  target_audience text,
  register_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);

create index if not exists idx_submissions_status on submissions(status);
create index if not exists idx_submissions_created on submissions(created_at desc);

alter table submissions enable row level security;

-- anon can read approved, and insert new submissions
create policy "submissions_anon_read" on submissions
  for select to anon using (status = 'approved');

create policy "submissions_anon_insert" on submissions
  for insert to anon with check (true);

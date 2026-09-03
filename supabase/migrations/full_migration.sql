-- ============================================
-- KAIST 쌀먹파인더 전체 마이그레이션
-- Supabase SQL Editor에 붙여넣기 후 실행
-- ============================================

-- 1. events 테이블
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

-- 2. update_logs 테이블
create table if not exists update_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  action text not null,
  diff jsonb,
  created_at timestamptz default now()
);

-- 3. submissions 테이블
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

-- 4. 인덱스
create index if not exists idx_events_start_at on events(start_at);
create index if not exists idx_events_food_type on events(food_type);
create index if not exists idx_update_logs_event_id on update_logs(event_id);
create index if not exists idx_update_logs_created_at on update_logs(created_at desc);
create index if not exists idx_submissions_status on submissions(status);
create index if not exists idx_submissions_created on submissions(created_at desc);

-- 5. RLS
alter table events enable row level security;
alter table update_logs enable row level security;
alter table submissions enable row level security;

create policy "events_anon_read" on events for select to anon using (true);
create policy "update_logs_anon_read" on update_logs for select to anon using (true);
create policy "submissions_anon_read" on submissions for select to anon using (status = 'approved');
create policy "submissions_anon_insert" on submissions for insert to anon with check (true);

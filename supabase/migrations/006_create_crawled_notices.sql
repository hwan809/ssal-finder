create table if not exists crawled_notices (
  url text primary key,
  dept text not null,
  title text,
  is_food_event boolean,
  event_id uuid references events(id) on delete set null,
  crawled_at timestamptz default now()
);

create index if not exists idx_crawled_notices_dept on crawled_notices(dept);
create index if not exists idx_crawled_notices_crawled_at on crawled_notices(crawled_at desc);

-- service role only: RLS on, no anon policy
alter table crawled_notices enable row level security;

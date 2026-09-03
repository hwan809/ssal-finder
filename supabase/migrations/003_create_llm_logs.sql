create table if not exists llm_logs (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10,6) not null default 0,
  prompt_preview text,
  response_preview text,
  purpose text,
  created_at timestamptz default now()
);

create index if not exists idx_llm_logs_created on llm_logs(created_at desc);

alter table llm_logs enable row level security;

create policy "llm_logs_anon_read" on llm_logs
  for select to anon using (true);

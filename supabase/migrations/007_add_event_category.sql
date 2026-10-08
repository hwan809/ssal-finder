-- 행사모음: 음식 없는 행사도 events에 저장한다
alter table events add column if not exists is_food boolean not null default true;
alter table events add column if not exists category text;
create index if not exists idx_events_is_food on events(is_food);

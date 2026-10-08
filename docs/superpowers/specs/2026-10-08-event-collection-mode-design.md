# 행사모음 모드 (쌀먹찾기 확장) — Design

## 배경

학과 게시판 크롤러는 정상 동작하지만 음식 행사가 드물다 (10일간 30회 실행, 음식 행사 2건).
분류기에서 버려지는 글 중 설명회·해커톤·시연회 같은 *행사*가 있고, 메일에서도 세미나 등 비음식 행사가 버려진다.
이를 모아 보여주는 "행사모음" 모드를 쌀먹찾기의 확장으로 추가한다.

## 범위

- 행사모음 = 일시·장소가 있는 행사 전체 (음식 행사 포함). 채용공고·학사 공지는 제외.
- 쌀먹찾기 = 기존과 동일 (음식 행사만).
- 온보딩은 수정하지 않는다.

## 1. 데이터

`events` 테이블에 컬럼 2개 추가 (새 테이블 없음):

```sql
alter table events add column if not exists is_food boolean not null default true;
alter table events add column if not exists category text;
create index if not exists idx_events_is_food on events(is_food);
```

- 기존 행은 `is_food = true`, `category = null` (음식 행사로 유지).
- `category` ∈ `세미나 | 설명회 | 대회 | 문화 | 기타`. 비음식 행사는 반드시 채운다. 음식 행사도 분류기가 채운다.
- 비음식 행사는 `food_type = null`, `food_note = null`.
- DDL은 사용자가 Supabase SQL 에디터에서 실행 (`supabase/migrations/007_add_event_category.sql`로 저장).

## 2. 수집 파이프라인 (메일 + 게시판)

- `scripts/llm-classifier.ts` 프롬프트 변경: `is_event`, `is_food_event`, `category`를 판정.
  - `is_event: false` → 기존처럼 버림 (채용공고, 학사 공지, 소식 기사 등).
  - `is_event: true, is_food_event: false` → `is_food = false`로 저장.
  - `is_food_event: true` → 기존과 동일 + `category`.
- `db-upserter`는 `is_food`, `category`를 기록한다.
- 비음식 행사는 구글폼 파싱(`form-parser`)을 건너뛴다.
- 로그 요약에 `Events (non-food)` 카운트 추가.

## 3. 모드 전환 UI

- 헤더 로고를 탭하면 모드 전환: `🍚 카이스트 쌀먹찾기 ⇅` ↔ `📅 카이스트 행사모음 ⇅`.
- 모션: 로고 텍스트가 위로 롤링(기존 텍스트 위로 빠지고 새 텍스트 아래에서 올라옴, ~250ms). `--point` 색이 모드별 색으로 transition.
- 그라데이션·blur·rounded-xl 금지 (기존 디자인 원칙 유지).
- 모드는 `localStorage("ssal-mode")`에 `"food" | "all"`로 저장. 읽기/쓰기는 try/catch. 기본값 `"food"`.
- 모드 상태는 React context (`ModeProvider`)로 헤더와 `/events` 페이지가 공유.
- `/events` 외 페이지(뒤로가기 헤더)는 전환 버튼이 없다.

## 4. 행사모음 모드의 `/events`

- 데이터: 한 번만 fetch, 클라이언트에서 `is_food`로 필터 (쌀먹 모드 = `is_food`만).
- 목록 행: 행사 제목 표시, 카테고리 아이콘. 음식 있는 행사엔 작은 🍚 표시.
- 필터: 음식 종류 칩 대신 카테고리 칩.
- 추천 섹션: "오늘 행사 N개" 형태의 간단한 요약으로 대체.
- 달력: 같은 컴포넌트, 필터된 데이터.
- 상세 페이지·공유는 기존 그대로 (비음식 행사는 음식 정보 영역 숨김, 공유 헤드라인은 제목 기반).

## 5. 검증

- 기존 크롤러 fixture 테스트 통과.
- 최근 버려진 notice 제목 12개 + 메일 세미나 샘플로 분류 결과 확인 (채용 → 제외, 해커톤/설명회/시연회 → 행사).
- 로컬 dev에서 모드 전환, 라이트/다크, 새로고침 후 모드 유지 확인.
- `pnpm build`, `pnpm lint` 통과.

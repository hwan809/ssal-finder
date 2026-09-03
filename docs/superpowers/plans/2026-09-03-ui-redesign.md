# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current AI-generated-looking UI with a calendar-first, recommendation-toned mobile app using Wanted Sans font, minimal styling, and Toss-style profile collection.

**Architecture:** Single-column mobile-first layout. Main page shows a recommendation block at top, then a month calendar, then upcoming events list. Calendar date taps open a bottom sheet. Profile collection is a sequential single-field-at-a-time flow triggered by auto-register or "going" actions. Onboarding is a 3-slide intro shown once.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, Supabase, TypeScript

## Global Constraints

- No rounded-xl, backdrop-blur, gradient, shadow-lg in any component
- No card/surface/colored-background containers — use borders and typography for hierarchy
- Wanted Sans (woff2 self-hosted) replaces Pretendard Variable as body font
- Tossface emoji font retained via `.emoji` class
- Color tokens: `--bg`, `--fg`, `--g3`, `--g5`, `--g7`, `--g9`, `--point` (see spec for exact hex values)
- `--point` color used only for recommendation text emphasis, today-date highlight, and action flags
- All pages single-column, max-width ~480px centered
- Headers are sticky with opaque (not blurred) background

## File Map

```
Modify:
  app/globals.css          — replace Pretendard with Wanted Sans, add CSS custom properties
  app/layout.tsx           — update font loading to Wanted Sans
  app/page.tsx             — rewrite as onboarding gate → redirect
  app/events/page.tsx      — full rewrite: recommendation + calendar + list
  app/events/[id]/page.tsx — restyle event detail page
  app/submit/page.tsx      — restyle form (minimal borders, no colors)
  app/feed/page.tsx        — restyle with shared header
  app/profile/page.tsx     — restyle with shared header
  lib/colors.ts            — strip bg/text/stripe, keep icon only
  lib/strings.ts           — add recommendation strings
  components/events/event-card.tsx   — delete (replaced by inline list items)
  components/events/food-filter.tsx  — restyle: border-only chips
  components/calendar/mini-calendar.tsx — delete (replaced by month-calendar)
  components/events/attendee-section.tsx — restyle
  components/events/auto-register-button.tsx — integrate toss-profile-flow trigger
  components/feed/feed-timeline.tsx  — restyle
  components/profile/profile-form.tsx — keep for /profile page, restyle

Create:
  public/fonts/WantedSansVariable.woff2 — font file (download step)
  components/layout/header.tsx         — shared header component
  components/home/recommendation.tsx   — recommendation block with conditional copy
  components/home/month-calendar.tsx   — full month calendar grid
  components/ui/bottom-sheet.tsx       — bottom sheet (overlay + slide-up)
  components/ui/toast.tsx              — toast notification
  components/ui/toss-profile-flow.tsx  — sequential single-field profile collection
  components/onboarding/onboarding-slides.tsx — 3-slide intro
```

---

### Task 1: Font swap & global CSS tokens

**Files:**
- Download: `public/fonts/WantedSansVariable.woff2`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: CSS custom properties (`--bg`, `--fg`, `--g3`, `--g5`, `--g7`, `--g9`, `--point`) available globally. `--font-wanted` CSS variable. `.emoji` class for Tossface.

- [ ] **Step 1: Download Wanted Sans Variable woff2**

```bash
curl -L -o public/fonts/WantedSansVariable.woff2 \
  "https://github.com/magicmirror-wantedlab/wanted-sans/raw/HEAD/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.woff2"
```

If the URL is unavailable, download manually from the Wanted Sans GitHub releases page and place in `public/fonts/`.

- [ ] **Step 2: Rewrite globals.css**

Replace the entire contents of `app/globals.css`:

```css
@import "tailwindcss";

@font-face {
  font-family: "Wanted Sans";
  src: url("/fonts/WantedSansVariable.woff2") format("woff2");
  font-display: swap;
  font-weight: 100 900;
}

@font-face {
  font-family: "Tossface";
  src: url("/fonts/TossFaceFontWeb.otf") format("opentype");
  font-display: swap;
}

:root {
  --bg: #fff;
  --fg: #000;
  --g3: #444;
  --g5: #999;
  --g7: #ddd;
  --g9: #f5f5f5;
  --point: #e8390e;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0f0f0f;
    --fg: #e5e5e0;
    --g3: #ccc;
    --g5: #777;
    --g7: #333;
    --g9: #111;
    --point: #ff6633;
  }
}

:root[data-theme="dark"] {
  --bg: #0f0f0f;
  --fg: #e5e5e0;
  --g3: #ccc;
  --g5: #777;
  --g7: #333;
  --g9: #111;
  --point: #ff6633;
}

.emoji {
  font-family: "Tossface", sans-serif;
}
```

- [ ] **Step 3: Update layout.tsx**

Replace `app/layout.tsx` — swap Pretendard for Wanted Sans, apply CSS vars to body:

```tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import { S } from "@/lib/strings";
import "./globals.css";

const wantedSans = localFont({
  src: "../public/fonts/WantedSansVariable.woff2",
  variable: "--font-wanted",
  display: "swap",
});

export const metadata: Metadata = {
  title: S.APP_NAME,
  description: S.APP_DESC,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${wantedSans.variable} antialiased`}
        style={{
          fontFamily: "var(--font-wanted), system-ui, sans-serif",
          background: "var(--bg)",
          color: "var(--fg)",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify font renders**

Run `pnpm dev`, open in browser. Confirm Wanted Sans is loading (check Network tab for the woff2 file, confirm text renders differently from system font).

- [ ] **Step 5: Commit**

```bash
git add public/fonts/WantedSansVariable.woff2 app/globals.css app/layout.tsx
git commit -m "feat: swap to Wanted Sans font, add CSS color tokens"
```

---

### Task 2: Shared header & slim down colors.ts

**Files:**
- Create: `components/layout/header.tsx`
- Modify: `lib/colors.ts`
- Modify: `lib/strings.ts`

**Interfaces:**
- Produces: `<Header />` component with props `back?: string` (back link href) and `title?: string`. `FOOD_ICONS` export from colors.ts (icon-only map).

- [ ] **Step 1: Create shared header**

Create `components/layout/header.tsx`:

```tsx
import Link from "next/link";

interface HeaderProps {
  back?: string;
  title?: string;
  children?: React.ReactNode;
}

export function Header({ back, title, children }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 max-w-[480px] mx-auto"
      style={{ background: "var(--bg)" }}
    >
      <div className="flex items-center justify-between px-5 py-4">
        {back ? (
          <div className="flex items-center gap-3">
            <Link
              href={back}
              className="text-sm"
              style={{ color: "var(--g5)" }}
            >
              ← 목록
            </Link>
            {title && (
              <span className="text-sm font-bold">{title}</span>
            )}
          </div>
        ) : (
          <Link
            href="/events"
            className="text-[16px] font-black"
            style={{ letterSpacing: "-0.04em" }}
          >
            <span className="emoji">🍚</span> 쌀먹
          </Link>
        )}
        <div className="flex items-center gap-4">
          {children}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Slim down colors.ts**

Replace `lib/colors.ts` — keep only icon per food type:

```ts
import type { FoodType } from "./types";

export const FOOD_ICONS: Record<FoodType, string> = {
  버거: "🍔",
  도시락: "🍱",
  샌드위치: "🥪",
  간식: "🍪",
  식사: "🍽️",
  기타: "🍴",
};
```

- [ ] **Step 3: Add recommendation strings to strings.ts**

Add these entries to the `S` object in `lib/strings.ts`:

```ts
// 추천
REC_TODAY_MEAL: (food: string) => `오늘 점심,\n${food} 어때요?`,
REC_TOMORROW_MEAL: (food: string) => `내일 점심,\n${food} 어때요?`,
REC_EMPTY_WEEK: "아 쌀먹 좀 하자...",
REC_NEXT_EVENT: (dateStr: string) => `다음 밥은 ${dateStr}!`,
```

- [ ] **Step 4: Fix all import references**

Search codebase for `FOOD_COLORS` and update to use `FOOD_ICONS` where only the icon is needed. Components that used `FOOD_COLORS.bg`, `.text`, `.stripe`, `.dot` will be rewritten in later tasks, so for now just fix any files that only need the icon: `lib/strings.ts` (if used), `components/feed/feed-timeline.tsx`.

```bash
grep -rn "FOOD_COLORS" --include="*.tsx" --include="*.ts" app/ components/ lib/
```

Update `components/feed/feed-timeline.tsx` — replace `FOOD_COLORS` with `FOOD_ICONS`:

```tsx
import { FOOD_ICONS } from "@/lib/colors";
// ... in render:
// Replace: const c = foodType ? FOOD_COLORS[foodType] : null;
// With:    const icon = foodType ? FOOD_ICONS[foodType] : null;
// Replace the badge span with just the emoji inline
```

- [ ] **Step 5: Verify build**

```bash
pnpm build
```

Fix any type errors from the FOOD_COLORS → FOOD_ICONS migration. Other pages using FOOD_COLORS will break — that's expected, they get rewritten in Tasks 3-6.

- [ ] **Step 6: Commit**

```bash
git add components/layout/header.tsx lib/colors.ts lib/strings.ts components/feed/feed-timeline.tsx
git commit -m "feat: shared header, slim colors to icons-only, add recommendation strings"
```

---

### Task 3: Recommendation block & month calendar

**Files:**
- Create: `components/home/recommendation.tsx`
- Create: `components/home/month-calendar.tsx`
- Create: `components/ui/toast.tsx`

**Interfaces:**
- Consumes: `Event` type from `lib/types`, `FOOD_ICONS` from `lib/colors`, recommendation strings from `lib/strings`
- Produces: `<Recommendation events={Event[]} />`, `<MonthCalendar events={Event[]} onSelectDate={(dateStr) => void} />`, `<Toast />`

- [ ] **Step 1: Create toast component**

Create `components/ui/toast.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);

  const show = useCallback((text: string) => {
    setMsg(text);
    setVisible(true);
    setTimeout(() => setVisible(false), 2000);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-all duration-300 pointer-events-none z-[100]"
        style={{
          background: "var(--fg)",
          color: "var(--bg)",
          opacity: visible ? 1 : 0,
          transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
        }}
      >
        {msg}
      </div>
    </ToastContext>
  );
}
```

- [ ] **Step 2: Create recommendation block**

Create `components/home/recommendation.tsx`:

```tsx
import Link from "next/link";
import type { Event } from "@/lib/types";
import { FOOD_ICONS } from "@/lib/colors";
import { formatTime } from "@/lib/calendar-utils";
import { S } from "@/lib/strings";

interface RecommendationProps {
  events: Event[];
}

function getRecommendation(events: Event[]): { label: string; items: Event[] } {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const todayEvents = events.filter((e) => e.start_at.slice(0, 10) === todayStr);
  if (todayEvents.length > 0) {
    const food = todayEvents[0].food_note || todayEvents[0].food_type;
    return { label: S.REC_TODAY_MEAL(food), items: todayEvents };
  }

  const tomorrowEvents = events.filter((e) => e.start_at.slice(0, 10) === tomorrowStr);
  if (tomorrowEvents.length > 0) {
    const food = tomorrowEvents[0].food_note || tomorrowEvents[0].food_type;
    return { label: S.REC_TOMORROW_MEAL(food), items: tomorrowEvents };
  }

  const weekEvents = events.filter(
    (e) => e.start_at.slice(0, 10) > todayStr && e.start_at.slice(0, 10) <= weekEnd,
  );
  if (weekEvents.length > 0) {
    const d = new Date(weekEvents[0].start_at);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${S.DAYS[d.getDay()]}요일`;
    return { label: S.REC_NEXT_EVENT(dateStr), items: weekEvents.slice(0, 2) };
  }

  return { label: S.REC_EMPTY_WEEK, items: [] };
}

export function Recommendation({ events }: RecommendationProps) {
  const { label, items } = getRecommendation(events);

  return (
    <div className="px-5 pt-5 pb-6">
      <div
        className="text-[18px] font-extrabold leading-[1.4] whitespace-pre-line"
        style={{ letterSpacing: "-0.03em" }}
      >
        {label.split(/(\*\*.*?\*\*)/g).map((part, i) =>
          part.startsWith("**") ? (
            <em key={i} className="not-italic" style={{ color: "var(--point)" }}>
              {part.slice(2, -2)}
            </em>
          ) : (
            part
          ),
        )}
      </div>

      {items.map((event) => (
        <Link
          key={event.id}
          href={`/events/${event.id}`}
          className="flex items-center gap-3 py-3 active:opacity-60"
          style={{ borderTop: "1px solid var(--g9)", marginTop: "14px" }}
        >
          <span className="emoji text-[28px]">{FOOD_ICONS[event.food_type]}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold" style={{ letterSpacing: "-0.02em" }}>
              {event.food_note || event.food_type}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: "var(--g5)" }}>
              {event.title} · {event.location || ""}
            </div>
          </div>
          <div
            className="text-[14px] font-bold shrink-0"
            style={{ color: "var(--g5)", fontVariantNumeric: "tabular-nums" }}
          >
            {formatTime(event.start_at)}
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create month calendar**

Create `components/home/month-calendar.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Event } from "@/lib/types";
import { S } from "@/lib/strings";

interface MonthCalendarProps {
  events: Event[];
  onSelectDate: (dateStr: string) => void;
}

export function MonthCalendar({ events, onSelectDate }: MonthCalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const eventCounts = new Map<string, number>();
  for (const e of events) {
    const d = e.start_at.slice(0, 10);
    eventCounts.set(d, (eventCounts.get(d) || 0) + 1);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

  const days: { day: number; ds: string; muted: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    days.push({ day: d, ds: dateStr(y, m, d), muted: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, ds: dateStr(year, month + 1, d), muted: false });
  }
  const rem = 7 - (days.length % 7);
  if (rem < 7) {
    for (let d = 1; d <= rem; d++) {
      const m = month + 2 > 12 ? 1 : month + 2;
      const y = month + 2 > 12 ? year + 1 : year;
      days.push({ day: d, ds: dateStr(y, m, d), muted: true });
    }
  }

  return (
    <div className="px-5 pt-5 pb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] font-bold">{S.CAL_MONTH(year, month + 1)}</span>
        <div className="flex gap-0.5" style={{ color: "var(--g5)" }}>
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="w-7 h-7 flex items-center justify-center text-sm"
          >
            ‹
          </button>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="w-7 h-7 flex items-center justify-center text-sm"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {S.DAYS.map((d) => (
          <div
            key={d}
            className="text-[10px] font-bold pb-2"
            style={{ color: "var(--g5)", letterSpacing: "0.04em" }}
          >
            {d}
          </div>
        ))}
        {days.map(({ day, ds, muted }, i) => {
          const isToday = ds === todayStr;
          const count = eventCounts.get(ds) || 0;
          return (
            <button
              key={i}
              onClick={() => count > 0 && onSelectDate(ds)}
              className="flex flex-col items-center py-1.5 text-[13px]"
              style={{
                color: muted ? "var(--g7)" : isToday ? "var(--point)" : "var(--g3)",
                fontWeight: isToday || count > 0 ? 700 : 400,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span>{day}</span>
              <span className="flex gap-0.5 h-[5px] items-center mt-0.5">
                {count > 0 && (
                  <span
                    className="block mt-0.5"
                    style={{
                      width: count > 1 ? 10 : 4,
                      height: 4,
                      borderRadius: count > 1 ? 2 : "50%",
                      background: "var(--point)",
                    }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify components render**

Temporarily import into events page and confirm rendering. Full integration happens in Task 4.

- [ ] **Step 5: Commit**

```bash
git add components/ui/toast.tsx components/home/recommendation.tsx components/home/month-calendar.tsx
git commit -m "feat: recommendation block, month calendar, toast component"
```

---

### Task 4: Bottom sheet & rewrite main events page

**Files:**
- Create: `components/ui/bottom-sheet.tsx`
- Modify: `app/events/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `<Header />`, `<Recommendation />`, `<MonthCalendar />`, `<BottomSheet />`, `<FoodFilter />`, `<ToastProvider />`
- Produces: Working `/events` page with new layout

- [ ] **Step 1: Create bottom sheet**

Create `components/ui/bottom-sheet.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 max-w-[480px] mx-auto max-h-[60vh] overflow-y-auto"
        style={{
          background: "var(--bg)",
          borderTop: "1px solid var(--g7)",
          animation: "slideUp .3s cubic-bezier(.4,0,.2,1)",
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1" style={{ background: "var(--g7)", borderRadius: 2 }} />
        </div>
        {children}
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite events page**

Replace the entire `app/events/page.tsx` with the new layout:

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Event } from "@/lib/types";
import { MOCK_EVENTS } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { FOOD_ICONS } from "@/lib/colors";
import { formatTime, formatDate } from "@/lib/calendar-utils";
import { S } from "@/lib/strings";
import { Header } from "@/components/layout/header";
import { Recommendation } from "@/components/home/recommendation";
import { MonthCalendar } from "@/components/home/month-calendar";
import { FoodFilter } from "@/components/events/food-filter";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ToastProvider } from "@/components/ui/toast";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);
  const [filter, setFilter] = useState<import("@/lib/types").FoodType | null>(null);
  const [sheetDate, setSheetDate] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      if (!supabase) { setEvents(MOCK_EVENTS); return; }
      const { data } = await supabase
        .from("events")
        .select("*")
        .gte("start_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("start_at", { ascending: true });
      setEvents(data?.length ? data : MOCK_EVENTS);
    }
    fetchEvents();
  }, []);

  const filtered = events.filter((e) => !filter || e.food_type === filter);
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = filtered.filter((e) => e.start_at.slice(0, 10) >= todayStr);

  // Group by date for the list section
  const grouped = new Map<string, Event[]>();
  for (const e of upcoming) {
    const d = e.start_at.slice(0, 10);
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(e);
  }

  const sheetEvents = sheetDate
    ? filtered.filter((e) => e.start_at.slice(0, 10) === sheetDate)
    : [];

  function dateLabel(ds: string): string {
    const d = new Date(ds + "T00:00:00");
    const diff = Math.round((d.getTime() - new Date(todayStr + "T00:00:00").getTime()) / 86400000);
    const dayName = S.DAYS[d.getDay()];
    if (diff === 0) return "오늘";
    if (diff === 1) return `내일 ${d.getMonth() + 1}/${d.getDate()} ${dayName}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${dayName}`;
  }

  return (
    <ToastProvider>
      <div className="max-w-[480px] mx-auto min-h-screen">
        <Header>
          <Link href="/profile" className="text-[13px]" style={{ color: "var(--g5)" }}>
            프로필
          </Link>
          <Link href="/submit" className="text-[13px]" style={{ color: "var(--g5)" }}>
            + 제보
          </Link>
        </Header>

        <Recommendation events={filtered} />

        <div style={{ height: 6, background: "var(--g9)" }} />

        <MonthCalendar events={filtered} onSelectDate={setSheetDate} />

        <div style={{ height: 6, background: "var(--g9)" }} />

        <div className="px-5 pb-3 pt-4">
          <FoodFilter selected={filter} onSelect={setFilter} />
        </div>

        <div className="px-5 pb-20">
          {[...grouped.entries()].map(([ds, evts]) => (
            <div key={ds}>
              <div
                className="text-[12px] font-bold pt-4 pb-2"
                style={{ color: "var(--g5)", letterSpacing: "0.01em" }}
              >
                {dateLabel(ds)}
              </div>
              {evts.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex items-baseline gap-2.5 py-2.5 active:opacity-60"
                  style={{ borderTop: "1px solid var(--g9)" }}
                >
                  <span
                    className="text-[12px] font-semibold w-[38px] text-right shrink-0"
                    style={{ color: "var(--g5)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatTime(event.start_at)}
                  </span>
                  <span className="emoji text-[16px] shrink-0">{FOOD_ICONS[event.food_type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold" style={{ letterSpacing: "-0.01em" }}>
                      {event.food_note || event.food_type}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--g5)" }}>
                      {event.title} · {event.location || ""}
                    </div>
                  </div>
                  {event.register_url && (
                    <span className="text-[10px] font-extrabold shrink-0" style={{ color: "var(--point)" }}>
                      신청
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
          {upcoming.length === 0 && (
            <div className="text-center py-20 text-[14px]" style={{ color: "var(--g5)" }}>
              {S.EVENTS_EMPTY}
            </div>
          )}
        </div>

        <BottomSheet open={!!sheetDate} onClose={() => setSheetDate(null)}>
          <div className="px-5 pb-6">
            <div className="text-[14px] font-bold py-3">
              {sheetDate && dateLabel(sheetDate)}
            </div>
            {sheetEvents.length === 0 && (
              <div className="text-[13px] py-4" style={{ color: "var(--g5)" }}>
                이 날은 행사가 없어요
              </div>
            )}
            {sheetEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-center gap-3 py-3 active:opacity-60"
                style={{ borderTop: "1px solid var(--g9)" }}
                onClick={() => setSheetDate(null)}
              >
                <span className="emoji text-[24px]">{FOOD_ICONS[event.food_type]}</span>
                <div className="flex-1">
                  <div className="text-[14px] font-bold">{event.food_note || event.food_type}</div>
                  <div className="text-[12px]" style={{ color: "var(--g5)" }}>
                    {formatTime(event.start_at)} · {event.location || ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </BottomSheet>
      </div>
    </ToastProvider>
  );
}
```

- [ ] **Step 3: Update FoodFilter styling**

Modify `components/events/food-filter.tsx` — remove colored backgrounds, use border-only chips:

```tsx
"use client";

import type { FoodType } from "@/lib/types";
import { FOOD_ICONS } from "@/lib/colors";

interface FoodFilterProps {
  selected: FoodType | null;
  onSelect: (type: FoodType | null) => void;
}

const TYPES: FoodType[] = ["버거", "도시락", "샌드위치", "간식", "식사"];

export function FoodFilter({ selected, onSelect }: FoodFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onSelect(null)}
        className="px-3 py-1 text-[12px] font-semibold transition-colors"
        style={{
          border: `1.5px solid ${selected === null ? "var(--fg)" : "var(--g7)"}`,
          color: selected === null ? "var(--fg)" : "var(--g5)",
          background: selected === null ? "var(--fg)" : "transparent",
          ...(selected === null ? { color: "var(--bg)" } : {}),
        }}
      >
        전체
      </button>
      {TYPES.map((type) => (
        <button
          key={type}
          onClick={() => onSelect(selected === type ? null : type)}
          className="px-3 py-1 text-[12px] font-semibold transition-colors"
          style={{
            border: `1.5px solid ${selected === type ? "var(--fg)" : "var(--g7)"}`,
            color: selected === type ? "var(--fg)" : "var(--g5)",
          }}
        >
          <span className="emoji">{FOOD_ICONS[type]}</span> {type}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Test the full main page**

Run `pnpm dev`, navigate to `/events`. Verify:
- Recommendation block shows at top
- Month calendar renders below
- Tapping a date with events opens bottom sheet
- Food filter works
- Event list is grouped by date
- No rounded-xl, backdrop-blur, gradient, or shadow anywhere

- [ ] **Step 5: Commit**

```bash
git add components/ui/bottom-sheet.tsx app/events/page.tsx components/events/food-filter.tsx
git commit -m "feat: rewrite main events page — recommendation, calendar, bottom sheet"
```

---

### Task 5: Event detail page & toss-style profile flow

**Files:**
- Create: `components/ui/toss-profile-flow.tsx`
- Modify: `app/events/[id]/page.tsx` (full restyle)
- Modify: `components/events/auto-register-button.tsx`
- Modify: `components/events/attendee-section.tsx`

**Interfaces:**
- Consumes: `<Header />`, `FOOD_ICONS`, `getProfile`/`saveProfile` from `lib/auto-register`, `<ToastProvider />`
- Produces: `<TossProfileFlow onComplete={(profile) => void} open={boolean} onClose={() => void} />`

- [ ] **Step 1: Create toss-style profile flow**

Create `components/ui/toss-profile-flow.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { saveProfile, type UserProfile } from "@/lib/auto-register";
import { useToast } from "@/components/ui/toast";

interface TossProfileFlowProps {
  open: boolean;
  onClose: () => void;
  onComplete: (profile: UserProfile) => void;
}

interface Step {
  key: keyof UserProfile;
  question: string;
  type: "text" | "email" | "chips";
  placeholder?: string;
  inputMode?: "numeric" | "email" | "text";
  options?: string[];
}

const STEPS: Step[] = [
  { key: "name", question: "이름이\n어떻게 되세요?", type: "text", placeholder: "홍길동" },
  { key: "student_id", question: "학번을\n알려주세요", type: "text", placeholder: "20250000", inputMode: "numeric" },
  { key: "department", question: "어느 학과\n소속이세요?", type: "chips", options: ["전산학부", "전기전자", "기계공학", "생명과학", "물리학", "수리과학", "화학", "기타"] },
  { key: "email", question: "이메일 주소를\n입력해주세요", type: "email", placeholder: "hong@kaist.ac.kr" },
];

const LABELS: Record<string, string> = {
  name: "이름", student_id: "학번", department: "학과", email: "이메일",
};

export function TossProfileFlow({ open, onClose, onComplete }: TossProfileFlowProps) {
  const [step, setStep] = useState(0);
  const [curValue, setCurValue] = useState("");
  const [doneValues, setDoneValues] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setStep(0);
      setCurValue("");
      setDoneValues([]);
    }
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open, step]);

  if (!open) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function goNext() {
    if (!curValue) return;
    const newDone = [...doneValues, curValue];
    setDoneValues(newDone);

    if (isLast) {
      const profile: UserProfile = {
        name: newDone[0],
        student_id: newDone[1],
        department: newDone[2],
        email: newDone[3],
        phone: "",
      };
      saveProfile(profile);
      toast("프로필이 기기에 저장되었어요");
      onComplete(profile);
      return;
    }

    setStep(step + 1);
    setCurValue("");
  }

  function goBack() {
    if (step === 0) { onClose(); return; }
    const prev = doneValues.slice(0, -1);
    setDoneValues(prev);
    setCurValue(doneValues[doneValues.length - 1]);
    setStep(step - 1);
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col max-w-[480px] mx-auto" style={{ background: "var(--bg)" }}>
      <div className="px-5 py-4">
        <button onClick={goBack} className="text-[18px]" style={{ color: "var(--fg)" }}>←</button>
      </div>

      <div className="flex-1 px-6 flex flex-col overflow-y-auto">
        {doneValues.map((val, i) => (
          <div key={i} className="py-2.5 opacity-0 animate-[fadeIn_.3s_ease_forwards]">
            <div className="text-[12px] font-semibold" style={{ color: "var(--g5)" }}>
              {LABELS[STEPS[i].key]}
            </div>
            <div className="text-[15px] font-bold mt-0.5">{val}</div>
          </div>
        ))}

        <div className="flex-1 flex flex-col justify-center min-h-[200px]">
          <div className="text-[22px] font-black mb-6 whitespace-pre-line" style={{ letterSpacing: "-0.04em", lineHeight: 1.35 }}>
            {s.question}
          </div>

          {s.type === "chips" ? (
            <div className="flex flex-wrap gap-2.5">
              {s.options!.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setCurValue(opt)}
                  className="px-5 py-2.5 text-[15px] font-semibold transition-all active:scale-[0.96]"
                  style={{
                    border: `1.5px solid ${curValue === opt ? "var(--fg)" : "var(--g7)"}`,
                    color: curValue === opt ? "var(--fg)" : "var(--g5)",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input
              ref={inputRef}
              type={s.type}
              value={curValue}
              onChange={(e) => setCurValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && curValue && goNext()}
              placeholder={s.placeholder}
              inputMode={s.inputMode}
              autoComplete="off"
              autoCorrect="off"
              className="w-full pb-3 text-[24px] font-bold outline-none"
              style={{
                background: "none",
                borderBottom: `2px solid ${curValue ? "var(--fg)" : "var(--g7)"}`,
                color: "var(--fg)",
                letterSpacing: "-0.02em",
                fontFamily: "inherit",
              }}
            />
          )}
        </div>
      </div>

      <div className="px-6 pb-9 pt-4">
        <button
          onClick={goNext}
          disabled={!curValue}
          className="w-full py-4 text-[15px] font-bold transition-all"
          style={{
            background: curValue ? "var(--fg)" : "var(--g7)",
            color: curValue ? "var(--bg)" : "var(--g5)",
            cursor: curValue ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          {isLast ? "완료" : "다음"}
        </button>
      </div>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
```

- [ ] **Step 2: Restyle event detail page**

Rewrite `app/events/[id]/page.tsx` — use shared header, minimal styling, integrate toss profile flow. The full file replaces the existing one. Key changes:
- Use `<Header back="/events" title="행사 상세" />`
- Food emoji + food name above event title
- No colored badge backgrounds
- No border-l stripe
- Description block: no background, just left border in `--g7`
- Wrap in `<ToastProvider>` for toast support
- When auto-register or "나도 갈래요" is tapped, check `getProfile()` — if null, open `<TossProfileFlow>`

- [ ] **Step 3: Update auto-register-button to trigger TossProfileFlow**

Modify `components/events/auto-register-button.tsx`:
- Remove the inline `<ProfileForm>` usage
- Accept an `onNeedProfile: () => void` prop
- When profile is missing, call `onNeedProfile()` instead of showing inline form
- Parent (detail page) opens TossProfileFlow in response

- [ ] **Step 4: Update attendee-section similarly**

Modify `components/events/attendee-section.tsx`:
- Accept `onNeedProfile: () => void` prop
- Restyle: remove rounded-lg, use border-top for separation
- When "나도 갈래요" is tapped without profile, call `onNeedProfile()`

- [ ] **Step 5: Test event detail page end-to-end**

Run `pnpm dev`, click an event from the main page. Verify:
- Header shows ← and title
- Food info appears above event title
- "자동신청" triggers toss profile flow if no profile
- Profile saves and auto-registers
- "나도 갈래요" works similarly

- [ ] **Step 6: Commit**

```bash
git add components/ui/toss-profile-flow.tsx app/events/\[id\]/page.tsx \
  components/events/auto-register-button.tsx components/events/attendee-section.tsx
git commit -m "feat: event detail restyle, toss-style profile collection flow"
```

---

### Task 6: Onboarding, landing redirect, submit/feed/profile restyle

**Files:**
- Create: `components/onboarding/onboarding-slides.tsx`
- Modify: `app/page.tsx` (landing → onboarding gate)
- Modify: `app/submit/page.tsx` (restyle)
- Modify: `app/feed/page.tsx` (restyle)
- Modify: `app/profile/page.tsx` (restyle)
- Modify: `components/feed/feed-timeline.tsx` (restyle)
- Modify: `components/profile/profile-form.tsx` (restyle)
- Delete: `components/events/event-card.tsx`
- Delete: `components/calendar/mini-calendar.tsx`

**Interfaces:**
- Consumes: `<Header />`, `<ToastProvider />`, all previously created components

- [ ] **Step 1: Create onboarding slides**

Create `components/onboarding/onboarding-slides.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";

interface OnboardingSlidesProps {
  onComplete: () => void;
}

const SLIDES = [
  { emoji: "🍚", title: "배고픈 카이스트인을 위한\n공짜밥 알리미", desc: "학교 메일에서 밥 주는 행사만 쏙쏙 골라서 알려드려요." },
  { emoji: "📅", title: "캘린더로 한눈에,\n놓치는 밥 없이", desc: "언제 어디서 뭘 주는지 달력에서 바로 확인. 오늘 점심 뭐 먹을지 고민 끝." },
  { emoji: "⚡", title: "사전신청도\n원클릭으로", desc: "프로필 한 번 등록하면 구글폼 자동 제출. 선착순도 안 밀려요." },
];

export function OnboardingSlides({ onComplete }: OnboardingSlidesProps) {
  const [cur, setCur] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);

  function go(n: number) {
    setCur(n);
    if (sliderRef.current) {
      sliderRef.current.style.transform = `translateX(-${n * 100}%)`;
    }
  }

  function handleNext() {
    if (cur < 2) go(cur + 1);
    else {
      localStorage.setItem("ssal-onboarded", "1");
      onComplete();
    }
  }

  return (
    <div className="min-h-screen flex flex-col max-w-[480px] mx-auto" style={{ background: "var(--bg)" }}>
      <div
        ref={sliderRef}
        className="flex-1 flex transition-transform duration-400"
        style={{ transitionTimingFunction: "cubic-bezier(.4,0,.2,1)" }}
        onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - startX.current;
          if (Math.abs(dx) > 50) {
            if (dx < 0 && cur < 2) go(cur + 1);
            if (dx > 0 && cur > 0) go(cur - 1);
          }
        }}
      >
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className="min-w-full px-7 flex flex-col justify-center transition-opacity duration-350"
            style={{ opacity: i === cur ? 1 : 0 }}
          >
            <div className="emoji text-[56px] mb-5">{s.emoji}</div>
            <div className="text-[22px] font-black leading-[1.35] mb-2.5 whitespace-pre-line" style={{ letterSpacing: "-0.04em" }}>
              {s.title}
            </div>
            <div className="text-[14px] leading-relaxed" style={{ color: "var(--g3)" }}>
              {s.desc}
            </div>
          </div>
        ))}
      </div>

      <div className="px-7 pb-9 flex items-center justify-between">
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="h-1.5 transition-all duration-300"
              style={{
                width: i === cur ? 20 : 6,
                borderRadius: 3,
                background: i === cur ? "var(--fg)" : "var(--g7)",
              }}
            />
          ))}
        </div>
        <button
          onClick={handleNext}
          className="px-7 py-3 text-[14px] font-bold"
          style={{ background: "var(--fg)", color: "var(--bg)" }}
        >
          {cur === 2 ? "시작하기" : "다음"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite landing page as onboarding gate**

Replace `app/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingSlides } from "@/components/onboarding/onboarding-slides";

export default function LandingPage() {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    const done = localStorage.getItem("ssal-onboarded");
    if (done) {
      router.replace("/events");
    } else {
      setShowOnboarding(true);
    }
  }, [router]);

  if (showOnboarding === null) return null;

  return (
    <OnboardingSlides onComplete={() => router.replace("/events")} />
  );
}
```

- [ ] **Step 3: Restyle submit page**

Modify `app/submit/page.tsx`:
- Replace header with `<Header back="/events" title="쌀먹 제보" />`
- Remove all colored backgrounds from inputs — use `background: var(--bg)`, `border-bottom: 1.5px solid var(--g7)` instead of full border
- Food type chips: border-only, no background colors
- Submit button: `background: var(--fg)`, `color: var(--bg)`
- Success page: 🎉 emoji (no animation), simple text + back link
- Max-width 480px centered

- [ ] **Step 4: Restyle feed page and feed-timeline**

Modify `app/feed/page.tsx`:
- Replace header with `<Header back="/events" title="업데이트" />`
- Max-width 480px centered

Modify `components/feed/feed-timeline.tsx`:
- Use `FOOD_ICONS` instead of `FOOD_COLORS`
- Remove colored badge backgrounds — just show emoji + food type inline
- Use `var(--g9)` for dividers

- [ ] **Step 5: Restyle profile page and profile-form**

Modify `app/profile/page.tsx`:
- Replace header with `<Header back="/events" title="내 프로필" />`
- Max-width 480px centered

Modify `components/profile/profile-form.tsx`:
- Remove white/stone card wrapper — no background, no border, no rounded
- Input fields: `border-bottom: 1.5px solid var(--g7)`, no border-radius, bg transparent
- Save button: `background: var(--fg)`, `color: var(--bg)`
- Clear button: `border: 1.5px solid var(--g7)`

- [ ] **Step 6: Delete unused components**

```bash
rm components/events/event-card.tsx components/calendar/mini-calendar.tsx
```

Verify no other files import them:

```bash
grep -rn "event-card\|EventCard\|mini-calendar\|MiniCalendar" --include="*.tsx" --include="*.ts" app/ components/
```

- [ ] **Step 7: Full build test**

```bash
pnpm build
```

Fix any remaining type errors or broken imports.

- [ ] **Step 8: Manual QA**

Run `pnpm dev` and test every page:
- `/` — shows onboarding on first visit, redirects to `/events` on return
- `/events` — recommendation block, calendar, bottom sheet, filter, list
- `/events/[id]` — detail with toss profile flow
- `/submit` — restyled form
- `/feed` — restyled timeline
- `/profile` — restyled form
- No rounded-xl, backdrop-blur, gradient, shadow-lg, or colored card backgrounds anywhere

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: onboarding, restyle submit/feed/profile, delete unused components"
```

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Event, FoodType } from "@/lib/types";
import { MOCK_EVENTS } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { FOOD_ICONS } from "@/lib/colors";
import { formatTime } from "@/lib/calendar-utils";
import { S } from "@/lib/strings";
import { Header } from "@/components/layout/header";
import { Recommendation } from "@/components/home/recommendation";
import { MonthCalendar } from "@/components/home/month-calendar";
import { FoodFilter } from "@/components/events/food-filter";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ToastProvider } from "@/components/ui/toast";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);
  const [filter, setFilter] = useState<FoodType | null>(null);
  const [sheetDate, setSheetDate] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      if (!supabase) {
        setEvents(MOCK_EVENTS);
        return;
      }
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
    const diff = Math.round(
      (d.getTime() - new Date(todayStr + "T00:00:00").getTime()) / 86400000,
    );
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

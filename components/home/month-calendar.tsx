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

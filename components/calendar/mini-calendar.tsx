"use client";

import { useState } from "react";
import type { Event } from "@/lib/types";
import { FOOD_COLORS } from "@/lib/colors";
import { S } from "@/lib/strings";
import { getTimeSlot } from "@/lib/calendar-utils";

const SLOT_CHAR: Record<"morning" | "lunch" | "dinner", string> = {
  morning: S.CAL_MORNING[0],
  lunch: S.CAL_LUNCH[0],
  dinner: S.CAL_DINNER[0],
};

interface MiniCalendarProps {
  events: Event[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export function MiniCalendar({ events, selectedDate, onSelectDate }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const eventsByDate = new Map<string, Event[]>();
  for (const e of events) {
    const d = e.start_at.slice(0, 10);
    if (!eventsByDate.has(d)) eventsByDate.set(d, []);
    eventsByDate.get(d)!.push(e);
  }

  const days: { day: number; dateStr: string; isOther: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    days.push({ day: d, dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isOther: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isOther: false });
  }
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = month + 2 > 12 ? 1 : month + 2;
      const y = month + 2 > 12 ? year + 1 : year;
      days.push({ day: d, dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isOther: true });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold">{S.CAL_MONTH(year, month + 1)}</span>
        <div className="flex gap-1">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="w-7 h-7 rounded-full border border-stone-200 dark:border-stone-700 text-stone-500 text-xs flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800">&#8249;</button>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="w-7 h-7 rounded-full border border-stone-200 dark:border-stone-700 text-stone-500 text-xs flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800">&#8250;</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {S.DAYS.map((d) => (
          <div key={d} className="text-[10px] font-bold text-stone-400 dark:text-stone-600 uppercase tracking-wider py-1">{d}</div>
        ))}
        {days.map(({ day, dateStr, isOther }, i) => {
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const dayEvents = eventsByDate.get(dateStr) || [];
          return (
            <button
              key={i}
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
              className={`flex flex-col items-center rounded-lg text-xs font-medium transition-colors
                py-1 lg:py-1.5
                ${isOther ? "text-stone-300 dark:text-stone-700" : ""}
                ${isToday ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold" : ""}
                ${isSelected && !isToday ? "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-bold" : ""}
                ${!isToday && !isSelected && !isOther ? "hover:bg-stone-100 dark:hover:bg-stone-800" : ""}
              `}
            >
              <span className="leading-tight">{day}</span>
              {/* Fixed-height slot area */}
              <div className="h-2.5 lg:h-3.5 flex items-start justify-center gap-px mt-px">
                {dayEvents.slice(0, 3).map((e, j) => {
                  const slot = getTimeSlot(e.start_at);
                  const colors = FOOD_COLORS[e.food_type];
                  return (
                    <span key={j}>
                      {/* Mobile: dot */}
                      <span className={`block lg:hidden w-1 h-1 rounded-full mt-0.5 ${colors.dot} ${isToday ? "opacity-70" : ""}`} />
                      {/* Desktop: slot char */}
                      <span className={`hidden lg:block text-[8px] leading-none px-0.5 rounded ${colors.bg} ${colors.text} font-bold ${isToday ? "opacity-80" : ""}`}>
                        {SLOT_CHAR[slot]}
                      </span>
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

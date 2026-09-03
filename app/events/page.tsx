"use client";

import { useState, useEffect } from "react";
import type { Event, FoodType } from "@/lib/types";
import { MOCK_EVENTS, MOCK_LOGS } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { MiniCalendar } from "@/components/calendar/mini-calendar";
import { EventCard } from "@/components/events/event-card";
import { FoodFilter } from "@/components/events/food-filter";
import { FeedTimeline } from "@/components/feed/feed-timeline";
import { S } from "@/lib/strings";
import Link from "next/link";

export default function EventsPage() {
  const [filter, setFilter] = useState<FoodType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);

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

  const filtered = events.filter((e) => {
    if (filter && e.food_type !== filter) return false;
    if (selectedDate && !e.start_at.startsWith(selectedDate)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.title.toLowerCase().includes(q) && !e.food_type.includes(q) && !(e.food_note || "").toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = filtered.filter((e) => e.start_at.slice(0, 10) === today);
  const futureEvents = filtered.filter((e) => e.start_at.slice(0, 10) > today);
  const pastEvents = filtered.filter((e) => e.start_at.slice(0, 10) < today);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-stone-50/80 dark:bg-stone-950/80 backdrop-blur-lg border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-base sm:text-lg shrink-0 whitespace-nowrap" style={{ letterSpacing: "-0.03em" }}>
            <span className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-xs sm:text-sm emoji">🍚</span>
            <span className="hidden sm:inline">{S.APP_SHORT}</span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end">
            <input
              type="text"
              placeholder={S.SEARCH_PLACEHOLDER}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-full px-3 sm:px-4 py-1.5 text-sm min-w-0 flex-1 max-w-64 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <Link
              href="/submit"
              className="shrink-0 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center"
            >
              <span className="sm:hidden">+</span>
              <span className="hidden sm:inline">+ {S.SUBMIT_TITLE}</span>
            </Link>
            <Link
              href="/profile"
              className="shrink-0 w-8 h-8 rounded-lg border border-stone-200 dark:border-stone-800 flex items-center justify-center text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              👤
            </Link>
            <Link
              href="/feed"
              className="shrink-0 relative w-8 h-8 rounded-lg border border-stone-200 dark:border-stone-800 flex items-center justify-center text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              🔔
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 border-2 border-stone-50 dark:border-stone-950" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[300px_1fr] min-h-[calc(100vh-57px)]">
        <aside className="lg:border-r border-stone-200 dark:border-stone-800 p-5 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:overflow-y-auto">
          <FoodFilter selected={filter} onSelect={setFilter} />
          <div className="mt-5">
            <MiniCalendar events={events} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          </div>
          <div className="mt-6 hidden lg:block">
            <div className="text-[11px] font-bold text-stone-400 dark:text-stone-600 uppercase tracking-wider mb-3">
              {S.SECTION_RECENT_UPDATES}
            </div>
            <FeedTimeline logs={MOCK_LOGS} />
          </div>
        </aside>

        <main className="p-5">
          {todayEvents.length > 0 && (
            <>
              <div className="text-xs font-bold text-stone-400 mb-2">
                {S.SECTION_TODAY} <span className="text-orange-600">{todayEvents.length}{S.EVENTS_COUNT_UNIT}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
                {todayEvents.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            </>
          )}
          {futureEvents.length > 0 && (
            <>
              <div className="text-xs font-bold text-stone-400 mb-2">
                {S.SECTION_UPCOMING} <span className="text-orange-600">{futureEvents.length}{S.EVENTS_COUNT_UNIT}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {futureEvents.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            </>
          )}
          {pastEvents.length > 0 && (
            <>
              <div className="text-xs font-bold text-stone-400 mb-2 mt-6 opacity-60">
                지난 행사 <span className="text-stone-400">{pastEvents.length}{S.EVENTS_COUNT_UNIT}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 opacity-50">
                {pastEvents.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            </>
          )}
          {filtered.length === 0 && (
            <div className="text-center text-stone-400 py-20 text-sm">{S.EVENTS_EMPTY}</div>
          )}
        </main>
      </div>
    </div>
  );
}

"use client";

import { use, useState, useEffect } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Event } from "@/lib/types";
import { MOCK_EVENTS } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { FOOD_COLORS } from "@/lib/colors";
import { formatDateLong, formatTime, googleCalendarUrl } from "@/lib/calendar-utils";
import { AutoRegisterButton } from "@/components/events/auto-register-button";
import { S } from "@/lib/strings";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvent() {
      if (supabase) {
        const { data } = await supabase
          .from("events")
          .select("*")
          .eq("id", id)
          .single();
        if (data) {
          setEvent(data);
          setLoading(false);
          return;
        }
      }
      const mock = MOCK_EVENTS.find((e) => e.id === id);
      setEvent(mock || null);
      setLoading(false);
    }
    fetchEvent();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-stone-400 text-sm">...</div>
      </div>
    );
  }

  if (!event) notFound();

  const c = FOOD_COLORS[event.food_type];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-stone-50/80 dark:bg-stone-950/80 backdrop-blur-lg border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/events" className="text-stone-400 hover:text-stone-600 text-sm">
            {S.NAV_BACK}
          </Link>
          <span className="font-bold text-sm">{S.NAV_DETAIL}</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold mb-4 ${c.bg} ${c.text}`}>
          <span className="emoji">{c.icon}</span> {event.food_note || event.food_type}
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight mb-6" style={{ letterSpacing: "-0.025em" }}>
          {event.title}
        </h1>
        <div className="space-y-3 mb-6 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-stone-400 w-5 text-center">🕐</span>
            <span>
              {formatDateLong(event.start_at)}
              {event.end_at && ` – ${formatTime(event.end_at)}`}
            </span>
          </div>
          {event.location && (
            <div className="flex items-start gap-3">
              <span className="text-stone-400 w-5 text-center">📍</span>
              <span>{event.location}</span>
            </div>
          )}
          {event.target_audience && (
            <div className="flex items-start gap-3">
              <span className="text-stone-400 w-5 text-center">👥</span>
              <span>{event.target_audience}</span>
            </div>
          )}
        </div>
        {event.description && (
          <div className="text-sm text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-900 rounded-lg p-4 mb-6 leading-relaxed border-l-[3px] border-orange-500">
            {event.description}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <AutoRegisterButton
            formId={event.form_id}
            formMapping={event.form_mapping}
            registerUrl={event.register_url}
          />
          <a
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-sm border border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          >
            📅 {S.DETAIL_GOOGLE_CAL}
          </a>
          <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-sm border border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors">
            ⬇ {S.DETAIL_ICS}
          </button>
        </div>
      </main>
    </div>
  );
}

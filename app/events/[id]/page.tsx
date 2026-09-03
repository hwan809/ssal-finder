"use client";

import { use, useState, useEffect, useRef } from "react";
import { notFound } from "next/navigation";
import type { Event } from "@/lib/types";
import { MOCK_EVENTS } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { FOOD_ICONS } from "@/lib/colors";
import { formatDateLong, formatTime, googleCalendarUrl } from "@/lib/calendar-utils";
import { AutoRegisterButton, type AutoRegisterButtonHandle } from "@/components/events/auto-register-button";
import { AttendeeSection, type AttendeeSectionHandle } from "@/components/events/attendee-section";
import { TossProfileFlow } from "@/components/ui/toss-profile-flow";
import { Header } from "@/components/layout/header";
import { ToastProvider } from "@/components/ui/toast";
import { S } from "@/lib/strings";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ToastProvider>
      <EventDetailContent params={params} />
    </ToastProvider>
  );
}

function EventDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileFlow, setShowProfileFlow] = useState(false);
  const pendingActionRef = useRef<"register" | "attend" | null>(null);
  const autoRegisterRef = useRef<AutoRegisterButtonHandle>(null);
  const attendeeRef = useRef<AttendeeSectionHandle>(null);

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
        <div className="text-[13px]" style={{ color: "var(--g5)" }}>...</div>
      </div>
    );
  }

  if (!event) notFound();

  function openProfileFlow(action: "register" | "attend") {
    pendingActionRef.current = action;
    setShowProfileFlow(true);
  }

  function handleProfileComplete() {
    setShowProfileFlow(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action === "register") autoRegisterRef.current?.retry();
    if (action === "attend") attendeeRef.current?.retry();
  }

  return (
    <div className="max-w-[480px] mx-auto min-h-screen">
      <Header back="/events" title={S.NAV_DETAIL} />

      <main className="px-5 pb-20 pt-2">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="emoji text-[15px]">{FOOD_ICONS[event.food_type]}</span>
          <span className="text-[13px] font-bold" style={{ color: "var(--g5)" }}>
            {event.food_note || event.food_type}
          </span>
        </div>

        <h1 className="text-[21px] font-black mb-6" style={{ letterSpacing: "-0.03em", lineHeight: 1.3 }}>
          {event.title}
        </h1>

        <div className="space-y-2.5 mb-6 text-[14px]">
          <div className="flex items-start gap-3">
            <span className="emoji w-5 text-center shrink-0">🕐</span>
            <span>
              {formatDateLong(event.start_at)}
              {event.end_at && ` – ${formatTime(event.end_at)}`}
            </span>
          </div>
          {event.location && (
            <div className="flex items-start gap-3">
              <span className="emoji w-5 text-center shrink-0">📍</span>
              <span>{event.location}</span>
            </div>
          )}
          {event.target_audience && (
            <div className="flex items-start gap-3">
              <span className="emoji w-5 text-center shrink-0">👥</span>
              <span>{event.target_audience}</span>
            </div>
          )}
        </div>

        {event.description && (
          <div
            className="text-[13px] mb-6 py-0.5 pl-4 leading-relaxed"
            style={{ borderLeft: "3px solid var(--g7)", color: "var(--g5)" }}
          >
            {event.description}
          </div>
        )}

        <AttendeeSection
          ref={attendeeRef}
          eventId={id}
          onNeedProfile={() => openProfileFlow("attend")}
        />

        <div className="flex flex-col gap-2">
          <AutoRegisterButton
            ref={autoRegisterRef}
            eventId={id}
            formId={event.form_id}
            formMapping={event.form_mapping}
            registerUrl={event.register_url}
            onNeedProfile={() => openProfileFlow("register")}
          />
          <a
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-3 text-[14px] font-bold transition-opacity active:opacity-70"
            style={{ border: "1px solid var(--g7)", color: "var(--fg)" }}
          >
            <span className="emoji">📅</span> {S.DETAIL_GOOGLE_CAL}
          </a>
          <button
            className="flex items-center justify-center gap-2 px-4 py-3 text-[14px] font-bold transition-opacity active:opacity-70"
            style={{ border: "1px solid var(--g7)", color: "var(--fg)" }}
          >
            <span className="emoji">⬇</span> {S.DETAIL_ICS}
          </button>
        </div>
      </main>

      <TossProfileFlow
        open={showProfileFlow}
        onClose={() => setShowProfileFlow(false)}
        onComplete={handleProfileComplete}
      />
    </div>
  );
}

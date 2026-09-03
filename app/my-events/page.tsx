"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/auto-register";
import { FOOD_ICONS } from "@/lib/colors";
import { formatDate } from "@/lib/calendar-utils";
import { Header } from "@/components/layout/header";
import type { FoodType } from "@/lib/types";

interface Registration {
  id: string;
  event_id: string;
  profile_name: string;
  form_response: Record<string, string> | null;
  created_at: string;
  event?: {
    title: string;
    food_type: FoodType;
    food_note: string | null;
    start_at: string;
    location: string | null;
  } | null;
}

interface Attendance {
  id: string;
  event_id: string;
  nickname: string;
  created_at: string;
  event?: {
    title: string;
    food_type: FoodType;
    food_note: string | null;
    start_at: string;
    location: string | null;
  } | null;
}

export default function MyEventsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const profile = getProfile();

  useEffect(() => {
    if (!supabase || !profile?.name) return;

    supabase
      .from("registrations")
      .select("*, event:events(title, food_type, food_note, start_at, location)")
      .eq("profile_name", profile.name)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setRegistrations(data); });

    supabase
      .from("attendees")
      .select("*, event:events(title, food_type, food_note, start_at, location)")
      .eq("nickname", profile.name)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setAttendances(data); });
  }, [profile?.name]);

  if (!profile?.name) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen">
        <Header back="/events" title="나의 행사" />
        <div className="px-5 pt-20 text-center">
          <div className="text-[14px]" style={{ color: "var(--g5)" }}>
            프로필을 먼저 설정해주세요
          </div>
          <Link
            href="/profile"
            className="inline-block mt-4 px-6 py-2.5 text-[14px] font-bold"
            style={{ background: "var(--fg)", color: "var(--bg)" }}
          >
            프로필 설정
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto min-h-screen">
      <Header back="/events" title="나의 행사" />

      <div className="px-5 pt-4">
        {registrations.length > 0 && (
          <>
            <div
              className="text-[12px] font-bold pb-2"
              style={{ color: "var(--g5)", letterSpacing: "0.01em" }}
            >
              자동신청 완료
            </div>
            {registrations.map((reg) => (
              <div
                key={reg.id}
                className="py-3"
                style={{ borderTop: "1px solid var(--g9)" }}
              >
                <Link
                  href={`/events/${reg.event_id}`}
                  className="flex items-center gap-3 active:opacity-60"
                >
                  <span className="emoji text-[22px] shrink-0">
                    {reg.event ? FOOD_ICONS[reg.event.food_type] : "📋"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold" style={{ letterSpacing: "-0.01em" }}>
                      {reg.event?.title || "행사"}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--g5)" }}>
                      {reg.event?.start_at ? formatDate(reg.event.start_at) : ""} · {reg.event?.location || ""}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--point)" }}>
                    신청완료
                  </span>
                </Link>

                {reg.form_response && (
                  <button
                    onClick={() => setExpandedId(expandedId === reg.id ? null : reg.id)}
                    className="mt-2 text-[11px] font-semibold"
                    style={{ color: "var(--g5)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    {expandedId === reg.id ? "응답 접기 ▲" : "제출한 응답 보기 ▼"}
                  </button>
                )}

                {expandedId === reg.id && reg.form_response && (
                  <div className="mt-2 pl-9" style={{ borderLeft: "2px solid var(--g9)" }}>
                    {Object.entries(reg.form_response).map(([key, val]) => (
                      <div key={key} className="py-1">
                        <span className="text-[11px]" style={{ color: "var(--g7)" }}>
                          {key}
                        </span>
                        <span className="text-[12px] font-semibold ml-2">
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {attendances.length > 0 && (
          <>
            <div
              className="text-[12px] font-bold pb-2 mt-6"
              style={{ color: "var(--g5)", letterSpacing: "0.01em" }}
            >
              참석 표시
            </div>
            {attendances.map((att) => (
              <Link
                key={att.id}
                href={`/events/${att.event_id}`}
                className="flex items-center gap-3 py-3 active:opacity-60"
                style={{ borderTop: "1px solid var(--g9)" }}
              >
                <span className="emoji text-[22px] shrink-0">
                  {att.event ? FOOD_ICONS[att.event.food_type] : "🙋"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold" style={{ letterSpacing: "-0.01em" }}>
                    {att.event?.title || "행사"}
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--g5)" }}>
                    {att.event?.start_at ? formatDate(att.event.start_at) : ""} · {att.event?.location || ""}
                  </div>
                </div>
                <span className="text-[11px] font-semibold shrink-0" style={{ color: "var(--g5)" }}>
                  갈래
                </span>
              </Link>
            ))}
          </>
        )}

        {registrations.length === 0 && attendances.length === 0 && (
          <div className="text-center pt-20">
            <div className="text-[14px]" style={{ color: "var(--g5)" }}>
              아직 신청한 행사가 없어요
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

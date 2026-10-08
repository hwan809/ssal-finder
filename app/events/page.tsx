"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EVENT_CATEGORIES, type Event, type EventCategory, type FoodType } from "@/lib/types";
import { MOCK_EVENTS } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { CATEGORY_ICONS, FOOD_ICONS } from "@/lib/colors";
import { formatTime, shortFoodName } from "@/lib/calendar-utils";
import { eventIcon, eventsForMode, isFood } from "@/lib/event-display";
import { useMode } from "@/lib/use-mode";
import { getProfile } from "@/lib/auto-register";
import { S } from "@/lib/strings";
import { Header } from "@/components/layout/header";
import { Recommendation } from "@/components/home/recommendation";
import { MonthCalendar } from "@/components/home/month-calendar";
import { ChipFilter } from "@/components/events/chip-filter";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { TossProfileFlow } from "@/components/ui/toss-profile-flow";

const FILTER_FOOD_TYPES: FoodType[] = ["버거", "도시락", "샌드위치", "간식", "식사"];

export default function EventsPage() {
  return (
    <ToastProvider>
      <EventsContent />
    </ToastProvider>
  );
}

function GoingButton({ eventId, alreadyGoing }: { eventId: string; alreadyGoing: boolean }) {
  const [done, setDone] = useState(alreadyGoing);
  const [showProfile, setShowProfile] = useState(false);
  const toast = useToast();

  const handleGoing = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const profile = getProfile();
    if (!profile?.name) {
      setShowProfile(true);
      return;
    }

    if (supabase) {
      await supabase.from("attendees").insert({ event_id: eventId, nickname: profile.name });
    }
    setDone(true);
    toast("참석 표시됨!");
  }, [eventId, toast]);

  if (done) {
    return (
      <span className="text-[10px] font-extrabold shrink-0" style={{ color: "var(--g5)" }}>
        완료
      </span>
    );
  }

  return (
    <>
      <button
        onClick={handleGoing}
        className="text-[10px] font-extrabold shrink-0 active:opacity-60"
        style={{ color: "var(--point)", background: "none", border: "none", cursor: "pointer" }}
      >
        신청
      </button>
      <TossProfileFlow
        open={showProfile}
        onClose={() => setShowProfile(false)}
        onComplete={() => {
          setShowProfile(false);
          const profile = getProfile();
          if (profile?.name && supabase) {
            supabase.from("attendees").insert({ event_id: eventId, nickname: profile.name });
          }
          setDone(true);
          toast("참석 표시됨!");
        }}
      />
    </>
  );
}

function EventsContent() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useMode();
  // 첫 렌더에 저장된 모드를 복원할 때는 굴리지 않고, 사용자가 탭했을 때만 모션을 켠다
  const [animate, setAnimate] = useState(false);
  const [foodFilter, setFoodFilter] = useState<FoodType | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | null>(null);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [myAttendances, setMyAttendances] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      let evts: Event[] = MOCK_EVENTS;
      if (supabase) {
        const { data } = await supabase
          .from("events")
          .select("*")
          .gte("start_at", new Date(Date.now() - 7 * 86400000).toISOString())
          .order("start_at", { ascending: true });
        if (data?.length) evts = data;
      }
      setEvents(evts);
      setLoading(false);

      // Check which events I already attend
      const profile = getProfile();
      if (profile?.name && supabase) {
        const { data: att } = await supabase
          .from("attendees")
          .select("event_id")
          .eq("nickname", profile.name);
        if (att) setMyAttendances(new Set(att.map((a) => a.event_id)));
      }
    }
    fetchData();
  }, []);

  function toggleMode() {
    setAnimate(true);
    setFoodFilter(null);
    setCategoryFilter(null);
    setMode(mode === "food" ? "all" : "food");
  }

  const filtered = eventsForMode(events, mode).filter((e) =>
    mode === "food"
      ? !foodFilter || e.food_type === foodFilter
      : !categoryFilter || (e.category ?? "기타") === categoryFilter,
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = filtered.filter((e) => e.start_at.slice(0, 10) >= todayStr);

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
    if (diff === 1) return "내일";
    return `${d.getMonth() + 1}/${d.getDate()} ${dayName}`;
  }

  return (
    <div
      className={`max-w-[480px] mx-auto min-h-screen${mode === "all" ? " mode-all" : ""}${animate ? " mode-animate" : ""}`}
    >
      <Header mode={{ value: mode, onToggle: toggleMode }}>
        <Link href="/my-events" className="text-[13px]" style={{ color: "var(--g5)" }}>
          나의 행사
        </Link>
        <Link href="/profile" className="text-[13px]" style={{ color: "var(--g5)" }}>
          프로필
        </Link>
        <Link href="/submit" className="text-[13px]" style={{ color: "var(--g5)" }}>
          + 제보
        </Link>
      </Header>

      <div key={mode} className="mode-fade">
        {!loading && <Recommendation events={filtered} mode={mode} />}

        <div style={{ height: 6, background: "var(--g9)" }} />

        <MonthCalendar events={filtered} onSelectDate={setSheetDate} />

        <div style={{ height: 6, background: "var(--g9)" }} />

        <div className="px-5 pb-3 pt-4">
          {mode === "food" ? (
            <ChipFilter options={FILTER_FOOD_TYPES} icons={FOOD_ICONS} selected={foodFilter} onSelect={setFoodFilter} />
          ) : (
            <ChipFilter options={EVENT_CATEGORIES} icons={CATEGORY_ICONS} selected={categoryFilter} onSelect={setCategoryFilter} />
          )}
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
                <div
                  key={event.id}
                  className="flex items-baseline gap-2.5 py-2.5"
                  style={{ borderTop: "1px solid var(--g9)" }}
                >
                  <Link
                    href={`/events/${event.id}`}
                    className="flex items-baseline gap-2.5 flex-1 min-w-0 active:opacity-60"
                  >
                    <span
                      className="text-[12px] font-semibold w-[38px] text-right shrink-0"
                      style={{ color: "var(--g5)", fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatTime(event.start_at)}
                    </span>
                    <span className="emoji text-[16px] shrink-0">{eventIcon(event)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold" style={{ letterSpacing: "-0.01em" }}>
                        {mode === "food" ? shortFoodName(event.food_note, event.food_type) : event.title}
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: "var(--g5)" }}>
                        {mode === "food" ? (
                          `${event.title} · ${event.location || ""}`
                        ) : (
                          <EventMeta event={event} />
                        )}
                      </div>
                    </div>
                  </Link>
                  <GoingButton eventId={event.id} alreadyGoing={myAttendances.has(event.id)} />
                </div>
              ))}
            </div>
          ))}
          {upcoming.length === 0 && (
            <div className="text-center py-20 text-[14px]" style={{ color: "var(--g5)" }}>
              {S.EVENTS_EMPTY}
            </div>
          )}
        </div>
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
              <span className="emoji text-[24px]">{eventIcon(event)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold">
                  {mode === "food" ? shortFoodName(event.food_note, event.food_type) : event.title}
                </div>
                <div className="text-[12px]" style={{ color: "var(--g5)" }}>
                  {formatTime(event.start_at)} · {mode === "food" ? event.location || "" : <EventMeta event={event} />}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

/** 행사모음 행의 보조 줄: 장소, 음식이 나오면 🍚 음식 이름 */
function EventMeta({ event }: { event: Event }) {
  return (
    <>
      {event.location || ""}
      {isFood(event) && (
        <>
          {event.location ? " · " : ""}
          <span className="emoji">🍚</span> {shortFoodName(event.food_note, event.food_type)}
        </>
      )}
    </>
  );
}

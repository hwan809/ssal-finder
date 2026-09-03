import Link from "next/link";
import type { Event } from "@/lib/types";
import { FOOD_ICONS } from "@/lib/colors";
import { formatTime } from "@/lib/calendar-utils";
import { S } from "@/lib/strings";

interface RecommendationProps {
  events: Event[];
}

interface RecommendationResult {
  label: string;
  /** Substring of `label` to render in --point color (food name or date). Empty = no emphasis. */
  emphasis: string;
  items: Event[];
}

function getRecommendation(events: Event[]): RecommendationResult {
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = nowIso.slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const shortFoodName = (e: Event) => {
    const note = e.food_note;
    if (note && note.length <= 8) return note;
    return e.food_type;
  };

  const futureOnly = (e: Event) => e.start_at >= nowIso;

  const todayEvents = events.filter((e) => e.start_at.slice(0, 10) === todayStr && futureOnly(e));
  if (todayEvents.length > 0) {
    const food = shortFoodName(todayEvents[0]);
    return { label: S.REC_TODAY_MEAL(food), emphasis: food, items: todayEvents };
  }

  const tomorrowEvents = events.filter((e) => e.start_at.slice(0, 10) === tomorrowStr);
  if (tomorrowEvents.length > 0) {
    const food = shortFoodName(tomorrowEvents[0]);
    return { label: S.REC_TOMORROW_MEAL(food), emphasis: food, items: tomorrowEvents };
  }

  const weekEvents = events.filter(
    (e) => e.start_at.slice(0, 10) > todayStr && e.start_at.slice(0, 10) <= weekEnd,
  );
  if (weekEvents.length > 0) {
    const d = new Date(weekEvents[0].start_at);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${S.DAYS[d.getDay()]}요일`;
    return { label: S.REC_NEXT_EVENT(dateStr), emphasis: dateStr, items: weekEvents.slice(0, 2) };
  }

  return { label: S.REC_EMPTY_WEEK, emphasis: "", items: [] };
}

/** Renders `label` (which may contain literal "\n" line breaks) highlighting the
 * `emphasis` substring in --point color, leaving the rest as plain text. */
function renderLabel(label: string, emphasis: string) {
  if (!emphasis) return label;
  const idx = label.indexOf(emphasis);
  if (idx === -1) return label;
  return (
    <>
      {label.slice(0, idx)}
      <em className="not-italic" style={{ color: "var(--point)" }}>
        {emphasis}
      </em>
      {label.slice(idx + emphasis.length)}
    </>
  );
}

export function Recommendation({ events }: RecommendationProps) {
  const { label, emphasis, items } = getRecommendation(events);

  return (
    <div className="px-5 pt-5 pb-6">
      <div
        className="text-[22px] font-extrabold leading-[1.35] whitespace-pre-line"
        style={{ letterSpacing: "-0.03em" }}
      >
        {renderLabel(label, emphasis)}
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

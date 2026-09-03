import Link from "next/link";
import type { Event } from "@/lib/types";
import { FOOD_COLORS } from "@/lib/colors";
import { formatDate } from "@/lib/calendar-utils";
import { S } from "@/lib/strings";

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const c = FOOD_COLORS[event.food_type];

  return (
    <Link
      href={`/events/${event.id}`}
      className={`block bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 hover:shadow-lg hover:border-transparent transition-all border-l-4 ${c.stripe}`}
    >
      <div className="flex gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${c.bg}`}>
          <span className="emoji">{c.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-snug mb-1">{event.title}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="opacity-50">🕐</span>
              {formatDate(event.start_at)}
              {event.end_at && ` – ${formatDate(event.end_at).split(") ")[1]}`}
            </div>
            {event.location && (
              <div className="flex items-center gap-1.5">
                <span className="opacity-50">📍</span>
                {event.location}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
              {event.food_note || event.food_type}
            </span>
            {event.target_audience && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500">
                {event.target_audience}
              </span>
            )}
            {event.register_url && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                {S.TAG_REGISTER}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

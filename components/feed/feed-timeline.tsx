import type { UpdateLog, FoodType } from "@/lib/types";
import { FOOD_ICONS } from "@/lib/colors";
import { timeAgo } from "@/lib/calendar-utils";
import { S } from "@/lib/strings";

interface FeedTimelineProps {
  logs: UpdateLog[];
}

const ACTION_LABEL = {
  added: S.FEED_ACTION_ADDED,
  updated: S.FEED_ACTION_UPDATED,
  removed: S.FEED_ACTION_REMOVED,
} as const;

export function FeedTimeline({ logs }: FeedTimelineProps) {
  return (
    <div className="divide-y divide-stone-200 dark:divide-stone-800">
      {logs.map((log) => {
        const foodType = log.event?.food_type as FoodType | undefined;
        const icon = foodType ? FOOD_ICONS[foodType] : null;
        return (
          <div key={log.id} className="flex gap-3 py-3 text-sm">
            <span className="text-stone-400 dark:text-stone-600 tabular-nums text-xs w-14 shrink-0 pt-0.5">
              {timeAgo(log.created_at)}
            </span>
            <div className="text-stone-500 dark:text-stone-400">
              {icon && (
                <span className="mr-1">
                  <span className="emoji">{icon}</span> {foodType}
                </span>
              )}
              <strong className="text-stone-900 dark:text-stone-100 font-semibold">
                {log.event?.title || S.FEED_UNKNOWN_EVENT}
              </strong>{" "}
              {ACTION_LABEL[log.action]}
              {log.action === "added" && (
                <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
                  {S.FEED_BADGE_NEW}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

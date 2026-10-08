import type { UpdateLog } from "@/lib/types";
import { eventIcon, isFood } from "@/lib/event-display";
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
    <div>
      {logs.map((log) => {
        const icon = log.event ? eventIcon(log.event) : null;
        const label = log.event && (isFood(log.event) ? log.event.food_type : log.event.category);
        return (
          <div
            key={log.id}
            className="flex gap-3 py-3 text-[14px]"
            style={{ borderTop: "1px solid var(--g9)" }}
          >
            <span
              className="tabular-nums text-[12px] w-14 shrink-0 pt-0.5"
              style={{ color: "var(--g5)", fontVariantNumeric: "tabular-nums" }}
            >
              {timeAgo(log.created_at)}
            </span>
            <div style={{ color: "var(--g5)" }}>
              {icon && (
                <span className="mr-1">
                  <span className="emoji">{icon}</span> {label}
                </span>
              )}
              <strong className="font-semibold" style={{ color: "var(--fg)" }}>
                {log.event?.title || S.FEED_UNKNOWN_EVENT}
              </strong>{" "}
              {ACTION_LABEL[log.action]}
              {log.action === "added" && (
                <span
                  className="ml-1 text-[10px] font-extrabold"
                  style={{ color: "var(--point)" }}
                >
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

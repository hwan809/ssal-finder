import type { Event } from "./types";
import { S } from "./strings";

export function googleCalendarUrl(event: Event): string {
  const fmt = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const start = fmt(event.start_at);
  const end = event.end_at
    ? fmt(event.end_at)
    : fmt(new Date(new Date(event.start_at).getTime() + 3600000).toISOString());
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${S.CALENDAR_PREFIX} ${event.title}`,
    dates: `${start}/${end}`,
    location: event.location || "",
    details: `${event.food_note || event.food_type}\n${event.description || ""}`.trim(),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return S.DATE_FORMAT(d.getFullYear(), d.getMonth() + 1, d.getDate(), S.DAYS[d.getDay()], hh, mm);
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return S.DATE_FORMAT_LONG(d.getFullYear(), d.getMonth() + 1, d.getDate(), S.DAYS[d.getDay()], hh, mm);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return S.TIME_JUST_NOW;
  if (mins < 60) return S.TIME_MINS_AGO(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return S.TIME_HOURS_AGO(hours);
  const days = Math.floor(hours / 24);
  return S.TIME_DAYS_AGO(days);
}

export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export function getTimeSlot(iso: string): "morning" | "lunch" | "dinner" {
  const h = new Date(iso).getHours();
  if (h < 12) return "morning";
  if (h < 17) return "lunch";
  return "dinner";
}

const FOOD_KEYWORDS: [RegExp, string][] = [
  [/쉐이크쉑|쉑쉑|shake\s*shack/i, "쉐이크쉑"],
  [/배달의민족|배민/i, "배민상품권"],
  [/치킨/i, "치킨"],
  [/피자/i, "피자"],
  [/떡볶이/i, "떡볶이"],
  [/햄버거/i, "햄버거"],
  [/케이터링/i, "케이터링"],
  [/샌드위치/i, "샌드위치"],
  [/도시락/i, "도시락"],
  [/상품권/i, "상품권"],
];

export function shortFoodName(foodNote: string | null, foodType: string): string {
  if (!foodNote) return foodType === "기타" ? "음식" : foodType;
  if (foodNote.length <= 8) return foodNote;
  for (const [re, name] of FOOD_KEYWORDS) {
    if (re.test(foodNote)) return name;
  }
  return foodType === "기타" ? "음식" : foodType;
}

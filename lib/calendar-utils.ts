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

export function shortFoodName(foodNote: string | null, foodType: string): string {
  if (!foodNote) return foodType === "기타" ? "음식" : foodType;
  if (foodNote.length <= 8) return foodNote;
  const first = foodNote.split(/[,،\s]/)[0].trim();
  if (first.length >= 2 && first.length <= 8) return first;
  return foodType === "기타" ? foodNote.slice(0, 6) : foodType;
}

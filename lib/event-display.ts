import type { Event, Mode } from "./types";
import { CATEGORY_ICONS, FOOD_ICONS } from "./colors";
import { shortFoodName } from "./calendar-utils";
import { S } from "./strings";

type IconFields = Pick<Event, "is_food" | "category" | "food_type">;

/** 컬럼 추가 전 행이나 마이그레이션 전 배포에서는 is_food가 없을 수 있다. 그땐 음식 행사로 본다. */
export function isFood(event: Pick<Event, "is_food">): boolean {
  return event.is_food !== false;
}

/** 음식 행사는 음식 아이콘, 아니면 카테고리 아이콘. 기존 행은 category가 null일 수 있다. */
export function eventIcon(event: IconFields): string {
  if (isFood(event)) return FOOD_ICONS[event.food_type ?? "기타"];
  return CATEGORY_ICONS[event.category ?? "기타"];
}

/** 공유 시트 문구와 OG 카드 헤드라인. */
export function shareHeadline(event: Pick<Event, "is_food" | "food_note" | "food_type" | "title">): string {
  if (isFood(event)) return S.SHARE_HEADLINE(shortFoodName(event.food_note, event.food_type));
  return S.SHARE_HEADLINE_EVENT(event.title);
}

export function eventsForMode<T extends Pick<Event, "is_food">>(events: T[], mode: Mode): T[] {
  return mode === "food" ? events.filter(isFood) : events;
}

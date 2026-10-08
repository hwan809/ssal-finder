import type { EventCategory, FoodType } from "./types";

export const FOOD_ICONS: Record<FoodType, string> = {
  버거: "🍔",
  도시락: "🍱",
  샌드위치: "🥪",
  간식: "🍪",
  식사: "🍽️",
  기타: "🍴",
};

export const CATEGORY_ICONS: Record<EventCategory, string> = {
  세미나: "🎤",
  설명회: "📢",
  대회: "🏆",
  문화: "🎭",
  기타: "📌",
};

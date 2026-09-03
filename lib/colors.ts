import type { FoodType } from "./types";

export const FOOD_COLORS: Record<
  FoodType,
  { icon: string; bg: string; text: string; dot: string; stripe: string }
> = {
  버거: {
    icon: "🍔",
    bg: "bg-orange-50 dark:bg-orange-950",
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
    stripe: "border-l-orange-500",
  },
  도시락: {
    icon: "🍱",
    bg: "bg-green-50 dark:bg-green-950",
    text: "text-green-700 dark:text-green-300",
    dot: "bg-green-500",
    stripe: "border-l-green-500",
  },
  샌드위치: {
    icon: "🥪",
    bg: "bg-blue-50 dark:bg-blue-950",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    stripe: "border-l-blue-500",
  },
  간식: {
    icon: "🍪",
    bg: "bg-amber-50 dark:bg-amber-950",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    stripe: "border-l-amber-500",
  },
  식사: {
    icon: "🍽️",
    bg: "bg-purple-50 dark:bg-purple-950",
    text: "text-purple-700 dark:text-purple-300",
    dot: "bg-purple-500",
    stripe: "border-l-purple-500",
  },
  기타: {
    icon: "🍴",
    bg: "bg-stone-100 dark:bg-stone-900",
    text: "text-stone-600 dark:text-stone-400",
    dot: "bg-stone-400",
    stripe: "border-l-stone-400",
  },
};

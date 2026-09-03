"use client";

import type { FoodType } from "@/lib/types";
import { FOOD_COLORS } from "@/lib/colors";

interface FoodFilterProps {
  selected: FoodType | null;
  onSelect: (type: FoodType | null) => void;
}

const ACTIVE_STYLES: Record<FoodType, string> = {
  버거: "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-transparent",
  도시락: "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-transparent",
  샌드위치: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-transparent",
  간식: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-transparent",
  식사: "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-transparent",
  기타: "bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-transparent",
};

const TYPES: FoodType[] = ["버거", "도시락", "샌드위치", "간식", "식사"];

export function FoodFilter({ selected, onSelect }: FoodFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
          selected === null
            ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-transparent"
            : "border-stone-200 dark:border-stone-700 text-stone-500 hover:border-stone-400"
        }`}
      >
        전체
      </button>
      {TYPES.map((type) => (
        <button
          key={type}
          onClick={() => onSelect(selected === type ? null : type)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            selected === type
              ? ACTIVE_STYLES[type]
              : "border-stone-200 dark:border-stone-700 text-stone-500 hover:border-stone-400"
          }`}
        >
          {FOOD_COLORS[type].icon} {type}
        </button>
      ))}
    </div>
  );
}

"use client";

import type { FoodType } from "@/lib/types";
import { FOOD_ICONS } from "@/lib/colors";

interface FoodFilterProps {
  selected: FoodType | null;
  onSelect: (type: FoodType | null) => void;
}

const TYPES: FoodType[] = ["버거", "도시락", "샌드위치", "간식", "식사"];

export function FoodFilter({ selected, onSelect }: FoodFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onSelect(null)}
        className="px-3 py-1 text-[12px] font-semibold transition-colors"
        style={{
          border: `1.5px solid ${selected === null ? "var(--fg)" : "var(--g7)"}`,
          color: selected === null ? "var(--bg)" : "var(--g5)",
          background: selected === null ? "var(--fg)" : "transparent",
        }}
      >
        전체
      </button>
      {TYPES.map((type) => (
        <button
          key={type}
          onClick={() => onSelect(selected === type ? null : type)}
          className="px-3 py-1 text-[12px] font-semibold transition-colors"
          style={{
            border: `1.5px solid ${selected === type ? "var(--fg)" : "var(--g7)"}`,
            color: selected === type ? "var(--fg)" : "var(--g5)",
          }}
        >
          <span className="emoji">{FOOD_ICONS[type]}</span> {type}
        </button>
      ))}
    </div>
  );
}

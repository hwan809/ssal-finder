import Link from "next/link";
import { S } from "@/lib/strings";
import { FOOD_COLORS } from "@/lib/colors";
import type { FoodType } from "@/lib/types";

const LANDING_PILLS: { type: FoodType; cls: string }[] = [
  { type: "버거", cls: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  { type: "도시락", cls: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
  { type: "샌드위치", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { type: "간식", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { type: "식사", cls: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-4xl shadow-lg shadow-orange-500/20 mb-6">
          <span className="emoji">🍚</span>
        </div>
        <h1
          className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4"
          style={{ letterSpacing: "-0.03em" }}
        >
          {S.LANDING_TITLE}
        </h1>
        <p className="text-lg text-stone-500 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
          {S.LANDING_SUBTITLE_1}
        </p>
      </div>

      <Link
        href="/events"
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-base hover:opacity-90 transition-opacity shadow-lg"
      >
        {S.LANDING_CTA}
      </Link>

      <div className="mt-16 flex flex-wrap justify-center gap-3">
        {LANDING_PILLS.map(({ type, cls }) => (
          <span
            key={type}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold ${cls}`}
          >
            <span className="emoji">{FOOD_COLORS[type].icon}</span> {S.FOOD_TYPES[type]}
          </span>
        ))}
      </div>

      <p className="mt-12 text-xs text-stone-400 dark:text-stone-600">
        {S.LANDING_FOOTER}
      </p>
    </div>
  );
}

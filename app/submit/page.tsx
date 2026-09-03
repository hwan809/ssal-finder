"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { FOOD_COLORS } from "@/lib/colors";
import { FOOD_TYPES, type FoodType } from "@/lib/types";
import { S } from "@/lib/strings";

export default function SubmitPage() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [foodType, setFoodType] = useState<FoodType>("버거");
  const [foodNote, setFoodNote] = useState("");
  const [registerUrl, setRegisterUrl] = useState("");
  const [target, setTarget] = useState("전체");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "fail">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !time) return;

    setStatus("loading");

    const startAt = new Date(`${date}T${time}:00+09:00`).toISOString();

    if (supabase) {
      const { error } = await supabase.from("submissions").insert({
        title,
        start_at: startAt,
        location: location || null,
        food_type: foodType,
        food_note: foodNote || null,
        target_audience: target || null,
        register_url: registerUrl || null,
      });
      setStatus(error ? "fail" : "done");
    } else {
      // Mock mode
      await new Promise((r) => setTimeout(r, 500));
      setStatus("done");
    }
  };

  if (status === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-4 emoji">🎉</div>
        <h1 className="text-xl font-bold mb-2">{S.SUBMIT_SUCCESS}</h1>
        <Link
          href="/events"
          className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-sm hover:opacity-90 transition-opacity"
        >
          {S.NAV_BACK}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-stone-50/80 dark:bg-stone-950/80 backdrop-blur-lg border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/events" className="text-stone-400 hover:text-stone-600 text-sm">
            {S.NAV_BACK}
          </Link>
          <span className="font-bold text-sm">{S.SUBMIT_TITLE}</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">{S.SUBMIT_DESC}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 행사명 */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">{S.SUBMIT_EVENT_TITLE} *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={S.SUBMIT_EVENT_TITLE_PLACEHOLDER}
              required
              className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* 날짜 + 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">{S.SUBMIT_DATE} *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">{S.SUBMIT_TIME} *</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
          </div>

          {/* 장소 */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">{S.SUBMIT_LOCATION}</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={S.SUBMIT_LOCATION_PLACEHOLDER}
              className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* 식사 종류 */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">{S.SUBMIT_FOOD_TYPE} *</label>
            <div className="flex flex-wrap gap-1.5">
              {FOOD_TYPES.filter((t) => t !== "기타").map((type) => {
                const c = FOOD_COLORS[type];
                const active = foodType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFoodType(type)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      active
                        ? `${c.bg} ${c.text} border-transparent`
                        : "border-stone-200 dark:border-stone-700 text-stone-500 hover:border-stone-400"
                    }`}
                  >
                    <span className="emoji">{c.icon}</span> {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 식사 상세 */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">{S.SUBMIT_FOOD_NOTE}</label>
            <input
              type="text"
              value={foodNote}
              onChange={(e) => setFoodNote(e.target.value)}
              placeholder={S.SUBMIT_FOOD_NOTE_PLACEHOLDER}
              className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* 대상 */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">{S.SUBMIT_TARGET}</label>
            <div className="flex gap-1.5">
              {["전체", "학부생", "대학원생"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTarget(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    target === t
                      ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-transparent"
                      : "border-stone-200 dark:border-stone-700 text-stone-500 hover:border-stone-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 신청 링크 */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">{S.SUBMIT_REGISTER_URL}</label>
            <input
              type="url"
              value={registerUrl}
              onChange={(e) => setRegisterUrl(e.target.value)}
              placeholder={S.SUBMIT_REGISTER_URL_PLACEHOLDER}
              className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* 제출 */}
          <button
            type="submit"
            disabled={status === "loading" || !title || !date || !time}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
              status === "loading"
                ? "bg-orange-400 text-white cursor-wait"
                : status === "fail"
                  ? "bg-red-500 text-white"
                  : "bg-orange-600 text-white hover:opacity-90"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {status === "loading" ? S.SUBMIT_VALIDATING : status === "fail" ? S.SUBMIT_FAIL : S.SUBMIT_CTA}
          </button>
        </form>
      </main>
    </div>
  );
}

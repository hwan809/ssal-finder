"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { FOOD_ICONS } from "@/lib/colors";
import { FOOD_TYPES, type FoodType } from "@/lib/types";
import { S } from "@/lib/strings";
import { Header } from "@/components/layout/header";

const inputStyle: React.CSSProperties = {
  background: "transparent",
  borderBottom: "1.5px solid var(--g7)",
  borderRadius: 0,
};

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
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center max-w-[480px] mx-auto">
        <div className="text-4xl mb-4 emoji">🎉</div>
        <h1 className="text-[16px] font-bold mb-2">{S.SUBMIT_SUCCESS}</h1>
        <Link
          href="/events"
          className="mt-4 text-[13px] font-semibold"
          style={{ color: "var(--g5)" }}
        >
          {S.NAV_BACK}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto min-h-screen">
      <Header back="/events" title={S.SUBMIT_TITLE} />

      <main className="px-5 py-4">
        <p className="text-[13px] mb-6" style={{ color: "var(--g5)" }}>{S.SUBMIT_DESC}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 행사명 */}
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--g5)" }}>{S.SUBMIT_EVENT_TITLE} *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={S.SUBMIT_EVENT_TITLE_PLACEHOLDER}
              required
              className="w-full px-1 py-2 text-[14px] focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* 날짜 + 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--g5)" }}>{S.SUBMIT_DATE} *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-1 py-2 text-[14px] focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--g5)" }}>{S.SUBMIT_TIME} *</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-1 py-2 text-[14px] focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* 장소 */}
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--g5)" }}>{S.SUBMIT_LOCATION}</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={S.SUBMIT_LOCATION_PLACEHOLDER}
              className="w-full px-1 py-2 text-[14px] focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* 식사 종류 */}
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--g5)" }}>{S.SUBMIT_FOOD_TYPE} *</label>
            <div className="flex flex-wrap gap-1.5">
              {FOOD_TYPES.filter((t) => t !== "기타").map((type) => {
                const active = foodType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFoodType(type)}
                    className="px-3 py-1 text-[12px] font-semibold transition-colors"
                    style={{
                      border: `1.5px solid ${active ? "var(--fg)" : "var(--g7)"}`,
                      color: active ? "var(--fg)" : "var(--g5)",
                    }}
                  >
                    <span className="emoji">{FOOD_ICONS[type]}</span> {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 식사 상세 */}
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--g5)" }}>{S.SUBMIT_FOOD_NOTE}</label>
            <input
              type="text"
              value={foodNote}
              onChange={(e) => setFoodNote(e.target.value)}
              placeholder={S.SUBMIT_FOOD_NOTE_PLACEHOLDER}
              className="w-full px-1 py-2 text-[14px] focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* 대상 */}
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--g5)" }}>{S.SUBMIT_TARGET}</label>
            <div className="flex gap-1.5">
              {["전체", "학부생", "대학원생"].map((t) => {
                const active = target === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTarget(t)}
                    className="px-3 py-1 text-[12px] font-semibold transition-colors"
                    style={{
                      border: `1.5px solid ${active ? "var(--fg)" : "var(--g7)"}`,
                      color: active ? "var(--fg)" : "var(--g5)",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 신청 링크 */}
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--g5)" }}>{S.SUBMIT_REGISTER_URL}</label>
            <input
              type="url"
              value={registerUrl}
              onChange={(e) => setRegisterUrl(e.target.value)}
              placeholder={S.SUBMIT_REGISTER_URL_PLACEHOLDER}
              className="w-full px-1 py-2 text-[14px] focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* 제출 */}
          <button
            type="submit"
            disabled={status === "loading" || !title || !date || !time}
            className="w-full py-3 text-[14px] font-bold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--fg)", color: "var(--bg)" }}
          >
            {status === "loading" ? S.SUBMIT_VALIDATING : status === "fail" ? S.SUBMIT_FAIL : S.SUBMIT_CTA}
          </button>
        </form>
      </main>
    </div>
  );
}

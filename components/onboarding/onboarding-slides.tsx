"use client";

import { useState, useRef } from "react";

interface OnboardingSlidesProps {
  onComplete: () => void;
}

const SLIDES = [
  { emoji: "🍚", title: "배고픈 카이스트인을 위한\n공짜밥 알리미", desc: "학교 메일에서 밥 주는 행사만 쏙쏙 골라서 알려드려요." },
  { emoji: "📅", title: "캘린더로 한눈에,\n놓치는 밥 없이", desc: "언제 어디서 뭘 주는지 달력에서 바로 확인. 오늘 점심 뭐 먹을지 고민 끝." },
  { emoji: "⚡", title: "사전신청도\n원클릭으로", desc: "프로필 한 번 등록하면 구글폼 자동 제출. 선착순도 안 밀려요." },
];

export function OnboardingSlides({ onComplete }: OnboardingSlidesProps) {
  const [cur, setCur] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);

  function go(n: number) {
    setCur(n);
    if (sliderRef.current) {
      sliderRef.current.style.transform = `translateX(-${n * 100}%)`;
    }
  }

  function handleNext() {
    if (cur < 2) go(cur + 1);
    else {
      localStorage.setItem("ssal-onboarded", "1");
      onComplete();
    }
  }

  return (
    <div className="h-dvh flex flex-col max-w-[480px] mx-auto overflow-hidden" style={{ background: "var(--bg)" }}>
      <div
        ref={sliderRef}
        className="flex-1 flex transition-transform duration-400 min-h-0"
        style={{ transitionTimingFunction: "cubic-bezier(.4,0,.2,1)" }}
        onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - startX.current;
          if (Math.abs(dx) > 50) {
            if (dx < 0 && cur < 2) go(cur + 1);
            if (dx > 0 && cur > 0) go(cur - 1);
          }
        }}
      >
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className="min-w-full px-7 flex flex-col justify-center transition-opacity duration-350"
            style={{ opacity: i === cur ? 1 : 0 }}
          >
            <div className="emoji text-[56px] mb-5">{s.emoji}</div>
            <div className="text-[22px] font-black leading-[1.35] mb-2.5 whitespace-pre-line" style={{ letterSpacing: "-0.04em" }}>
              {s.title}
            </div>
            <div className="text-[14px] leading-relaxed" style={{ color: "var(--g3)" }}>
              {s.desc}
            </div>
          </div>
        ))}
      </div>

      <div className="px-7 pb-9 flex items-center justify-between">
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="h-1.5 transition-all duration-300"
              style={{
                width: i === cur ? 20 : 6,
                borderRadius: 3,
                background: i === cur ? "var(--fg)" : "var(--g7)",
              }}
            />
          ))}
        </div>
        <button
          onClick={handleNext}
          className="px-7 py-3 text-[14px] font-bold"
          style={{ background: "var(--fg)", color: "var(--bg)" }}
        >
          {cur === 2 ? "시작하기" : "다음"}
        </button>
      </div>
    </div>
  );
}

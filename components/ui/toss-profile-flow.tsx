"use client";

import { useState, useEffect, useRef } from "react";
import { saveProfile, type UserProfile } from "@/lib/auto-register";
import { useToast } from "@/components/ui/toast";

interface TossProfileFlowProps {
  open: boolean;
  onClose: () => void;
  onComplete: (profile: UserProfile) => void;
}

interface Step {
  key: keyof UserProfile;
  question: string;
  type: "text" | "email" | "chips";
  placeholder?: string;
  inputMode?: "numeric" | "email" | "text";
  options?: string[];
}

const STEPS: Step[] = [
  { key: "name", question: "이름이\n어떻게 되세요?", type: "text", placeholder: "홍길동" },
  { key: "student_id", question: "학번을\n알려주세요", type: "text", placeholder: "20250000", inputMode: "numeric" },
  { key: "department", question: "어느 학과\n소속이세요?", type: "chips", options: ["전산학부", "전기전자", "기계공학", "생명과학", "물리학", "수리과학", "화학", "기타"] },
  { key: "email", question: "이메일 주소를\n입력해주세요", type: "email", placeholder: "hong@kaist.ac.kr" },
];

const LABELS: Record<string, string> = {
  name: "이름", student_id: "학번", department: "학과", email: "이메일",
};

export function TossProfileFlow({ open, onClose, onComplete }: TossProfileFlowProps) {
  const [step, setStep] = useState(0);
  const [curValue, setCurValue] = useState("");
  const [doneValues, setDoneValues] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setStep(0);
      setCurValue("");
      setDoneValues([]);
    }
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open, step]);

  if (!open) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function goNext() {
    if (!curValue) return;
    const newDone = [...doneValues, curValue];
    setDoneValues(newDone);

    if (isLast) {
      const profile: UserProfile = {
        name: newDone[0],
        student_id: newDone[1],
        department: newDone[2],
        email: newDone[3],
        phone: "",
      };
      saveProfile(profile);
      toast("프로필이 기기에 저장되었어요");
      onComplete(profile);
      return;
    }

    setStep(step + 1);
    setCurValue("");
  }

  function goBack() {
    if (step === 0) { onClose(); return; }
    const prev = doneValues.slice(0, -1);
    setDoneValues(prev);
    setCurValue(doneValues[doneValues.length - 1]);
    setStep(step - 1);
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col max-w-[480px] mx-auto overflow-hidden" style={{ background: "var(--bg)" }}>
      <div className="px-5 py-4 shrink-0">
        <button onClick={goBack} className="text-[18px]" style={{ color: "var(--fg)" }}>←</button>
      </div>

      <div className="px-6 shrink-0">
        {doneValues.map((val, i) => (
          <div key={i} className="pb-2 opacity-0 animate-[fadeIn_.3s_ease_forwards]">
            <span className="text-[12px] font-semibold" style={{ color: "var(--g5)" }}>
              {LABELS[STEPS[i].key]}
            </span>
            <span className="text-[13px] font-bold ml-2">{val}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 px-6 flex flex-col justify-center min-h-0">
        <div className="text-[22px] font-black mb-6 whitespace-pre-line" style={{ letterSpacing: "-0.04em", lineHeight: 1.35 }}>
          {s.question}
        </div>

        {s.type === "chips" ? (
          <div className="flex flex-wrap gap-2.5">
            {s.options!.map((opt) => (
              <button
                key={opt}
                onClick={() => setCurValue(opt)}
                className="px-5 py-2.5 text-[15px] font-semibold transition-all active:scale-[0.96]"
                style={{
                  border: `1.5px solid ${curValue === opt ? "var(--fg)" : "var(--g7)"}`,
                  color: curValue === opt ? "var(--fg)" : "var(--g5)",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <input
            ref={inputRef}
            type={s.type}
            value={curValue}
            onChange={(e) => setCurValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && curValue && goNext()}
            placeholder={s.placeholder}
            inputMode={s.inputMode}
            autoComplete="off"
            autoCorrect="off"
            className="w-full pb-3 text-[24px] font-bold outline-none"
            style={{
              background: "none",
              borderBottom: `2px solid ${curValue ? "var(--fg)" : "var(--g7)"}`,
              color: "var(--fg)",
              letterSpacing: "-0.02em",
              fontFamily: "inherit",
            }}
          />
        )}
      </div>

      <div className="px-6 pb-9 pt-4 shrink-0">
        <button
          onClick={goNext}
          disabled={!curValue}
          className="w-full py-4 text-[15px] font-bold transition-all"
          style={{
            background: curValue ? "var(--fg)" : "var(--g7)",
            color: curValue ? "var(--bg)" : "var(--g5)",
            cursor: curValue ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          {isLast ? "완료" : "다음"}
        </button>
      </div>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

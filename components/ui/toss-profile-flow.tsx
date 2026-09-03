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
  type: "text" | "email" | "tel" | "chips";
  placeholder?: string;
  inputMode?: "numeric" | "email" | "tel" | "text";
  maxLength?: number;
  options?: string[];
}

const STEPS: Step[] = [
  { key: "name", question: "이름이\n어떻게 되세요?", type: "text", placeholder: "홍길동" },
  { key: "student_id", question: "학번을\n알려주세요", type: "text", placeholder: "20250000", inputMode: "numeric", maxLength: 8 },
  { key: "department", question: "어느 학과\n소속이세요?", type: "chips", options: [
    "전산학부", "전기전자공학부", "기계공학과", "생명과학과",
    "물리학과", "수리과학과", "화학과", "생명화학공학과",
    "신소재공학과", "건설및환경공학과", "산업디자인학과", "산업및시스템공학과",
    "항공우주공학과", "원자력및양자공학과", "바이오및뇌공학과",
    "문술미래전략대학원", "기타",
  ] },
  { key: "email", question: "이메일 주소를\n입력해주세요", type: "email", placeholder: "hong@kaist.ac.kr" },
  { key: "phone", question: "전화번호를\n알려주세요", type: "tel", placeholder: "010-0000-0000", inputMode: "tel" },
];

const LABELS: Record<string, string> = {
  name: "이름", student_id: "학번", department: "학과", email: "이메일", phone: "전화번호",
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
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
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
        phone: newDone[4] || "",
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
    <div
      className="fixed inset-0 z-[80] flex flex-col max-w-[480px] mx-auto"
      style={{ background: "var(--bg)", overflow: "hidden", height: "100dvh" }}
    >
      {/* Back button */}
      <div className="px-5 py-4 shrink-0">
        <button onClick={goBack} className="text-[18px]" style={{ color: "var(--fg)" }}>
          ←
        </button>
      </div>

      {/* Done fields - compact at top */}
      {doneValues.length > 0 && (
        <div className="px-6 pb-2 shrink-0 flex flex-wrap gap-x-4 gap-y-1">
          {doneValues.map((val, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold" style={{ color: "var(--g5)" }}>
                {LABELS[STEPS[i].key]}
              </span>
              <span className="text-[12px] font-bold">{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Question + input - always vertically centered */}
      <div className="flex-1 px-6 flex flex-col justify-center">
        <div
          className="text-[22px] font-black mb-6 whitespace-pre-line"
          style={{ letterSpacing: "-0.04em", lineHeight: 1.35 }}
        >
          {s.question}
        </div>

        {s.type === "chips" ? (
          <div className="flex flex-wrap gap-2.5">
            {s.options!.map((opt) => (
              <button
                key={opt}
                onClick={() => { setCurValue(opt); }}
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
            maxLength={s.maxLength}
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

      {/* Next button */}
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
    </div>
  );
}

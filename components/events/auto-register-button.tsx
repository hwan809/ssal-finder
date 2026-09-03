"use client";

import { useState, useEffect } from "react";
import { getProfile, submitForm, type FormMapping } from "@/lib/auto-register";
import { ProfileForm } from "@/components/profile/profile-form";
import { S } from "@/lib/strings";

interface AutoRegisterButtonProps {
  formId: string | null;
  formMapping: Record<string, string> | null;
  registerUrl: string | null;
}

export function AutoRegisterButton({ formId, formMapping, registerUrl }: AutoRegisterButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "fail" | "no-profile">("idle");
  const [showProfile, setShowProfile] = useState(false);
  const hasAutoRegister = formId && formMapping && Object.keys(formMapping).length > 0;

  const handleAutoRegister = async () => {
    const profile = getProfile();
    if (!profile || !profile.name) {
      setStatus("no-profile");
      setShowProfile(true);
      return;
    }
    if (!formId || !formMapping) return;

    setStatus("loading");
    const ok = await submitForm(formId, formMapping as FormMapping, profile);
    setStatus(ok ? "done" : "fail");
    if (ok) setTimeout(() => setStatus("idle"), 3000);
  };

  const statusStyles = {
    idle: "bg-orange-600 text-white hover:opacity-90",
    loading: "bg-orange-400 text-white cursor-wait",
    done: "bg-green-500 text-white",
    fail: "bg-red-500 text-white",
    "no-profile": "bg-orange-600 text-white",
  };

  const statusText = {
    idle: `⚡ ${S.AUTO_REGISTER}`,
    loading: "...",
    done: `✓ ${S.AUTO_REGISTER_DONE}`,
    fail: `✕ ${S.AUTO_REGISTER_FAIL}`,
    "no-profile": `⚡ ${S.AUTO_REGISTER}`,
  };

  return (
    <div className="space-y-2">
      {hasAutoRegister ? (
        <button
          onClick={handleAutoRegister}
          disabled={status === "loading"}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${statusStyles[status]}`}
        >
          {statusText[status]}
        </button>
      ) : registerUrl ? (
        <a
          href={registerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-600 text-white font-bold text-sm hover:opacity-90 transition-opacity"
        >
          {S.DETAIL_REGISTER_CTA}
        </a>
      ) : null}

      {status === "no-profile" && (
        <div className="text-xs text-orange-600 text-center mb-1">{S.AUTO_REGISTER_NO_PROFILE}</div>
      )}

      {(showProfile || status === "no-profile") && (
        <ProfileForm onClose={() => { setShowProfile(false); setStatus("idle"); }} />
      )}

      {hasAutoRegister && !showProfile && status !== "no-profile" && (
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="w-full text-xs text-stone-400 hover:text-stone-600 transition-colors py-1"
        >
          {showProfile ? "닫기" : "프로필 설정"}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { getProfile, submitForm, type FormMapping } from "@/lib/auto-register";
import { S } from "@/lib/strings";

interface AutoRegisterButtonProps {
  formId: string | null;
  formMapping: Record<string, string> | null;
  registerUrl: string | null;
  onNeedProfile: () => void;
}

export interface AutoRegisterButtonHandle {
  retry: () => void;
}

type Status = "idle" | "loading" | "done" | "fail";

export const AutoRegisterButton = forwardRef<AutoRegisterButtonHandle, AutoRegisterButtonProps>(
  function AutoRegisterButton({ formId, formMapping, registerUrl, onNeedProfile }, ref) {
    const [status, setStatus] = useState<Status>("idle");
    const hasAutoRegister = !!(formId && formMapping && Object.keys(formMapping).length > 0);

    const handleAutoRegister = useCallback(async () => {
      const profile = getProfile();
      if (!profile || !profile.name) {
        onNeedProfile();
        return;
      }
      if (!formId || !formMapping) return;

      setStatus("loading");
      const ok = await submitForm(formId, formMapping as FormMapping, profile);
      setStatus(ok ? "done" : "fail");
      if (ok) setTimeout(() => setStatus("idle"), 3000);
    }, [formId, formMapping, onNeedProfile]);

    useImperativeHandle(ref, () => ({ retry: handleAutoRegister }), [handleAutoRegister]);

    if (!hasAutoRegister) {
      return registerUrl ? (
        <a
          href={registerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-[15px] font-bold transition-opacity active:opacity-70"
          style={{ background: "var(--fg)", color: "var(--bg)" }}
        >
          {S.DETAIL_REGISTER_CTA}
        </a>
      ) : null;
    }

    const styles: Record<Status, React.CSSProperties> = {
      idle: { background: "var(--fg)", color: "var(--bg)" },
      loading: { background: "var(--g7)", color: "var(--g5)" },
      done: { background: "var(--fg)", color: "var(--bg)" },
      fail: { background: "var(--bg)", color: "var(--point)", border: "1.5px solid var(--point)" },
    };

    const content: Record<Status, { icon: string; label: string }> = {
      idle: { icon: "⚡", label: S.AUTO_REGISTER },
      loading: { icon: "", label: "..." },
      done: { icon: "✓", label: S.AUTO_REGISTER_DONE },
      fail: { icon: "✕", label: S.AUTO_REGISTER_FAIL },
    };

    return (
      <button
        onClick={handleAutoRegister}
        disabled={status === "loading"}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-[15px] font-bold transition-all"
        style={{ ...styles[status], cursor: status === "loading" ? "wait" : "pointer" }}
      >
        {content[status].icon && <span className="emoji">{content[status].icon}</span>}
        {content[status].label}
      </button>
    );
  },
);

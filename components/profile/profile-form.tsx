"use client";

import { useState, useEffect } from "react";
import { getProfile, saveProfile, clearProfile, type UserProfile } from "@/lib/auto-register";
import { S } from "@/lib/strings";

interface ProfileFormProps {
  onClose?: () => void;
}

export function ProfileForm({ onClose }: ProfileFormProps) {
  const [form, setForm] = useState<UserProfile>({
    name: "",
    student_id: "",
    department: "",
    email: "",
    phone: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = getProfile();
    if (existing) setForm(existing);
  }, []);

  const handleSave = () => {
    saveProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    clearProfile();
    setForm({ name: "", student_id: "", department: "", email: "", phone: "" });
  };

  const fields: { key: keyof UserProfile; label: string; placeholder: string }[] = [
    { key: "name", label: S.PROFILE_NAME, placeholder: "홍길동" },
    { key: "student_id", label: S.PROFILE_STUDENT_ID, placeholder: "20250000" },
    { key: "department", label: S.PROFILE_DEPARTMENT, placeholder: "전산학부" },
    { key: "email", label: S.PROFILE_EMAIL, placeholder: "hong@kaist.ac.kr" },
    { key: "phone", label: S.PROFILE_PHONE, placeholder: "010-0000-0000" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[14px] font-bold">{S.PROFILE_TITLE}</h3>
        {onClose && (
          <button onClick={onClose} className="text-[12px]" style={{ color: "var(--g5)" }}>✕</button>
        )}
      </div>
      <p className="text-[12px] mb-5" style={{ color: "var(--g5)" }}>{S.PROFILE_DESC}</p>

      <div className="space-y-4">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--g5)" }}>
              {label}
            </label>
            <input
              type="text"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full px-1 py-2 text-[14px] focus:outline-none"
              style={{ background: "transparent", borderBottom: "1.5px solid var(--g7)", borderRadius: 0 }}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-5">
        <button
          onClick={handleSave}
          className="flex-1 py-2.5 text-[14px] font-bold transition-opacity"
          style={{ background: "var(--fg)", color: "var(--bg)" }}
        >
          {saved ? S.PROFILE_SAVED : S.PROFILE_SAVE}
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2.5 text-[13px] font-semibold"
          style={{ border: "1.5px solid var(--g7)", color: "var(--g5)" }}
        >
          {S.PROFILE_CLEAR}
        </button>
      </div>

      <p className="text-[11px] mt-4 text-center" style={{ color: "var(--g5)" }}>
        🔒 {S.PRIVACY_NOTICE}
      </p>
    </div>
  );
}

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
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold">{S.PROFILE_TITLE}</h3>
        {onClose && (
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xs">✕</button>
        )}
      </div>
      <p className="text-xs text-stone-400 dark:text-stone-500 mb-4">{S.PROFILE_DESC}</p>

      <div className="space-y-3">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
              {label}
            </label>
            <input
              type="text"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
            saved
              ? "bg-green-500 text-white"
              : "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:opacity-90"
          }`}
        >
          {saved ? S.PROFILE_SAVED : S.PROFILE_SAVE}
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          {S.PROFILE_CLEAR}
        </button>
      </div>

      <p className="text-[10px] text-stone-400 dark:text-stone-600 mt-3 text-center">
        🔒 {S.PRIVACY_NOTICE}
      </p>
    </div>
  );
}

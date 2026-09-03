"use client";

import { useState, useEffect, useCallback } from "react";
import type { Attendee } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { S } from "@/lib/strings";

const LS_KEY = "ssal-attendee-nickname";

interface AttendeeSectionProps {
  eventId: string;
}

export function AttendeeSection({ eventId }: AttendeeSectionProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) setNickname(saved);
  }, []);

  const fetchAttendees = useCallback(async () => {
    if (supabase) {
      const { data } = await supabase
        .from("attendees")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (data) setAttendees(data);
    }
  }, [eventId]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;

    setStatus("loading");
    localStorage.setItem(LS_KEY, trimmed);

    if (supabase) {
      const { error } = await supabase
        .from("attendees")
        .insert({ event_id: eventId, nickname: trimmed });

      if (error) {
        // unique constraint violation means already attending
        setStatus("done");
        setShowInput(false);
        setTimeout(() => setStatus("idle"), 2000);
        return;
      }
    } else {
      // Mock response when supabase is not configured
      setAttendees((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          event_id: eventId,
          nickname: trimmed,
          created_at: new Date().toISOString(),
        },
      ]);
    }

    setStatus("done");
    setShowInput(false);
    await fetchAttendees();
    setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <div className="bg-stone-100 dark:bg-stone-900 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-stone-700 dark:text-stone-300">
          {S.ATTEND_LIST_TITLE}
        </span>
        <span className="text-xs text-stone-400">
          {S.ATTEND_COUNT(attendees.length)}
        </span>
      </div>

      {attendees.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {attendees.map((a) => (
            <span
              key={a.id}
              className="inline-block px-2 py-0.5 bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs rounded-lg"
            >
              {a.nickname}
            </span>
          ))}
        </div>
      )}

      {showInput ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={S.ATTEND_NICKNAME_PLACEHOLDER}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={handleSubmit}
            disabled={status === "loading" || !nickname.trim()}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-orange-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {status === "loading" ? "..." : S.ATTEND_GOING}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
        >
          {status === "done" ? `✓ ${S.ATTEND_GOING_DONE}` : `🙋 ${S.ATTEND_GOING}`}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Attendee } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/auto-register";
import { S } from "@/lib/strings";

interface AttendeeSectionProps {
  eventId: string;
}

export function AttendeeSection({ eventId }: AttendeeSectionProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [alreadyGoing, setAlreadyGoing] = useState(false);

  const fetchAttendees = useCallback(async () => {
    if (supabase) {
      const { data } = await supabase
        .from("attendees")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (data) {
        setAttendees(data);
        const profile = getProfile();
        if (profile?.name && data.some((a) => a.nickname === profile.name)) {
          setAlreadyGoing(true);
        }
      }
    }
  }, [eventId]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  const handleGoing = async () => {
    const profile = getProfile();
    const nickname = profile?.name;
    if (!nickname) {
      alert(S.AUTO_REGISTER_NO_PROFILE);
      return;
    }

    setStatus("loading");

    if (supabase) {
      await supabase
        .from("attendees")
        .insert({ event_id: eventId, nickname });
    } else {
      setAttendees((prev) => [
        ...prev,
        { id: crypto.randomUUID(), event_id: eventId, nickname, created_at: new Date().toISOString() },
      ]);
    }

    setStatus("done");
    setAlreadyGoing(true);
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

      {alreadyGoing ? (
        <div className="text-center text-xs text-stone-400 py-2">
          ✓ {S.ATTEND_GOING_DONE}
        </div>
      ) : (
        <button
          onClick={handleGoing}
          disabled={status === "loading"}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${
            status === "loading"
              ? "bg-stone-300 dark:bg-stone-700 text-stone-500 cursor-wait"
              : "border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800"
          }`}
        >
          🙋 {S.ATTEND_GOING}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import type { Attendee } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/auto-register";
import { S } from "@/lib/strings";

interface AttendeeSectionProps {
  eventId: string;
  onNeedProfile: () => void;
}

export interface AttendeeSectionHandle {
  retry: () => void;
}

export const AttendeeSection = forwardRef<AttendeeSectionHandle, AttendeeSectionProps>(
  function AttendeeSection({ eventId, onNeedProfile }, ref) {
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

    const handleGoing = useCallback(async () => {
      const profile = getProfile();
      const nickname = profile?.name;
      if (!nickname) {
        onNeedProfile();
        return;
      }

      setStatus("loading");

      if (supabase) {
        await supabase.from("attendees").insert({ event_id: eventId, nickname });
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
    }, [eventId, onNeedProfile, fetchAttendees]);

    useImperativeHandle(ref, () => ({ retry: handleGoing }), [handleGoing]);

    return (
      <div className="pt-5 pb-1 mb-6" style={{ borderTop: "1px solid var(--g7)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-bold">{S.ATTEND_LIST_TITLE}</span>
          <span className="text-[12px]" style={{ color: "var(--g5)" }}>
            {S.ATTEND_COUNT(attendees.length)}
          </span>
        </div>

        {attendees.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {attendees.map((a) => (
              <span
                key={a.id}
                className="inline-block px-2.5 py-1 text-[12px]"
                style={{ border: "1px solid var(--g7)", color: "var(--g3)" }}
              >
                {a.nickname}
              </span>
            ))}
          </div>
        )}

        {alreadyGoing ? (
          <div className="text-center text-[12px] py-2" style={{ color: "var(--g5)" }}>
            ✓ {S.ATTEND_GOING_DONE}
          </div>
        ) : (
          <button
            onClick={handleGoing}
            disabled={status === "loading"}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-bold transition-opacity active:opacity-70"
            style={{
              border: "1px solid var(--g7)",
              color: status === "loading" ? "var(--g5)" : "var(--fg)",
              cursor: status === "loading" ? "wait" : "pointer",
            }}
          >
            <span className="emoji">🙋</span> {S.ATTEND_GOING}
          </button>
        )}
      </div>
    );
  },
);

import { cache } from "react";
import type { Event } from "./types";
import { MOCK_EVENTS } from "./mock-data";
import { supabase } from "./supabase";

// generateMetadata, page, opengraph-image가 같은 요청 안에서 한 번만 조회하도록 cache
export const getEvent = cache(async (id: string): Promise<Event | null> => {
  if (supabase) {
    const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (data) return data;
  }
  return MOCK_EVENTS.find((e) => e.id === id) ?? null;
});

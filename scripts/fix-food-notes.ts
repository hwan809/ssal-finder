import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const FOOD_MAP: Record<string, string> = {
  "SHAKE SHACK": "쉐이크쉑",
  "shake shack": "쉐이크쉑",
  "배달의민족": "배민상품권",
  "상품권": "상품권",
  "치킨": "치킨",
  "피자": "피자",
  "샌드위치": "샌드위치",
  "도시락": "도시락",
  "버거": "버거",
  "케이터링": "케이터링",
};

function shorten(title: string, foodType: string, foodNote: string | null): string {
  const combined = `${title} ${foodNote || ""}`.toLowerCase();
  for (const [keyword, short] of Object.entries(FOOD_MAP)) {
    if (combined.includes(keyword.toLowerCase())) return short;
  }
  return foodType;
}

async function main() {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, food_type, food_note")
    .order("start_at", { ascending: false });

  if (error || !events) {
    console.error("Failed:", error);
    return;
  }

  console.log(`Found ${events.length} events`);

  for (const event of events) {
    const old = event.food_note;
    if (old && old.length <= 8) {
      console.log(`  SKIP "${old}"`);
      continue;
    }

    const newNote = shorten(event.title, event.food_type, old);
    console.log(`  "${(old || "").slice(0, 40)}" → "${newNote}"`);

    const { error: err } = await supabase
      .from("events")
      .update({ food_note: newNote })
      .eq("id", event.id);

    if (err) console.error(`    FAIL:`, err);
  }

  console.log("Done!");
}

main();

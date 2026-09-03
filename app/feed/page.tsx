import Link from "next/link";
import { FeedTimeline } from "@/components/feed/feed-timeline";
import { MOCK_LOGS } from "@/lib/mock-data";
import { createServerClient } from "@/lib/supabase-server";
import { S } from "@/lib/strings";

export default async function FeedPage() {
  let logs = MOCK_LOGS;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("update_logs")
      .select("*, event:events(title, food_type)")
      .order("created_at", { ascending: false });
    if (data?.length) logs = data;
  }
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-stone-50/80 dark:bg-stone-950/80 backdrop-blur-lg border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/events" className="text-stone-400 hover:text-stone-600 text-sm">
            {S.NAV_BACK}
          </Link>
          <span className="font-bold text-sm">{S.NAV_FEED}</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        <FeedTimeline logs={logs} />
      </main>
    </div>
  );
}

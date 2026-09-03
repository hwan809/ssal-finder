import { FeedTimeline } from "@/components/feed/feed-timeline";
import { MOCK_LOGS } from "@/lib/mock-data";
import { createServerClient } from "@/lib/supabase-server";
import { S } from "@/lib/strings";
import { Header } from "@/components/layout/header";

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
    <div className="max-w-[480px] mx-auto min-h-screen">
      <Header back="/events" title={S.NAV_FEED} />
      <main className="px-5 py-4">
        <FeedTimeline logs={logs} />
      </main>
    </div>
  );
}

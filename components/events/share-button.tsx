"use client";

import type { Event } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { shareHeadline } from "@/lib/event-display";
import { S } from "@/lib/strings";

// 모바일은 OS 공유 시트(카톡, 인스타 DM 등), 지원 안 하는 브라우저는 링크 복사.
// 미리보기 카드는 opengraph-image.tsx가 링크에 붙인다.
export function ShareButton({ event }: { event: Event }) {
  const toast = useToast();

  async function share() {
    const url = `${location.origin}/events/${event.id}`;
    if (navigator.share) {
      try {
        // 카톡 등은 text를 링크 위 말풍선으로 보낸다. 카드 헤드라인과 맞춘다.
        await navigator.share({ text: shareHeadline(event), url });
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast(S.DETAIL_SHARE_FAIL);
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(S.DETAIL_SHARE_COPIED);
    } catch {
      toast(S.DETAIL_SHARE_FAIL);
    }
  }

  return (
    <button
      onClick={share}
      className="flex items-center justify-center gap-2 px-4 py-3 text-[14px] font-bold transition-opacity active:opacity-70"
      style={{ border: "1px solid var(--g7)", color: "var(--fg)" }}
    >
      <span className="emoji">🔗</span> {S.DETAIL_SHARE}
    </button>
  );
}

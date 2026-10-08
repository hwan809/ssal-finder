import Link from "next/link";
import type { Mode } from "@/lib/types";
import { ModeToggle } from "./mode-toggle";

interface HeaderProps {
  back?: string;
  title?: string;
  /** 주면 로고 자리에 쌀먹찾기/행사모음 전환 버튼이 들어간다 */
  mode?: { value: Mode; onToggle: () => void };
  children?: React.ReactNode;
}

export function Header({ back, title, mode, children }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 max-w-[480px] mx-auto"
      style={{ background: "var(--bg)" }}
    >
      <div className="flex items-center justify-between px-5 py-4">
        {back ? (
          <div className="flex items-center gap-3">
            <Link
              href={back}
              className="text-sm"
              style={{ color: "var(--g5)" }}
            >
              ← 목록
            </Link>
            {title && (
              <span className="text-sm font-bold">{title}</span>
            )}
          </div>
        ) : mode ? (
          <ModeToggle mode={mode.value} onToggle={mode.onToggle} />
        ) : (
          <Link
            href="/events"
            className="text-[16px] font-black"
            style={{ letterSpacing: "-0.04em" }}
          >
            <span className="emoji">🍚</span> 카이스트 쌀먹찾기
          </Link>
        )}
        <div className="flex items-center gap-4">
          {children}
        </div>
      </div>
    </header>
  );
}

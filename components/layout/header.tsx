import Link from "next/link";

interface HeaderProps {
  back?: string;
  title?: string;
  children?: React.ReactNode;
}

export function Header({ back, title, children }: HeaderProps) {
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
        ) : (
          <Link
            href="/events"
            className="text-[16px] font-black"
            style={{ letterSpacing: "-0.04em" }}
          >
            <span className="emoji">🍚</span> 카이스트 쌀먹파인더
          </Link>
        )}
        <div className="flex items-center gap-4">
          {children}
        </div>
      </div>
    </header>
  );
}

import type { Mode } from "@/lib/types";
import { S } from "@/lib/strings";

interface ModeToggleProps {
  mode: Mode;
  onToggle: () => void;
}

// 두 이름을 세로로 쌓아두고 .mode-all이면 한 줄 위로 굴린다 (globals.css)
export function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={S.MODE_TOGGLE_LABEL[mode]}
      className="flex items-center gap-1.5 text-[16px] font-black active:opacity-60"
      style={{ letterSpacing: "-0.04em", background: "none", border: "none", padding: 0, color: "var(--fg)" }}
    >
      <span className="mode-roll">
        <span className="mode-roll-track">
          {(["food", "all"] as const).map((m) => (
            <span key={m} aria-hidden={m !== mode}>
              <span className="emoji">{S.MODE_ICON[m]}</span> {S.MODE_TITLE[m]}
            </span>
          ))}
        </span>
      </span>
      <span className="text-[13px] font-bold" style={{ color: "var(--point)" }}>
        ⇅
      </span>
    </button>
  );
}

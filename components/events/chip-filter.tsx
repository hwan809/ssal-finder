"use client";

interface ChipFilterProps<T extends string> {
  options: readonly T[];
  icons: Record<T, string>;
  selected: T | null;
  onSelect: (value: T | null) => void;
}

export function ChipFilter<T extends string>({ options, icons, selected, onSelect }: ChipFilterProps<T>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onSelect(null)}
        className="px-3 py-1 text-[12px] font-semibold transition-colors"
        style={{
          border: `1.5px solid ${selected === null ? "var(--fg)" : "var(--g7)"}`,
          color: selected === null ? "var(--bg)" : "var(--g5)",
          background: selected === null ? "var(--fg)" : "transparent",
        }}
      >
        전체
      </button>
      {options.map((value) => (
        <button
          key={value}
          onClick={() => onSelect(selected === value ? null : value)}
          className="px-3 py-1 text-[12px] font-semibold transition-colors"
          style={{
            border: `1.5px solid ${selected === value ? "var(--fg)" : "var(--g7)"}`,
            color: selected === value ? "var(--fg)" : "var(--g5)",
          }}
        >
          <span className="emoji">{icons[value]}</span> {value}
        </button>
      ))}
    </div>
  );
}

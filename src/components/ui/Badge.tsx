const TONES = {
  neutral: "bg-hair-soft text-ink-2",
  warn: "bg-warn-soft text-warn-ink",
  accent: "bg-plum-soft text-plum",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold tabular-nums ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

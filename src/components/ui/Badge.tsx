const TONES = {
  neutral: "bg-hair-soft text-ink-2",
  // 일회성: 4:5 아님 경고 배지에만 쓰는 앰버. 액센트(플럼)와 겹치지 않게 따로 둔다
  warn: "bg-[#FDF1E7] text-[#8A4B12]",
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

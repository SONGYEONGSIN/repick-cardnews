import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FlowCard({
  href,
  title,
  description,
  steps,
  outputPath,
  preview,
}: {
  href: string;
  title: string;
  description: string;
  steps: number;
  outputPath: string;
  preview: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      // 호버는 앱 전체와 같은 기준이다 — 선(테두리) 계열은 배경으로 반응한다
      // (docs/ui-standards.md §5). 예전엔 여기만 살짝 떠올랐고(`-translate-y-0.5`) 배경은
      // 안 바뀌어, 같은 위계인데 혼자 다르게 움직였다. 브랜드 색(plum) 테두리는 그대로 둔다 —
      // 첫 화면은 브랜드를 보여 주는 자리다.
      className="group flex flex-col gap-5 rounded-xl border border-hair bg-surface p-6 shadow-sm transition-colors duration-200 hover:border-plum hover:bg-hair-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none"
    >
      <div className="flex h-28 items-center justify-center rounded-lg bg-canvas">{preview}</div>
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-1.5 text-lg font-extrabold tracking-tight">
          {title}
          <ArrowRight
            size={16}
            aria-hidden="true"
            className="text-plum opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none"
          />
        </h2>
        <p className="text-sm leading-relaxed text-ink-2">{description}</p>
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1 border-t border-hair-soft pt-3 text-[11px]">
        <dt className="text-ink-3">단계</dt>
        <dd className="text-right tabular-nums text-ink-2">{steps}스텝</dd>
        <dt className="text-ink-3">저장 위치</dt>
        <dd className="truncate text-right font-mono text-ink-2">{outputPath}</dd>
      </dl>
    </Link>
  );
}

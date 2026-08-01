import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * V1 — 정석. 현행 골격(중앙 880px 한 컬럼)을 유지한 채 결함만 걷어낸다.
 *
 * 고친 것: ① 페이지가 뷰포트를 채우도록 3행 그리드로 바꿔 아래쪽 죽은 공간을 없앤다
 * ② 카드의 `단계/저장 위치` 라벨-값 두 줄(스펙 시트 가구)을 제거하고 단계 수를 점으로 환원
 * ③ `11px uppercase tracking` 소제목을 평범한 13px + 헤어라인 규칙으로 교체
 * ④ 최근 목록이 남는 세로 공간을 차지하게 해 빈 화면이 아니라 '아직 비어 있는 목록'으로 읽히게 한다
 */

function StepDots({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-1 w-1 rounded-full bg-ink-3" />
      ))}
    </span>
  );
}

function FlowTile({
  href,
  title,
  description,
  steps,
  preview,
}: {
  href: string;
  title: string;
  description: string;
  steps: number;
  preview: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-hair bg-surface transition-colors duration-200 hover:border-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none"
    >
      <span className="flex h-[132px] items-center justify-center border-b border-hair-soft bg-hair-soft">
        {preview}
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="flex items-center justify-between">
          <span className="text-[17px] font-semibold tracking-tight">{title}</span>
          <ArrowRight
            size={16}
            aria-hidden="true"
            className="text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </span>
        <span className="text-sm leading-relaxed text-ink-2">{description}</span>
        <span className="mt-1.5 flex items-center gap-2 text-[13px] tabular-nums text-ink-3">
          <StepDots count={steps} />
          {steps}단계
        </span>
      </span>
    </Link>
  );
}

const CARDNEWS_PREVIEW = (
  <svg width="112" height="72" viewBox="0 0 112 72" fill="none" aria-hidden="true">
    <rect x="8" y="10" width="38" height="52" rx="4" className="fill-hair" />
    <rect x="26" y="6" width="40" height="60" rx="4" className="fill-plum-soft stroke-plum" strokeWidth="1.5" />
    <rect x="33" y="42" width="26" height="3.5" rx="1.75" className="fill-plum" />
    <rect x="33" y="49" width="17" height="3.5" rx="1.75" className="fill-plum" opacity=".5" />
    <rect x="66" y="10" width="38" height="52" rx="4" className="fill-hair" />
  </svg>
);

const INFO_PREVIEW = (
  <svg width="112" height="72" viewBox="0 0 112 72" fill="none" aria-hidden="true">
    <rect x="34" y="6" width="44" height="60" rx="4" className="fill-plum-soft stroke-plum" strokeWidth="1.5" />
    <rect x="41" y="14" width="30" height="14" rx="2" className="fill-plum" opacity=".25" />
    <circle cx="44" cy="38" r="2.5" className="fill-plum" />
    <rect x="50" y="36.5" width="21" height="3" rx="1.5" className="fill-plum" opacity=".55" />
    <circle cx="44" cy="48" r="2.5" className="fill-plum" />
    <rect x="50" y="46.5" width="21" height="3" rx="1.5" className="fill-plum" opacity=".55" />
    <circle cx="44" cy="58" r="2.5" className="fill-plum" />
    <rect x="50" y="56.5" width="14" height="3" rx="1.5" className="fill-plum" opacity=".55" />
  </svg>
);

export function HubV1() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-52px)] w-full max-w-[880px] grid-rows-[auto_auto_1fr] gap-9 px-6 py-12">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-tight">무엇을 만들까요?</h1>
        <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
          직접 작업한 사진 폴더를 올리면 순서를 정하고 카피를 붙여 인스타 카드로 뽑아 드려요.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <FlowTile
          href="/cardnews"
          title="카드뉴스"
          description="사진 5~6장으로 넘겨 보는 설득 시퀀스를 만들어요."
          steps={5}
          preview={CARDNEWS_PREVIEW}
        />
        <FlowTile
          href="/info"
          title="정보전달"
          description="사진 1장에 정보를 얹은 인포그래픽 한 장을 만들어요."
          steps={4}
          preview={INFO_PREVIEW}
        />
      </div>

      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex items-baseline justify-between border-b border-hair pb-2">
          <h2 className="text-[13px] font-semibold">최근 만든 것</h2>
          <span className="text-[13px] tabular-nums text-ink-3">0개</span>
        </div>
        <p className="text-sm text-ink-2">아직 만든 게 없어요. 위에서 하나 골라 시작해 보세요.</p>
      </section>
    </div>
  );
}

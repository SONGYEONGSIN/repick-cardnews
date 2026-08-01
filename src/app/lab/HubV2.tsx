import Link from "next/link";
import { Plus, Search } from "lucide-react";

/**
 * V2 — 정제. 위계를 뒤집는다.
 *
 * 전제: 이건 랜딩이 아니라 매일 쓰는 도구다. 도구를 여는 사람은 "무엇을 만들까"보다
 * "지난번 그거"를 더 자주 찾는다. 그래서 히어로 문구를 통째로 없애고, 만들기는 상단
 * 액션으로 축소하고, 화면 전체를 작업물 서랍으로 쓴다.
 *
 * 빈 상태가 각주 한 줄이 아니라 화면의 주인공이 된다 — 처음 온 사람에게는 그게 곧
 * 온보딩이고, 두 번째부터는 이 자리가 실제 작업물로 채워진다.
 */

function CreateAction({
  href,
  title,
  meta,
}: {
  href: string;
  title: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-11 items-center gap-2.5 rounded-lg border border-hair bg-surface pl-3 pr-3.5 transition-colors duration-200 hover:border-plum hover:bg-plum-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none"
    >
      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-hair-soft text-ink-2 transition-colors duration-200 group-hover:bg-plum group-hover:text-white motion-reduce:transition-none">
        <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-[13px] tabular-nums text-ink-3">{meta}</span>
    </Link>
  );
}

/** 빈 서랍. 실제 작업물이 들어올 자리를 형태로 미리 보여 준다. */
function EmptyShelf() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-hair py-16">
      <div className="flex items-end gap-3" aria-hidden="true">
        <div className="h-[88px] w-[72px] rounded-lg border border-hair bg-surface" />
        <div className="h-[104px] w-[72px] rounded-lg border border-hair bg-surface" />
        <div className="h-[88px] w-[72px] rounded-lg border border-hair bg-surface" />
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-[15px] font-semibold">아직 만든 게 없어요</p>
        <p className="max-w-[42ch] text-sm leading-relaxed text-ink-2">
          사진 폴더를 올리면 순서를 정하고 카피를 붙여 인스타 카드로 뽑아 드려요.
          위에서 만들 종류를 하나 골라 시작해 보세요.
        </p>
      </div>
    </div>
  );
}

export function HubV2() {
  return (
    <div className="flex min-h-[calc(100vh-52px)] flex-col bg-canvas">
      <div className="sticky top-[52px] z-10 flex h-16 flex-none items-center gap-3 border-b border-hair bg-surface px-6">
        <h1 className="mr-1 text-[15px] font-extrabold tracking-tight">작업물</h1>
        <span className="text-[13px] tabular-nums text-ink-3">0개</span>

        <div className="ml-auto flex items-center gap-2">
          <span className="flex h-11 items-center gap-2 rounded-lg border border-hair bg-surface px-3 text-ink-3">
            <Search size={15} aria-hidden="true" />
            <span className="text-sm">검색</span>
          </span>
          <CreateAction href="/cardnews" title="카드뉴스" meta="5단계" />
          <CreateAction href="/info" title="정보전달" meta="4단계" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
        <EmptyShelf />
      </div>
    </div>
  );
}

import { ContiMark } from "@/components/ui";
import { readRecent } from "@/lib/ledger";
import { FlowCard } from "@/features/hub/FlowCard";
import { RecentList } from "@/features/hub/RecentList";

const CARDNEWS_PREVIEW = (
  <svg width="120" height="76" viewBox="0 0 120 76" fill="none" aria-hidden="true">
    <rect x="4" y="12" width="36" height="52" rx="4" className="fill-hair" />
    <rect x="26" y="8" width="36" height="60" rx="4" className="fill-hair" />
    <rect x="50" y="4" width="40" height="68" rx="4" className="fill-plum/20" />
    <rect x="56" y="10" width="28" height="34" rx="2" className="fill-plum" />
    <rect x="56" y="50" width="28" height="4" rx="2" className="fill-plum/50" />
    <rect x="56" y="58" width="18" height="4" rx="2" className="fill-plum/30" />
  </svg>
);

const INFO_PREVIEW = (
  <svg width="120" height="76" viewBox="0 0 120 76" fill="none" aria-hidden="true">
    <rect x="38" y="4" width="44" height="68" rx="4" className="fill-plum/20" />
    <rect x="44" y="10" width="32" height="20" rx="2" className="fill-plum" />
    <circle cx="48" cy="40" r="3.5" className="fill-plum/60" />
    <rect x="55" y="38" width="21" height="4" rx="2" className="fill-plum/40" />
    <circle cx="48" cy="52" r="3.5" className="fill-plum/60" />
    <rect x="55" y="50" width="21" height="4" rx="2" className="fill-plum/40" />
    <circle cx="48" cy="64" r="3.5" className="fill-plum/60" />
    <rect x="55" y="62" width="14" height="4" rx="2" className="fill-plum/40" />
  </svg>
);

export default async function HubPage() {
  const recent = await readRecent(5);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[880px] flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-plum">
          <ContiMark size={22} />
          <span className="text-sm font-extrabold tracking-tight text-ink">콘티</span>
        </div>
        <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">무엇을 만들까요?</h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          직접 작업한 사진 폴더를 올리면 순서를 정하고 카피를 붙여 인스타 카드로 뽑아 드려요.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <FlowCard
          href="/cardnews"
          title="카드뉴스"
          description="사진 5~6장으로 넘겨 보는 설득 시퀀스를 만들어요."
          steps={5}
          outputPath="cardnews/"
          preview={CARDNEWS_PREVIEW}
        />
        <FlowCard
          href="/info"
          title="정보전달"
          description="사진 1장에 정보를 얹은 인포그래픽 한 장을 만들어요."
          steps={4}
          outputPath="informationsend/"
          preview={INFO_PREVIEW}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">최근 만든 것</h2>
        <RecentList rows={recent} />
      </section>
    </main>
  );
}

import Link from "next/link";
import { Command, FolderOpen, Home, Images, LayoutTemplate, Settings, Sparkles } from "lucide-react";
import { ContiMark, FOCUS_RING } from "@/components/ui";

/**
 * repick-design 의 앱 셸 문법을 콘티에 맞게 옮긴 것.
 *
 * 참고: `vault/20-generations` 의 dash r11·r12 캡처 4종(Palisade·Amberline·Nudge·Cadence).
 * 넷이 공유하는 골격은 — 좌측 레일(브랜드 락업 → 컨텍스트 카드 → 섹션 라벨 + nav → 하단 정보),
 * 상단바(넓은 검색 + 우측 컬러 primary 액션)다.
 *
 * 그대로 베끼지 않은 것: 워크스페이스 스위처·알림 벨·아바타 메뉴는 다중 사용자 SaaS 의 가구다.
 * 콘티는 로컬 단일 사용자 도구라 그 자리를 저장 폴더 카드와 검색으로 바꿨다.
 *
 * 지금 허브의 가장 큰 결함(중앙 880px 한 컬럼 + 아래쪽 죽은 공간)은 이 셸을 씌우는 것만으로
 * 구조적으로 사라진다 — 그리고 위저드 화면과 셸이 같아져 전환 시 화면이 갈아엎어지지 않는다.
 */

function NavItem({
  icon,
  label,
  href,
  active = false,
  soon = false,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  soon?: boolean;
}) {
  const className = `flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
    active
      ? "bg-plum-soft font-semibold text-plum"
      : soon
        ? "cursor-not-allowed text-ink-disabled"
        : "text-ink-2 hover:bg-hair-soft hover:text-ink"
  }`;

  const body = (
    <>
      <span className="flex-none">{icon}</span>
      {label}
      {soon && (
        <span className="ml-auto rounded bg-hair-soft px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">
          예정
        </span>
      )}
    </>
  );

  if (soon || !href) {
    return (
      <span aria-disabled="true" className={className}>
        {body}
      </span>
    );
  }
  return (
    <Link href={href} className={className} aria-current={active ? "page" : undefined}>
      {body}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2.5 pb-1 pt-4 text-[11px] font-semibold text-ink-2">{children}</p>;
}

export function Shell({
  action,
  children,
}: {
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-92px)] bg-canvas">
      <aside className="flex w-[232px] flex-none flex-col border-r border-hair bg-surface px-3 py-4">
        <div className="flex items-center gap-2 px-2.5 pb-3">
          <span className="text-plum">
            <ContiMark size={20} />
          </span>
          <span className="text-sm font-extrabold tracking-tight">콘티</span>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-hair px-2.5 py-2">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded bg-plum-soft text-plum">
            <FolderOpen size={13} aria-hidden="true" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold">repick-cardnews</span>
            <span className="block truncate text-[11px] text-ink-2">로컬 저장 폴더</span>
          </span>
        </div>

        <SectionLabel>만들기</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          <NavItem icon={<Images size={15} aria-hidden="true" />} label="카드뉴스" href="/cardnews" />
          <NavItem icon={<LayoutTemplate size={15} aria-hidden="true" />} label="정보전달" href="/info" />
        </nav>

        <SectionLabel>작업</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          <NavItem icon={<Home size={15} aria-hidden="true" />} label="작업물" active />
          <NavItem icon={<Sparkles size={15} aria-hidden="true" />} label="브랜드 보이스" soon />
          <NavItem icon={<Settings size={15} aria-hidden="true" />} label="설정" soon />
        </nav>

        <p className="mt-auto border-t border-hair-soft px-2.5 pt-3 text-[11px] leading-relaxed text-ink-2">
          카피는 로컬 Claude 로 생성돼요. 사진은 이 기기를 벗어나지 않아요.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center gap-3 border-b border-hair bg-surface px-6">
          <span className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-hair bg-canvas px-3 text-ink-2 lg:max-w-[420px]">
            <span className="flex-none">
              <Command size={14} aria-hidden="true" />
            </span>
            <span className="truncate text-sm">키워드로 지난 작업 찾기</span>
            <span className="ml-auto flex-none rounded border border-hair bg-surface px-1.5 text-[11px] font-semibold tabular-nums">
              ⌘K
            </span>
          </span>
          <div className="ml-auto flex flex-none items-center gap-2">{action}</div>
        </header>

        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** 헤더 우측 인라인 통계 — Palisade·Nudge 가 쓰는 패턴. 별도 KPI 카드 줄 없이 헤더 행에 얹는다. */
export function StatStrip({ items }: { items: readonly { label: string; value: string }[] }) {
  return (
    <dl className="flex flex-none items-start gap-7">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-semibold text-ink-2">{it.label}</dt>
          <dd className="text-[19px] font-extrabold leading-none tabular-nums tracking-tight">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 페이지 헤더 — h1 + 점으로 이은 메타 한 줄. 네 후보 전부가 쓰는 형태. */
export function PageHead({
  title,
  meta,
  right,
}: {
  title: string;
  meta: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-5 pt-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{title}</h1>
        <p className="text-sm text-ink-2">{meta}</p>
      </div>
      {right}
    </div>
  );
}

import { Check } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { Logo, StudioMark } from "@/components/brand/Mark";

/**
 * D2 무채색 캔버스 — 공통 프레임.
 *
 * 원칙: **UI 에 액센트 색을 쓰지 않는다.** 색은 오직 사용자 사진과 완성된 카드에서만
 * 나온다. 강조는 검정 채움(`bg-ink text-surface`)과 굵기로 만든다.
 *
 * 상단에 흩어져 있던 브랜드·진행·컨텍스트를 **좌측 사이드바 한 덩어리로 모았다.**
 * 상단 가로줄에 늘어놓으면 서로 관계없는 조각들이 떨어져 보인다 — 셋 다 "지금 무슨
 * 작업을 어디까지 하고 있는가"를 말하는 정보라 한 곳에 모여야 읽힌다.
 *
 * 시인성: 본문 15px, 섹션 제목 15px, 사이드바 단계 15px 로 전반을 키웠다.
 */

export const STEPS = [
  { label: "주제", note: "무엇을 만들지 정해요" },
  { label: "만들기", note: "사진을 올리고 카피를 고쳐요" },
  { label: "내보내기", note: "세트로 확인하고 저장해요" },
] as const;

export function StudioFrame({
  step,
  summary,
  sidebar,
  title,
  action,
  children,
}: {
  step: number;
  /** 사이드바 하단에 상시 노출되는 현재 작업 요약 */
  summary?: readonly { label: string; value: string }[];
  /** 요약 아래에 붙는 화면별 블록(만들기 화면의 점검 목록 등). 없으면 자리도 안 만든다. */
  sidebar?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // `xl:h-screen` — 만들기 화면(`WorkbenchScreen`)이 `xl` 이상에서 `<main>` 의 남는 세로 폭을
    // flex 로 계산하려면(카드가 세트 바·툴바 아래 남는 높이에 맞춰지도록) 이 조상이 **확정된
    // 높이**를 가져야 한다 — `min-height` 만으로는 `flex-1` 자식의 높이가 확정되지 않는다.
    // 이 확정 높이 때문에 `overflow` 를 기본값(visible)으로 두면 `<main>` 내용이 뷰포트를
    // 넘길 때 **문서는 늘어나 스크롤되지만, 이 루트 박스 자체의 높이는 `h-screen` 에 고정된 채라
    // 배경(`bg-surface`)과 사이드바 테두리가 뷰포트 높이에서 그대로 끊긴다** — 그 아래 내용은
    // 프레임 밖 body 배경 위에 얹힌 것처럼 보인다. 그래서 `<main>` 을 `xl:overflow-y-auto` 로
    // 만들어 **넘치는 내용이 `<main>` 안에서만 스크롤**하게 한다 — 문서(body) 는 늘 정확히
    // 뷰포트 높이이므로 프레임 배경·테두리가 끊길 일이 없다. 주제·내보내기 화면처럼 이 기준
    // 높이를 쓰는 자식이 없는 화면도 내용이 길면 `<main>` 안에서 스크롤될 뿐 결과는 같다.
    <div className="flex min-h-screen flex-col bg-surface text-ink lg:flex-row xl:h-screen">
      {/* 모바일 — 사이드바를 세울 폭이 없다. 같은 정보를 가로로 압축해 상단에 둔다. */}
      <div className="flex flex-col gap-2.5 border-b border-hair px-5 py-3 lg:hidden">
        <div className="flex justify-center">
          <StudioMark size={28} />
        </div>
        <ol className="flex items-center gap-1.5">
          {STEPS.map((s, i) => {
            const done = i < step;
            const now = i === step;
            return (
              <li key={s.label} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <span className="h-px w-3 flex-none bg-hair" aria-hidden="true" />}
                <span
                  aria-current={now ? "step" : undefined}
                  className={`flex h-8 flex-none items-center gap-1.5 rounded-full px-3 text-[14px] ${
                    now ? "bg-ink font-bold text-surface" : done ? "font-bold text-ink" : "text-ink-3"
                  }`}
                >
                  <span className="tabular-nums">{i + 1}</span>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
        {summary && (
          <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {summary.map((s) => (
              <div key={s.label} className="flex min-w-0 items-baseline gap-1.5">
                <dt className="flex-none text-[13px] text-ink-2">{s.label}</dt>
                <dd className="truncate text-[13px] font-bold">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <aside className="hidden w-[276px] flex-none flex-col gap-6 border-r border-hair px-6 py-5 lg:flex">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <nav aria-label="진행 단계">
          <ol className="flex flex-col gap-1">
            {STEPS.map((s, i) => {
              const done = i < step;
              const now = i === step;
              return (
                <li key={s.label}>
                  <div
                    aria-current={now ? "step" : undefined}
                    className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${
                      now ? "bg-ink text-surface" : ""
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${
                        now
                          ? "bg-surface text-ink"
                          : done
                            ? "bg-ink text-surface"
                            : "border border-hair text-ink-3"
                      }`}
                    >
                      {done ? <Check size={11} strokeWidth={3.5} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className={`text-[15px] font-bold ${now || done ? "" : "text-ink-3"}`}>
                        {s.label}
                      </span>
                      <span className={`text-[13px] leading-snug ${now ? "text-surface" : "text-ink-2"}`}>
                        {s.note}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>

        {summary && (
          <dl className="flex flex-col gap-2.5 border-t border-hair pt-4">
            {summary.map((s) => (
              <div key={s.label} className="flex flex-col gap-0.5">
                <dt className="text-[13px] text-ink-2">{s.label}</dt>
                <dd className="truncate text-[15px] font-bold tracking-tight">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {sidebar && <div className="border-t border-hair pt-4">{sidebar}</div>}

        <p className="mt-auto border-t border-hair pt-4 text-[13px] leading-relaxed text-ink-2">
          저장하거나 폰으로 보낼 때는 사진이 이 집 네트워크를 벗어나지 않아요. 인스타그램에 올릴 때만
          사진이 인스타그램 서버로 나가요. 카피는 로컬 Claude 가 씁니다.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[76px] flex-none flex-wrap items-center gap-x-4 gap-y-3 border-b border-hair px-5 py-4 sm:px-8 lg:px-10">
          <h1 className="min-w-0 flex-1 truncate text-[20px] font-black tracking-tight sm:text-[24px]">{title}</h1>
          <div className="flex flex-none flex-wrap items-center gap-2.5">{action}</div>
        </header>

        <main className="min-h-0 flex-1 xl:overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

/** 검정 채움 버튼 — 이 시스템의 유일한 강조 수단. */
export function SolidButton({
  children,
  size = "md",
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  size?: "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-ink font-bold text-surface transition-opacity duration-200 hover:opacity-85 disabled:bg-hair disabled:text-ink-disabled ${FOCUS_RING} motion-reduce:transition-none ${
        size === "lg" ? "h-14 px-7 text-[17px]" : "h-11 px-5 text-[15px]"
      }`}
    >
      {children}
    </button>
  );
}

export function LineButton({
  children,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-hair px-5 text-[15px] font-bold transition-colors duration-200 hover:border-ink hover:bg-hair-soft disabled:text-ink-disabled disabled:hover:border-hair disabled:hover:bg-transparent ${FOCUS_RING} motion-reduce:transition-none`}
    >
      {children}
    </button>
  );
}

export function SectionHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-hair pb-3">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {aside && <span className="text-[14px] text-ink-2">{aside}</span>}
    </div>
  );
}

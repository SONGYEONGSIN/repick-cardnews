import { ContiMark, FOCUS_RING } from "@/components/ui";

/**
 * D2 무채색 캔버스 — 공통 프레임.
 *
 * 원칙: **UI 에 액센트 색을 쓰지 않는다.** 색은 오직 사용자 사진과 완성된 카드에서만
 * 나온다. 강조가 필요하면 검정 채움(`bg-ink text-surface`)과 굵기로 만든다. 도구가
 * 결과물과 색으로 경쟁하지 않게 하려는 것이다.
 *
 * 위계는 크기·굵기·자간으로만 만든다. 웨이트는 정확히 3종 — 400 / 700 / 900.
 *
 * 셸도 백지에서 다시 잡았다. 좌측 nav 사이드바는 3화면 선형 흐름에 과하다. 얇은 상단바
 * 하나만 두고 화면은 콘텐츠가 통째로 쓴다.
 */

export const STEPS = ["주제", "만들기", "내보내기"] as const;

export function Frame({
  step,
  context,
  action,
  children,
}: {
  step: number;
  context?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-52px)] flex-col bg-surface text-ink">
      <header className="flex h-16 flex-none items-center gap-6 border-b border-hair px-8">
        <span className="flex flex-none items-center gap-2">
          <ContiMark size={18} />
          <span className="text-[15px] font-black tracking-tight">콘티</span>
        </span>

        <ol className="flex min-w-0 items-center gap-1.5">
          {STEPS.map((label, i) => {
            const done = i < step;
            const now = i === step;
            return (
              <li key={label} className="flex items-center gap-1.5">
                {i > 0 && <span className="h-px w-5 bg-hair" aria-hidden="true" />}
                <span
                  aria-current={now ? "step" : undefined}
                  className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] ${
                    now
                      ? "bg-ink font-bold text-surface"
                      : done
                        ? "font-bold text-ink"
                        : "text-ink-3"
                  }`}
                >
                  <span className="tabular-nums">{i + 1}</span>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        {context && <p className="min-w-0 truncate text-[13px] text-ink-2">{context}</p>}

        <div className="ml-auto flex flex-none items-center gap-2">{action}</div>
      </header>

      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}

/** 검정 채움 버튼 — 이 시스템의 유일한 강조 수단. */
export function SolidButton({
  children,
  size = "md",
  disabled = false,
}: {
  children: React.ReactNode;
  size?: "md" | "lg";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-ink font-bold text-surface transition-opacity duration-200 hover:opacity-85 disabled:bg-hair disabled:text-ink-disabled ${FOCUS_RING} motion-reduce:transition-none ${
        size === "lg" ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-sm"
      }`}
    >
      {children}
    </button>
  );
}

/** 테두리만 있는 버튼 — 보조 액션. */
export function LineButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-hair px-4 text-sm font-bold transition-colors duration-200 hover:border-ink ${FOCUS_RING} motion-reduce:transition-none`}
    >
      {children}
    </button>
  );
}

/** 섹션 제목 — 대문자 마이크로 레이블 대신 굵기와 헤어라인으로 구분한다. */
export function SectionHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-hair pb-2.5">
      <h2 className="text-[13px] font-bold">{title}</h2>
      {aside && <span className="text-[13px] text-ink-2">{aside}</span>}
    </div>
  );
}

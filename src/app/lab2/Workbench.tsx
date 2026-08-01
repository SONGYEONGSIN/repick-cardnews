"use client";

import { useState } from "react";
import { ArrowRight, GripVertical, Plus, Redo2, RefreshCw, Undo2 } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { Frame, LineButton, SectionHead, SolidButton } from "./Frame";
import { Inspector } from "./Inspector";
import { SAMPLE_CARDS, THEMES, TONE_CLASS, UNUSED_PHOTOS } from "../lab/wb/data";

/**
 * 화면 2 — 만들기. 사진·순서·편집이 한 화면이다(기존 3단계 통합).
 *
 * 설정을 두 층으로 나눴다. **세트 단위**(테마·제목 서체·핸들)는 상단 바에, **카드 단위**는
 * 우측 인스펙터에. 카드마다 서체가 다르면 다섯 장이 한 덩어리로 안 읽히므로 그 결정은
 * 카드 옆에 두면 안 된다.
 *
 * 색이 없는 UI 라 **사진과 카드 프리뷰가 화면에서 유일하게 색을 가진 것**이 된다.
 */

const HEAD_FONTS = ["두들체", "고딕 볼드", "본문과 같게"] as const;

export function Workbench() {
  const [selected, setSelected] = useState(1);
  const card = SAMPLE_CARDS[selected];

  return (
    <Frame
      step={1}
      title="에어컨 전기세"
      summary={[
        { label: "형태", value: "카드뉴스 5장" },
        { label: "저장 위치", value: "cardnews/에어컨-전기세-0801" },
      ]}
      action={
        <>
          <span className="flex items-center rounded-lg border border-hair">
            <button
              type="button"
              aria-label="되돌리기"
              className={`flex h-11 w-11 items-center justify-center rounded-l-lg text-ink-2 transition-colors duration-200 hover:text-ink ${FOCUS_RING} motion-reduce:transition-none`}
            >
              <Undo2 size={16} aria-hidden="true" />
            </button>
            <span className="h-6 w-px bg-hair" aria-hidden="true" />
            <button
              type="button"
              aria-label="다시 실행"
              className={`flex h-11 w-11 items-center justify-center rounded-r-lg text-ink-disabled ${FOCUS_RING}`}
            >
              <Redo2 size={16} aria-hidden="true" />
            </button>
          </span>
          <LineButton>
            <RefreshCw size={15} aria-hidden="true" />
            전체 다시
          </LineButton>
          <SolidButton>
            내보내기
            <ArrowRight size={16} aria-hidden="true" />
          </SolidButton>
        </>
      }
    >
      <div className="flex flex-col gap-8 px-5 py-6 sm:px-8 lg:gap-9 lg:px-10 lg:py-9">
        {/* 세트 단위 — 다섯 장 전체에 걸리는 설정 */}
        <section className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-xl border border-hair px-5 py-4">
          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-bold text-ink-2">테마</p>
            <div className="inline-flex rounded-lg border border-hair p-1">
              {THEMES.map((t, i) => (
                <span
                  key={t.id}
                  className={`h-10 rounded px-3.5 text-[14px] font-bold leading-10 ${
                    i === 0 ? "bg-ink text-surface" : "text-ink-2"
                  }`}
                >
                  {t.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-bold text-ink-2">제목 서체</p>
            <div className="inline-flex rounded-lg border border-hair p-1">
              {HEAD_FONTS.map((f, i) => (
                <span
                  key={f}
                  className={`h-10 rounded px-3.5 text-[14px] font-bold leading-10 ${
                    i === 0 ? "bg-ink text-surface" : "text-ink-2"
                  }`}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="flex min-w-[180px] flex-1 flex-col gap-2">
            <label htmlFor="handle" className="text-[14px] font-bold text-ink-2">
              계정 핸들
            </label>
            <input
              id="handle"
              defaultValue="@repick.kr"
              className={`h-10 w-full rounded-lg border border-hair px-3 text-[15px] transition-colors duration-200 focus:border-ink focus:outline-none ${FOCUS_RING} motion-reduce:transition-none`}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHead
            title="넘겨 보는 순서"
            aside={
              <>
                끌어서 자리를 바꿔요 · <span className="tabular-nums">←</span>{" "}
                <span className="tabular-nums">→</span> 로도 넘겨요
              </>
            }
          />
          <div className="flex items-start gap-3 overflow-x-auto pb-2">
            {SAMPLE_CARDS.map((c, i) => {
              const on = i === selected;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={on}
                  className={`flex w-[152px] flex-none flex-col gap-2.5 rounded-xl border-2 p-2.5 text-left transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
                    on ? "border-ink" : "border-transparent hover:border-hair"
                  }`}
                >
                  <span className={`relative block aspect-[4/5] w-full overflow-hidden rounded-lg ${TONE_CLASS[c.tone]}`}>
                    <span className="absolute left-2 top-2 rounded bg-surface px-2 py-0.5 text-[13px] font-bold tabular-nums">
                      {i + 1}
                    </span>
                    <GripVertical size={15} aria-hidden="true" className="absolute right-1.5 top-2 text-ink-2" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-[14px] font-bold">{c.roleLabel}</span>
                    <span className="truncate text-[13px] text-ink-2">{c.heading}</span>
                  </span>
                </button>
              );
            })}

            <span className="mx-3 h-[232px] w-px flex-none bg-hair" aria-hidden="true" />

            <div className="flex flex-none items-start gap-3">
              {UNUSED_PHOTOS.map((p) => (
                <div key={p.id} className="flex w-[120px] flex-none flex-col gap-2 p-2.5">
                  <span className={`block aspect-[4/5] w-full rounded-lg ${TONE_CLASS[p.tone]}`} />
                  <span className="truncate text-[13px] text-ink-2">{p.name}</span>
                </div>
              ))}
              <button
                type="button"
                className={`m-2.5 flex aspect-[4/5] w-[120px] flex-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-hair text-ink-2 transition-colors duration-200 hover:border-ink hover:text-ink ${FOCUS_RING} motion-reduce:transition-none`}
              >
                <Plus size={20} aria-hidden="true" />
                <span className="text-[13px] font-bold">사진 추가</span>
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-9 xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="flex flex-col gap-4">
            <SectionHead title={`${selected + 1}번 · ${card.roleLabel}`} aside="1080 × 1350" />
            <div className="flex justify-center rounded-2xl bg-canvas px-4 py-8 lg:py-12">
              <div className="flex aspect-[4/5] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-hair bg-surface">
                {card.layout === "split" && <span className={`block h-[42%] w-full ${TONE_CLASS[card.tone]}`} />}
                {card.layout === "full-bleed" && (
                  <span className={`relative flex flex-1 flex-col justify-end ${TONE_CLASS[card.tone]}`}>
                    <span className="flex flex-col gap-3 bg-surface/85 p-7">
                      <span className="text-[24px] font-black leading-tight tracking-tight sm:text-[32px]">
                        {card.heading}
                      </span>
                      {card.action && (
                        <span className="self-start rounded-full bg-ink px-4 py-2 text-[15px] font-bold text-surface">
                          {card.action}
                        </span>
                      )}
                    </span>
                  </span>
                )}
                {card.layout !== "full-bleed" && (
                  <span
                    className={`flex flex-1 flex-col gap-3 p-7 ${card.layout === "text-only" ? "justify-center" : ""}`}
                  >
                    <span className="text-[24px] font-black leading-tight tracking-tight sm:text-[32px]">
                      {card.heading}
                    </span>
                    {card.body && (
                      <span className="text-[15px] leading-relaxed text-ink-2 sm:text-[17px]">{card.body}</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <SectionHead title="이 카드 고치기" />
            <Inspector card={card} />
          </aside>
        </div>
      </div>
    </Frame>
  );
}

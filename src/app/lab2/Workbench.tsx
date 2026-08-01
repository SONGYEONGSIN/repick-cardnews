"use client";

import { useState } from "react";
import { ArrowRight, GripVertical, Plus, RefreshCw } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { Frame, LineButton, SectionHead, SolidButton } from "./Frame";
import { LAYOUT_LABEL, SAMPLE_CARDS, TONE_CLASS, UNUSED_PHOTOS } from "../lab/wb/data";

/**
 * 화면 2 — 만들기. 사진·순서·편집이 한 화면이다(기존 3단계 통합).
 *
 * 순서 레일이 가로인 이유: 카드뉴스는 옆으로 넘겨 보는 매체다. 조작 축과 결과물의 축을 맞춘다.
 *
 * 색이 없는 UI 라 **사진과 카드 프리뷰가 화면에서 유일하게 색을 가진 것**이 된다 — 시선이
 * 자동으로 결과물로 간다. 그래서 프리뷰를 크게 잡았다(최대 520px).
 */

const INPUT =
  "w-full rounded-lg border border-hair bg-surface px-3.5 py-3 text-[15px] transition-colors duration-200 focus:border-ink focus:outline-none motion-reduce:transition-none";

function Slider({ label, value }: { label: string; value: number }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-[92px] flex-none text-[14px] text-ink-2">{label}</span>
      <input type="range" min={0} max={100} defaultValue={value} className={`h-1 w-full accent-ink ${FOCUS_RING}`} />
      <span className="w-9 flex-none text-right text-[13px] tabular-nums text-ink-2">{value}</span>
    </label>
  );
}

/** 글자수 — 넘치면 검정 채움으로 뒤집어 경고한다(색을 쓰지 않으므로). */
function Counter({ len, max }: { len: number; max: number }) {
  const over = len > max;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[13px] font-bold tabular-nums ${
        over ? "bg-ink text-surface" : "text-ink-2"
      }`}
    >
      {len}/{max}
    </span>
  );
}

export function Workbench() {
  const [selected, setSelected] = useState(1);
  const card = SAMPLE_CARDS[selected];

  return (
    <Frame
      step={1}
      title="에어컨 전기세"
      summary={[
        { label: "형태", value: "카드뉴스 5장" },
        { label: "테마", value: "보라 두들" },
        { label: "저장 위치", value: "cardnews/에어컨-전기세-0801" },
      ]}
      action={
        <>
          <LineButton>
            <RefreshCw size={15} aria-hidden="true" />
            카피 다시
          </LineButton>
          <SolidButton>
            내보내기
            <ArrowRight size={16} aria-hidden="true" />
          </SolidButton>
        </>
      }
    >
      <div className="flex flex-col gap-9 px-10 py-9">
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
            <div className="flex justify-center rounded-2xl bg-canvas py-12">
              <div className="flex aspect-[4/5] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-hair bg-surface">
                {card.layout === "split" && <span className={`block h-[42%] w-full ${TONE_CLASS[card.tone]}`} />}
                {card.layout === "full-bleed" && (
                  <span className={`relative flex flex-1 flex-col justify-end ${TONE_CLASS[card.tone]}`}>
                    <span className="flex flex-col gap-3 bg-surface/85 p-7">
                      <span className="text-[32px] font-black leading-tight tracking-tight">{card.heading}</span>
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
                    <span className="text-[32px] font-black leading-tight tracking-tight">{card.heading}</span>
                    {card.body && <span className="text-[17px] leading-relaxed text-ink-2">{card.body}</span>}
                  </span>
                )}
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <SectionHead title="이 카드 고치기" />

            <div className="flex flex-col gap-2.5">
              <p className="text-[15px] font-bold text-ink-2">레이아웃</p>
              <div className="inline-flex rounded-lg border border-hair p-1">
                {(["full-bleed", "split", "text-only"] as const).map((l) => (
                  <span
                    key={l}
                    className={`h-11 rounded px-4 text-[15px] font-bold leading-[2.75rem] ${
                      l === card.layout ? "bg-ink text-surface" : "text-ink-2"
                    }`}
                  >
                    {LAYOUT_LABEL[l]}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="hd" className="text-[15px] font-bold text-ink-2">
                  헤드라인
                </label>
                <Counter len={card.heading.length} max={40} />
              </div>
              <textarea id="hd" rows={2} defaultValue={card.heading} className={INPUT} />
            </div>

            {card.body !== undefined && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between">
                  <label htmlFor="bd" className="text-[15px] font-bold text-ink-2">
                    본문
                  </label>
                  <Counter len={card.body.length} max={120} />
                </div>
                <textarea id="bd" rows={4} defaultValue={card.body} className={INPUT} />
              </div>
            )}

            {card.layout !== "text-only" && (
              <div className="flex flex-col gap-4 border-t border-hair pt-5">
                <p className="text-[15px] font-bold text-ink-2">사진 조절</p>
                <Slider label="가로 초점" value={50} />
                <Slider label="세로 초점" value={40} />
                {card.layout === "full-bleed" && <Slider label="글 배경" value={70} />}
                {card.layout === "split" && <Slider label="사진 높이" value={42} />}
              </div>
            )}
          </aside>
        </div>
      </div>
    </Frame>
  );
}

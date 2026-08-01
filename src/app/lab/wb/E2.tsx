"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { PageHead, Shell } from "../Shell";
import { CardPreview, Inspector, SlotChip } from "./Pieces";
import { SAMPLE_CARDS, THEMES, TONE_CLASS, UNUSED_PHOTOS } from "./data";

/**
 * E2 — 필름스트립. 상단 가로 스트립(카드 순서 + 안 쓴 사진이 한 줄) · 좌 대형 프리뷰 · 우 인스펙터.
 *
 * 카드뉴스는 옆으로 넘겨 보는 매체다. 순서를 세로 목록이 아니라 **가로 스트립**으로 두면
 * 조작 방향과 결과물의 방향이 일치하고, 안 쓴 사진을 같은 줄 끝에 두면 슬롯에 끌어 넣는
 * 동작이 한 축에서 끝난다.
 *
 * 강점: 세트 전체의 흐름이 한 줄로 읽히고, 세로 공간이 프리뷰와 인스펙터에 몰린다.
 * 약점: 카드가 6장을 넘으면 스트립이 가로로 스크롤돼야 한다.
 */
export function WorkbenchE2() {
  const [selected, setSelected] = useState(0);
  const card = SAMPLE_CARDS[selected];

  return (
    <Shell
      action={
        <button
          type="button"
          className={`flex h-9 items-center gap-2 rounded-lg bg-plum px-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-plum-hover active:bg-plum-active ${FOCUS_RING} motion-reduce:transition-none`}
        >
          <Download size={15} strokeWidth={2.5} aria-hidden="true" />
          5장 내보내기
        </button>
      }
    >
      <PageHead
        title="에어컨 전기세"
        meta="카드뉴스 · 5장 · 보라 두들 · cardnews/에어컨-전기세-0801"
        right={
          <div className="inline-flex rounded-lg border border-hair bg-surface p-1">
            {THEMES.map((t, i) => (
              <span
                key={t.id}
                className={`h-9 rounded-md px-3 text-sm font-semibold leading-9 ${
                  i === 0 ? "bg-plum text-white" : "text-ink-2"
                }`}
              >
                {t.label}
              </span>
            ))}
          </div>
        }
      />

      <div className="flex flex-col gap-4 px-6 pb-8">
        {/* 필름스트립 — 순서와 미사용 사진이 한 축에 있다 */}
        <section className="flex flex-col gap-2 rounded-xl border border-hair bg-surface p-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[13px] font-semibold">넘겨 보는 순서</h2>
            <span className="text-[13px] text-ink-2">끌어서 자리를 바꿔요 · 5장</span>
          </div>
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
            {SAMPLE_CARDS.map((c, i) => (
              <SlotChip
                key={c.id}
                card={c}
                index={i}
                selected={i === selected}
                onSelect={() => setSelected(i)}
                orientation="horizontal"
              />
            ))}

            <span className="mx-1 w-px flex-none self-stretch bg-hair" aria-hidden="true" />

            <div className="flex flex-none items-center gap-2">
              <span className="text-[11px] font-semibold text-ink-2">안 쓴 사진</span>
              {UNUSED_PHOTOS.map((p) => (
                <div key={p.id} className="flex w-[72px] flex-none flex-col gap-1">
                  <div className={`aspect-[4/5] w-full rounded border border-hair ${TONE_CLASS[p.tone]}`} />
                  <p className="truncate text-[10px] text-ink-2">{p.name}</p>
                </div>
              ))}
              <button
                type="button"
                className={`flex aspect-[4/5] w-[72px] flex-none flex-col items-center justify-center gap-1 rounded border border-dashed border-hair text-ink-2 hover:border-plum hover:text-plum ${FOCUS_RING}`}
              >
                <Plus size={15} aria-hidden="true" />
                <span className="text-[10px]">추가</span>
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between border-b border-hair pb-2">
              <h2 className="text-[13px] font-semibold">
                <span className="tabular-nums text-ink-2">{selected + 1}</span> · {card.roleLabel}
              </h2>
              <span className="text-[13px] text-ink-2">1080 × 1350</span>
            </div>
            <div className="mx-auto w-full max-w-[440px]">
              <CardPreview card={card} size="lg" />
            </div>
          </section>

          <aside className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between border-b border-hair pb-2">
              <h2 className="text-[13px] font-semibold">이 카드 편집</h2>
            </div>
            <Inspector card={card} />
          </aside>
        </div>
      </div>
    </Shell>
  );
}

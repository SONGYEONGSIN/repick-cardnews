"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { PageHead, Shell } from "../Shell";
import { CardPreview, Inspector, PhotoChip, SlotChip } from "./Pieces";
import { SAMPLE_CARDS, THEMES, UNUSED_PHOTOS } from "./data";

/**
 * E1 — 3열 워크벤치. 좌 슬롯 레일 · 중앙 대형 프리뷰 · 우 인스펙터.
 *
 * 편집 도구의 표준 골격이고, Nudge(r12 c)의 좌-우 2패널을 3열로 늘린 형태다.
 * 사진·순서·편집이 한 화면에 들어와 지금의 3단계가 1단계로 합쳐진다.
 *
 * 강점: 예측 가능하고, 인스펙터에 세로 공간이 넉넉해 슬라이더가 답답하지 않다.
 * 약점: 프리뷰가 가운데 한 장뿐이라 세트 전체의 톤을 한눈에 못 본다.
 */
export function WorkbenchE1() {
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

      <div className="grid gap-4 px-6 pb-8 xl:grid-cols-[248px_minmax(0,1fr)_320px]">
        <aside className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between border-b border-hair pb-2">
            <h2 className="text-[13px] font-semibold">카드 순서</h2>
            <span className="text-[13px] tabular-nums text-ink-2">5장</span>
          </div>
          <ol className="flex flex-col gap-1.5">
            {SAMPLE_CARDS.map((c, i) => (
              <li key={c.id}>
                <SlotChip card={c} index={i} selected={i === selected} onSelect={() => setSelected(i)} />
              </li>
            ))}
          </ol>

          <div className="mt-2 flex flex-col gap-2 border-t border-hair-soft pt-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold">안 쓴 사진</h2>
              <span className="text-[13px] tabular-nums text-ink-2">{UNUSED_PHOTOS.length}장</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {UNUSED_PHOTOS.map((p) => (
                <PhotoChip key={p.id} name={p.name} tone={p.tone} />
              ))}
              <button
                type="button"
                className={`flex aspect-[4/5] w-[76px] flex-none flex-col items-center justify-center gap-1 rounded border border-dashed border-hair text-ink-2 hover:border-plum hover:text-plum ${FOCUS_RING}`}
              >
                <Plus size={15} aria-hidden="true" />
                <span className="text-[10px]">추가</span>
              </button>
            </div>
          </div>
        </aside>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between border-b border-hair pb-2">
            <h2 className="text-[13px] font-semibold">
              <span className="tabular-nums text-ink-2">{selected + 1}</span> · {card.roleLabel}
            </h2>
            <span className="text-[13px] text-ink-2">1080 × 1350</span>
          </div>
          <div className="mx-auto w-full max-w-[420px]">
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
    </Shell>
  );
}

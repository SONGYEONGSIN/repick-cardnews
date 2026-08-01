"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { PageHead, Shell } from "../Shell";
import { CardPreview, Inspector } from "./Pieces";
import { LAYOUT_LABEL, SAMPLE_CARDS, THEMES, TONE_CLASS, UNUSED_PHOTOS } from "./data";

/**
 * E3 — 갤러리 직접편집. 인스펙터 패널이 없다.
 *
 * 카드 전부를 실제 비율로 펼쳐 놓고, 고른 카드만 그 자리에서 펼쳐져 편집 컨트롤이 카드
 * 아래 인라인으로 열린다. 세트의 톤을 항상 눈으로 비교하면서 고칠 수 있다 — 카드뉴스는
 * 장마다 따로 예쁜 것보다 다섯 장이 한 덩어리로 읽히는 게 중요하다.
 *
 * 강점: 전체를 동시에 본다. 별도 패널이 없어 화면이 단순하다.
 * 약점: 편집 중인 카드가 열리면 아래 카드들이 밀린다. 슬라이더가 들어갈 폭이 좁다.
 */
export function WorkbenchE3() {
  const [selected, setSelected] = useState<number | null>(1);

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
        meta="카드뉴스 · 5장 · 보라 두들 · 카드를 눌러 그 자리에서 고쳐요"
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

      <div className="flex flex-col gap-5 px-6 pb-8">
        <ol className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {SAMPLE_CARDS.map((c, i) => {
            const open = i === selected;
            return (
              <li key={c.id} className={open ? "md:col-span-3 xl:col-span-2" : ""}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-1.5 px-0.5">
                    <span className="text-[11px] font-semibold tabular-nums text-ink-2">{i + 1}</span>
                    <span className="text-[11px] font-semibold">{c.roleLabel}</span>
                    <span className="ml-auto rounded bg-hair-soft px-1.5 text-[10px] text-ink-2">
                      {LAYOUT_LABEL[c.layout]}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelected(open ? null : i)}
                    aria-pressed={open}
                    className={`rounded-xl transition-shadow duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
                      open ? "ring-2 ring-plum" : "hover:ring-2 hover:ring-hair"
                    }`}
                  >
                    <CardPreview card={c} size={open ? "lg" : "sm"} />
                  </button>

                  {open && (
                    <div className="mt-1 rounded-xl border border-hair bg-surface p-4">
                      <Inspector card={c} compact />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <section className="flex flex-col gap-2 border-t border-hair pt-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold">안 쓴 사진</h2>
            <span className="text-[13px] tabular-nums text-ink-2">{UNUSED_PHOTOS.length}장</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {UNUSED_PHOTOS.map((p) => (
              <div key={p.id} className="flex w-[84px] flex-none flex-col gap-1">
                <div className={`aspect-[4/5] w-full rounded border border-hair ${TONE_CLASS[p.tone]}`} />
                <p className="truncate text-[10px] text-ink-2">{p.name}</p>
              </div>
            ))}
            <button
              type="button"
              className={`flex aspect-[4/5] w-[84px] flex-none flex-col items-center justify-center gap-1 rounded border border-dashed border-hair text-ink-2 hover:border-plum hover:text-plum ${FOCUS_RING}`}
            >
              <Plus size={15} aria-hidden="true" />
              <span className="text-[10px]">추가</span>
            </button>
          </div>
        </section>
      </div>
    </Shell>
  );
}

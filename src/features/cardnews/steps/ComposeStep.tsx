"use client";

import { useState } from "react";
import { Panel } from "@/components/ui";
import { CardRenderer } from "@/templates/CardRenderer";
import { CardInspector } from "../parts/CardInspector";
import { toRenderCards } from "../render";
import type { CardnewsAction, CardnewsState } from "../reducer";

export function ComposeStep({
  state,
  dispatch,
}: {
  state: CardnewsState;
  dispatch: React.Dispatch<CardnewsAction>;
}) {
  const [selected, setSelected] = useState(0);
  const rendered = toRenderCards(state);
  const current = rendered[selected];
  const draft = state.cards[selected];

  if (!current || !draft) {
    return <p className="text-sm text-ink-3">먼저 카피를 생성해 주세요.</p>;
  }

  return (
    <div className="grid h-full grid-cols-[128px_minmax(0,1fr)_320px] gap-5">
      <nav aria-label="카드 목록" className="min-w-0 overflow-y-auto">
        <ul className="flex flex-col gap-2">
          {rendered.map((card, i) => (
            <li key={i}>
              <button
                type="button"
                aria-current={i === selected ? "true" : undefined}
                onClick={() => setSelected(i)}
                className={`w-full overflow-hidden rounded-lg border-2 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
                  i === selected ? "border-plum" : "border-hair"
                }`}
              >
                <span className="block aspect-[4/5] w-full overflow-hidden bg-hair-soft">
                  <span className="block origin-top-left scale-[0.1037]">
                    <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
                  </span>
                </span>
              </button>
              <p className="mt-1 text-center tabular-nums text-[11px] text-ink-3">{i + 1}</p>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 items-start justify-center overflow-y-auto">
        {/* 1080×1350 스테이지를 432×540 박스에 담기 위한 고정 픽셀 크기 — Tailwind 토큰으로 표현 불가 */}
        <div className="overflow-hidden rounded-xl border border-hair shadow-sm" style={{ width: 432, height: 540 }}>
          <div className="origin-top-left scale-40">
            <CardRenderer card={current} themeId={state.themeId} handle={state.handle} />
          </div>
        </div>
      </div>

      <Panel className="min-w-0 overflow-y-auto p-4">
        <h2 className="mb-4 text-sm font-semibold">
          <span className="tabular-nums text-ink-3">{selected + 1}번</span> 카드
        </h2>
        <CardInspector
          card={draft}
          index={selected}
          onPatch={(patch) => dispatch({ type: "UPDATE_CARD", index: selected, patch })}
        />
      </Panel>
    </div>
  );
}

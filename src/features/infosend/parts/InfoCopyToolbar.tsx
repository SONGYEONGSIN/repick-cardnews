"use client";

import { useState, type Dispatch } from "react";
import { FOCUS_RING } from "@/components/ui";
import { InfoItemsEditor } from "./InfoItemsEditor";
import { InfoTextEditor } from "./InfoTextEditor";
import { ITEMS_MAX, ITEMS_MIN, type InfoAction, type InfoState } from "../reducer";

/**
 * 왼쪽 칸의 **글·항목 툴바**.
 *
 * 둘 다 세로로 긴 편집이라 왼쪽에 두되, 위아래로 쌓으면 화면이 길어져 카드가 밀린다.
 * 오른쪽(테마·맞춤)과 **같은 골격의 탭**으로 묶어 한 번에 하나만 보인다 —
 * 어느 쪽을 보든 같은 자리에서 같은 모양으로 고친다(`docs/ui-standards.md` §1).
 */

type CopyTarget = "text" | "items";

const TABS: readonly { id: CopyTarget; label: string }[] = [
  { id: "text", label: "글" },
  { id: "items", label: "항목" },
];

export function InfoCopyToolbar({ state, dispatch }: { state: InfoState; dispatch: Dispatch<InfoAction> }) {
  const [target, setTarget] = useState<CopyTarget>("text");
  if (!state.spec) return null;

  const hint = target === "items" ? `항목은 ${ITEMS_MIN}~${ITEMS_MAX}개예요. 끌어서 순서를 바꿔요` : "제목·부제·팁을 고쳐요";

  return (
    <div className="flex flex-col rounded-xl border border-hair">
      <div className="flex items-center gap-2 border-b border-hair p-2">
        <div className="flex gap-1" role="tablist" aria-label="고칠 글">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={target === t.id}
              onClick={() => setTarget(t.id)}
              className={`h-9 rounded-lg px-3.5 text-[14px] font-bold transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
                target === t.id ? "bg-ink text-surface" : "text-ink-2 hover:bg-hair-soft hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 오른쪽 툴바와 같은 골격 — 위는 안내, 아래는 조작. */}
      <div role="tabpanel" className="flex flex-col gap-2 px-3 py-2.5">
        <p className="text-[13px] leading-relaxed text-ink-2">{hint}</p>
        {target === "text" ? (
          <InfoTextEditor state={state} dispatch={dispatch} />
        ) : (
          <InfoItemsEditor state={state} dispatch={dispatch} />
        )}
      </div>
    </div>
  );
}

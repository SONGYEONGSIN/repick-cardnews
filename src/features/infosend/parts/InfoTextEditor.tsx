"use client";

import type { Dispatch } from "react";
import { FOCUS_RING } from "@/components/ui";
import { TIP_MAX, TITLE_MAX, SUBTITLE_MAX } from "../checks";
import type { InfoAction, InfoState } from "../reducer";

/**
 * 글 편집(제목·부제·팁) — **왼쪽 칸에서 항목과 나란히 선다.**
 *
 * 예전엔 툴바 탭이었는데, 부제·팁이 여러 줄 칸이 되면서 항목 목록과 함께 한자리에서 보는 게
 * 낫다는 판단이다. 카드 옆 툴바에는 짧은 조작(테마·맞춤)만 남는다.
 */

/** 글자수와 함께 보여 주는 한 줄 입력. 넘치면 검정 채움으로 뒤집는다(카드뉴스 Counter 와 같다). */
function TextField({
  label,
  value,
  max,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (v: string) => void;
  /** 주면 여러 줄 칸이 된다 — 엔터로 줄을 나눌 수 있고 카드도 그대로 그린다. */
  rows?: number;
}) {
  const over = value.length > max;
  const shared = `rounded-lg border border-hair px-3 py-2 text-[14px] transition-colors duration-200 focus:border-ink focus:outline-none ${FOCUS_RING} motion-reduce:transition-none`;
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline gap-2">
        <span className="text-[13px] font-bold text-ink-2">{label}</span>
        <span
          className={`ml-auto rounded px-1.5 text-[12px] font-bold tabular-nums ${
            over ? "bg-ink text-surface" : "text-ink-2"
          }`}
        >
          {value.length}/{max}
        </span>
      </span>
      {rows === undefined ? (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={`h-10 ${shared}`} />
      ) : (
        <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className={`resize-y ${shared}`} />
      )}
    </label>
  );
}

export function InfoTextEditor({ state, dispatch }: { state: InfoState; dispatch: Dispatch<InfoAction> }) {
  const spec = state.spec;
  if (!spec) return null;

  return (
          <div className="flex w-full flex-col gap-3">
            <TextField
              label="제목"
              value={spec.title}
              max={TITLE_MAX}
              onChange={(title) => dispatch({ type: "UPDATE_SPEC", patch: { title } })}
            />
            <TextField
              rows={2}
              label="부제"
              value={spec.subtitle ?? ""}
              max={SUBTITLE_MAX}
              onChange={(subtitle) => dispatch({ type: "UPDATE_SPEC", patch: { subtitle } })}
            />
            <TextField
              rows={3}
              label="팁"
              value={spec.tip ?? ""}
              max={TIP_MAX}
              onChange={(tip) => dispatch({ type: "UPDATE_SPEC", patch: { tip } })}
            />
          </div>
  );
}

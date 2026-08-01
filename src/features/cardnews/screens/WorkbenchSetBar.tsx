"use client";

import type { Dispatch } from "react";
import { FOCUS_RING } from "@/components/ui";
import { THEMES, THEME_IDS } from "@/templates/themes";
import type { CardnewsAction, CardnewsState } from "../reducer";

/**
 * 세트 단위 설정 — 다섯 장 전체에 걸리는 것만 여기에 둔다(테마·계정 핸들).
 *
 * 카드마다 테마가 다르면 다섯 장이 한 덩어리로 안 읽힌다. 그래서 이 결정은 카드 옆(툴바)이
 * 아니라 화면 맨 위에 따로 선다.
 *
 * 시안(`src/app/lab2/Workbench.tsx`)의 **제목 서체 그룹은 뺐다** — `CardnewsState` 에 받을
 * 필드가 없어 눌러도 저장될 곳이 없다.
 *
 * 액센트 색을 쓰지 않는다. 고른 테마는 검정 채움(`bg-ink text-surface`)으로만 표시한다.
 */
export function WorkbenchSetBar({
  themeId,
  handle,
  dispatch,
}: {
  themeId: CardnewsState["themeId"];
  handle: string;
  dispatch: Dispatch<CardnewsAction>;
}) {
  return (
    <section className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-xl border border-hair px-5 py-4">
      <div className="flex flex-col gap-2">
        <p id="theme-label" className="text-[14px] font-bold text-ink-2">
          테마
        </p>
        <div className="inline-flex rounded-lg border border-hair p-1" role="group" aria-labelledby="theme-label">
          {THEME_IDS.map((id) => {
            const on = id === themeId;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => dispatch({ type: "SET_THEME", themeId: id })}
                className={`h-10 rounded px-3.5 text-[14px] font-bold leading-10 transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
                  on ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"
                }`}
              >
                {THEMES[id].label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-w-[180px] flex-1 flex-col gap-2">
        <label htmlFor="handle" className="text-[14px] font-bold text-ink-2">
          계정 핸들
        </label>
        <input
          id="handle"
          value={handle}
          onChange={(e) => dispatch({ type: "SET_HANDLE", handle: e.target.value })}
          maxLength={30}
          placeholder="@repick.kr"
          className={`h-10 w-full rounded-lg border border-hair px-3 text-[15px] transition-colors duration-200 placeholder:text-ink-3 focus:border-ink focus:outline-none ${FOCUS_RING} motion-reduce:transition-none`}
        />
      </div>
    </section>
  );
}

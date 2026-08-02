"use client";

import type { Dispatch } from "react";
import { FOCUS_RING } from "@/components/ui";
import { THEMES, THEME_IDS } from "@/templates/themes";
import type { CardnewsAction, CardnewsState } from "../reducer";

/**
 * 세트 단위 설정 — 다섯 장 전체에 걸리는 것만 여기에 둔다(테마·계정 핸들).
 *
 * 카드마다 테마가 다르면 다섯 장이 한 덩어리로 안 읽힌다. 그래서 이 결정은 카드 옆(툴바)이
 * 아니라 **결과 칸(오른쪽) 맨 위**에 따로 선다 — 고르는 즉시 카드에 반영되는 걸 바로 봐야
 * 한다. 예전에는 화면 전체 폭을 차지하는 띠였다. 지금은 순서 레일이 세로로 서며 왼쪽이 좁아진
 * 만큼, 이 바도 결과 칸 폭에 맞춰 슬림한 한 줄로 줄였다 — 아래 `border-b` 가 옛 전체 폭 띠가
 * 하던 "여기까지가 세트 설정" 구분을 대신한다.
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
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-hair pb-4">
      <div className="flex items-center gap-2.5">
        <p id="theme-label" className="text-[13px] font-bold text-ink-2">
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
                className={`h-8 rounded px-3 text-[13px] font-bold leading-8 transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
                  on ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"
                }`}
              >
                {THEMES[id].label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-w-[220px] flex-1 items-center gap-2.5">
        <label htmlFor="handle" className="flex-none text-[13px] font-bold text-ink-2">
          계정 핸들
        </label>
        <input
          id="handle"
          value={handle}
          onChange={(e) => dispatch({ type: "SET_HANDLE", handle: e.target.value })}
          maxLength={30}
          placeholder="@repick.kr"
          className={`h-8 min-w-0 flex-1 rounded-lg border border-hair px-3 text-[14px] transition-colors duration-200 placeholder:text-ink-3 focus:border-ink focus:outline-none ${FOCUS_RING} motion-reduce:transition-none`}
        />
      </div>
    </div>
  );
}

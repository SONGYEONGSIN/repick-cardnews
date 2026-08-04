"use client";

import { useState, type Dispatch } from "react";
import { FOCUS_RING } from "@/components/ui";
import { THEMES, THEME_IDS, type ThemeId } from "@/templates/themes";
import { FIT_RANGE, type Fit } from "@/templates/fit";
import { type InfoAction, type InfoState } from "../reducer";

/**
 * 정보전달 툴바 — 위는 **머리줄**(안내 + 그 탭의 동작), 아래는 조작이다.
 *
 * **항목 편집은 여기 없다** — 세로로 긴 목록이라 카드 옆의 얕은 툴바에 넣으면 그 안에서만
 * 스크롤이 생긴다. 왼쪽 칸의 `InfoItemsEditor` 로 뗐다. 여기 남은 것은 짧은 조작뿐이다.
 *
 * 카드뉴스 `EditToolbar` 도 **같은 골격**이다 — 실사용에서 "안내가 아래 있으면 다 만지고
 * 나서야 읽는다"는 지적을 받아 둘 다 뒤집었다. 어느 형식을 만들든 같은 자리를 본다.
 *
 * 테마는 카드 하나가 아니라 **결과물 전체**에 걸리므로 자기 탭을 갖는다 — 카드뉴스에서
 * '카드' 탭 안에 넣었다가 "카드 하나 설정"으로 읽혀 되돌린 것과 같은 이유다.
 */

type Target = "photo" | "fit" | "theme";

const TABS: readonly { id: Target; label: string }[] = [
  // 테마가 맨 앞이다 — 카드 **전체**에 걸리는 값이라 먼저 정하고 나서 글을 고친다.
  { id: "theme", label: "테마" },
  { id: "photo", label: "사진" },
  { id: "fit", label: "맞춤" },
];

function Group({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center rounded-lg border border-hair p-1">{children}</span>;
}

function Opt({
  label,
  on,
  onClick,
  swatch,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  swatch?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded px-3 text-[14px] font-bold transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
        on ? "bg-ink text-surface" : "text-ink-2 hover:bg-hair-soft hover:text-ink"
      }`}
    >
      {swatch}
      {label}
    </button>
  );
}

function Btn({
  children,
  onClick,
  disabled = false,
  compact = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** 탭 줄에 얹을 때 — 탭(h-9)과 높이를 맞춘다. */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex ${compact ? "h-9" : "h-11"} items-center gap-2 rounded-lg border border-hair px-3.5 text-[14px] font-bold text-ink-2 transition-colors duration-200 hover:border-ink hover:bg-hair-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hair disabled:hover:bg-transparent disabled:hover:text-ink-2 ${FOCUS_RING} motion-reduce:transition-none`}
    >
      {children}
    </button>
  );
}

/** 테마 견본 — 색 자체가 고르는 대상이라 예외로 색을 쓴다(`docs/ui-standards.md` §7). */
function ThemeSwatch({ themeId }: { themeId: ThemeId }) {
  const t = THEMES[themeId];
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 flex-none rounded-full"
      style={{ background: t.bg, boxShadow: `inset 0 0 0 3px ${t.accent}, inset 0 0 0 4px ${t.fg}` }}
    />
  );
}


function Dial({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2.5">
      <span className="flex-none text-[14px] text-ink-2">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-1 w-[104px] flex-none accent-ink ${FOCUS_RING}`}
      />
      <span className="w-10 flex-none text-right text-[13px] tabular-nums text-ink-2">{value}%</span>
    </label>
  );
}

/** 배수(0.8~1.2 같은 값)를 백분율 눈금으로 다룬다 — 사람이 읽는 단위는 %다. */
function FitDial({
  label,
  value,
  range,
  onChange,
}: {
  label: string;
  value: number;
  range: { min: number; max: number };
  onChange: (v: number) => void;
}) {
  return (
    <Dial
      label={label}
      value={Math.round(value * 100)}
      min={Math.round(range.min * 100)}
      max={Math.round(range.max * 100)}
      onChange={(v) => onChange(v / 100)}
    />
  );
}

export function InfoToolbar({
  state,
  dispatch,
  hasPhoto,
}: {
  state: InfoState;
  dispatch: Dispatch<InfoAction>;
  hasPhoto: boolean;
}) {
  const [target, setTarget] = useState<Target>("theme");
  const spec = state.spec;
  if (!spec) return null;



  // 사진이 없으면 사진 탭이 할 일이 없다 — 없는 탭을 띄우지 않는다(카드뉴스와 같은 규칙).
  const tabs = TABS.filter((t) => t.id !== "photo" || hasPhoto);
  const active: Target = tabs.some((t) => t.id === target) ? target : "theme";

  function hintFor(t: Target): string {
    if (t === "photo") return "사진 높이와 초점을 정해요 · 사진을 빼면 제목이 테마 색 띠로 그려져요";
    if (t === "fit") return "좁은 카드에 많이 담으려면 줄이고, 시원하게 보이려면 키워요";
    if (t === "theme") return "바탕·글자·강조색과 제목 글꼴을 한 번에 바꿔요";
    return "바탕·글자·강조색과 제목 글꼴을 한 번에 바꿔요";
  }

  return (
    <div className="flex flex-col rounded-xl border border-hair">
      <div className="flex items-center gap-2 border-b border-hair p-2">
        {/* 되돌리기는 탭이 아니다 — tablist 밖에 둔다(스크린리더가 탭으로 읽지 않게). */}
        <div className="flex gap-1" role="tablist" aria-label="고칠 요소">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setTarget(t.id)}
            className={`h-9 rounded-lg px-3.5 text-[14px] font-bold transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
              active === t.id ? "bg-ink text-surface" : "text-ink-2 hover:bg-hair-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
        </div>
      </div>

      {/* 머리줄(안내 + 그 탭의 동작)이 위, 조작이 아래 — 어느 탭을 눌러도 같은 자리를 본다.
          안내가 아래 있으면 다 만지고 나서야 읽게 된다. */}
      <div role="tabpanel" className="flex flex-col gap-2.5 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] leading-relaxed text-ink-2">{hintFor(active)}</p>
          {active === "fit" && (
            <Btn compact onClick={() => dispatch({ type: "SET_FIT", patch: { text: 1, gap: 1, pad: 1 } })}>
              기본으로
            </Btn>
          )}
        </div>
        <div className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-2">


          {active === "photo" && (
            <>
              <Dial
                label="사진 높이"
                value={Math.round(state.band * 100)}
                min={30}
                max={70}
                onChange={(v) => dispatch({ type: "SET_BAND", band: v / 100 })}
              />
              <Dial
                label="가로 초점"
                value={Math.round(state.focal.x * 100)}
                min={0}
                max={100}
                onChange={(v) => dispatch({ type: "SET_FOCAL", focal: { ...state.focal, x: v / 100 } })}
              />
              <Dial
                label="세로 초점"
                value={Math.round(state.focal.y * 100)}
                min={0}
                max={100}
                onChange={(v) => dispatch({ type: "SET_FOCAL", focal: { ...state.focal, y: v / 100 } })}
              />
            </>
          )}

          {active === "fit" && (
            <>
              {/* 손잡이 셋을 한 덩어리로 묶고 '기본으로' 는 오른쪽 끝으로 민다 — 그냥 두면
                  네 번째 손잡이처럼 줄에 끼어 보인다. 되돌리기는 종류가 다른 동작이다. */}
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <FitDial
                  label="글자 크기"
                  value={state.fit.text}
                  range={FIT_RANGE.text}
                  onChange={(text) => dispatch({ type: "SET_FIT", patch: { text } })}
                />
                <FitDial
                  label="항목 간격"
                  value={state.fit.gap}
                  range={FIT_RANGE.gap}
                  onChange={(gap) => dispatch({ type: "SET_FIT", patch: { gap } })}
                />
                <FitDial
                  label="위아래 여백"
                  value={state.fit.pad}
                  range={FIT_RANGE.pad}
                  onChange={(pad) => dispatch({ type: "SET_FIT", patch: { pad } })}
                />
              </span>
            </>
          )}

          {active === "theme" && (
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-[14px] text-ink-2">
                이 카드 <span className="font-bold text-ink">전체</span>에 적용
              </span>
              <Group>
                {THEME_IDS.map((id) => (
                  <Opt
                    key={id}
                    label={THEMES[id].label}
                    on={id === state.themeId}
                    onClick={() => dispatch({ type: "SET_THEME", themeId: id })}
                    swatch={<ThemeSwatch themeId={id} />}
                  />
                ))}
              </Group>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

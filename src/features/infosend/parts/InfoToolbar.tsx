"use client";

import { useState, type Dispatch } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FOCUS_RING } from "@/components/ui";
import { SortableItem } from "./SortableItem";
import { THEMES, THEME_IDS, type ThemeId } from "@/templates/themes";
import { FIT_RANGE, type Fit } from "@/templates/fit";
import { TIP_MAX, TITLE_MAX, SUBTITLE_MAX } from "../checks";
import { ITEMS_MAX, ITEMS_MIN, type InfoAction, type InfoState } from "../reducer";

/**
 * 정보전달 툴바 — 카드뉴스 `EditToolbar` 와 **같은 골격**이다: 위는 조작, 아래는 안내.
 * 어느 형식을 만들든 같은 자리를 보게 한다(`docs/ui-standards.md` §1).
 *
 * 테마는 카드 하나가 아니라 **결과물 전체**에 걸리므로 자기 탭을 갖는다 — 카드뉴스에서
 * '카드' 탭 안에 넣었다가 "카드 하나 설정"으로 읽혀 되돌린 것과 같은 이유다.
 */

type Target = "text" | "items" | "photo" | "fit" | "theme";

const TABS: readonly { id: Target; label: string }[] = [
  { id: "text", label: "글" },
  { id: "items", label: "항목" },
  { id: "photo", label: "사진" },
  { id: "fit", label: "맞춤" },
  { id: "theme", label: "테마" },
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

function Btn({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-lg border border-hair px-3.5 text-[14px] font-bold text-ink-2 transition-colors duration-200 hover:border-ink hover:bg-hair-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hair disabled:hover:bg-transparent disabled:hover:text-ink-2 ${FOCUS_RING} motion-reduce:transition-none`}
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

/** 글자수와 함께 보여 주는 한 줄 입력. 넘치면 검정 채움으로 뒤집는다(카드뉴스 Counter 와 같다). */
function TextField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (v: string) => void;
}) {
  const over = value.length > max;
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
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 rounded-lg border border-hair px-3 text-[14px] transition-colors duration-200 focus:border-ink focus:outline-none ${FOCUS_RING} motion-reduce:transition-none`}
      />
    </label>
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
  const [target, setTarget] = useState<Target>("text");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const spec = state.spec;
  if (!spec) return null;

  const itemIds = spec.items.map((_, i) => `item-${i}`);

  function onDragEnd(event: DragEndEvent) {
    const { active: from, over } = event;
    if (!over || from.id === over.id) return;
    dispatch({
      type: "REORDER_ITEM",
      from: itemIds.indexOf(String(from.id)),
      to: itemIds.indexOf(String(over.id)),
    });
  }

  // 사진이 없으면 사진 탭이 할 일이 없다 — 없는 탭을 띄우지 않는다(카드뉴스와 같은 규칙).
  const tabs = TABS.filter((t) => t.id !== "photo" || hasPhoto);
  const active: Target = tabs.some((t) => t.id === target) ? target : "text";

  function hintFor(t: Target): string {
    if (t === "items") return `항목은 ${ITEMS_MIN}~${ITEMS_MAX}개예요. 순서는 아래 목록에서 끌어 바꿔요`;
    if (t === "photo") return "사진 높이와 초점을 정해요 · 사진을 빼면 제목이 테마 색 띠로 그려져요";
    if (t === "fit") return "좁은 카드에 많이 담으려면 줄이고, 시원하게 보이려면 키워요";
    if (t === "theme") return "바탕·글자·강조색과 제목 글꼴을 한 번에 바꿔요";
    return "제목·부제·팁을 고쳐요";
  }

  return (
    <div className="flex flex-col rounded-xl border border-hair">
      <div className="flex gap-1 border-b border-hair p-2" role="tablist" aria-label="고칠 요소">
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

      {/* 위는 조작, 아래는 안내 — 어느 탭을 눌러도 같은 자리를 본다. */}
      <div role="tabpanel" className="flex flex-col gap-1.5 px-3 py-2.5">
        <div className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-2">
          {active === "text" && (
            <div className="flex w-full flex-col gap-3">
              <TextField
                label="제목"
                value={spec.title}
                max={TITLE_MAX}
                onChange={(title) => dispatch({ type: "UPDATE_SPEC", patch: { title } })}
              />
              <TextField
                label="부제"
                value={spec.subtitle ?? ""}
                max={SUBTITLE_MAX}
                onChange={(subtitle) => dispatch({ type: "UPDATE_SPEC", patch: { subtitle } })}
              />
              <TextField
                label="팁"
                value={spec.tip ?? ""}
                max={TIP_MAX}
                onChange={(tip) => dispatch({ type: "UPDATE_SPEC", patch: { tip } })}
              />
            </div>
          )}

          {active === "items" && (
            <div className="flex w-full flex-col gap-3">
              <span className="flex items-center gap-2.5">
                <span className="text-[14px] text-ink-2">
                  항목 <span className="font-bold tabular-nums text-ink">{spec.items.length}</span>/{ITEMS_MAX}
                </span>
                <Btn disabled={spec.items.length >= ITEMS_MAX} onClick={() => dispatch({ type: "ADD_ITEM" })}>
                  항목 추가
                </Btn>
              </span>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                  <ul className="flex flex-col gap-2">
                    {spec.items.map((item, i) => (
                      <SortableItem
                        key={itemIds[i]}
                        id={itemIds[i]}
                        index={i}
                        keyword={item.keyword}
                        desc={item.desc}
                        canRemove={spec.items.length > ITEMS_MIN}
                        onPatch={(patch) => dispatch({ type: "UPDATE_ITEM", index: i, patch })}
                        onRemove={() => dispatch({ type: "REMOVE_ITEM", index: i })}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          )}

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
              <span className="ml-auto">
                <Btn onClick={() => dispatch({ type: "SET_FIT", patch: { text: 1, gap: 1, pad: 1 } })}>기본으로</Btn>
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
        <p className="text-[13px] leading-relaxed text-ink-2">{hintFor(active)}</p>
      </div>
    </div>
  );
}

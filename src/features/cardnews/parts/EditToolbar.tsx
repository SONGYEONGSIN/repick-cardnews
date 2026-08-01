"use client";

import { Image as ImageIcon } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { CARD_LAYOUTS, LAYOUT_LABELS } from "@/lib/layout-assign";
import type { CardDraft } from "../reducer";

/**
 * 툴바 — 만들기 화면의 유일한 컨트롤 표면.
 *
 * 옆 패널(`CardInspector`)을 없애고 전부 여기로 올렸다. 그래서 캔버스가 전체 폭을 쓴다 —
 * 사진을 고치는 도구에서 가장 넓어야 할 것은 사진이다.
 *
 * 왼쪽 **요소 선택기**(헤드라인·본문·사진·카드)가 축이다. 무엇을 고르느냐에 따라 그 옆이
 * 통째로 바뀐다. 캔버스를 눌러도 같이 바뀐다 — 두 입구가 같은 상태를 가리킨다.
 *
 * 시안(`src/app/lab2/Editor.tsx`)에는 있었지만 여기서 **뺀 것**: 글자 크기·정렬·글 위치·
 * 사진 배율·형광·역할 배지·다시 쓰기·빼기. `CardDraft` 가 받지 않는 값이라 조작해도
 * 저장될 곳이 없다 — 눌리는데 아무 일도 안 나는 버튼을 두지 않는다.
 *
 * 액센트 색을 쓰지 않는다. 선택 상태는 검정 채움(`bg-ink text-surface`)과 굵기로만 만든다.
 */

export type EditTarget = "heading" | "body" | "photo" | "card";

function Group({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center rounded-lg border border-hair p-1">{children}</span>;
}

function Opt({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-9 rounded px-3 text-[14px] font-bold leading-9 transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
        on ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function Btn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-lg border border-hair px-3.5 text-[14px] font-bold text-ink-2 transition-colors duration-200 hover:border-ink hover:text-ink ${FOCUS_RING} motion-reduce:transition-none`}
    >
      {children}
    </button>
  );
}

/**
 * 0~100 슬라이더. `min`/`max` 는 옛 `CardInspector` 가 쓰던 폭을 그대로 가져왔다 —
 * 글 배경 30 미만은 사진 위 글이 안 읽히고, 사진 높이 70 초과는 글 자리가 남지 않는다.
 */
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

/** 글자수. 넘치면 액센트 색 대신 검정 채움으로 뒤집는다 — 이 화면의 강조 수단은 그것뿐이다. */
function Counter({ len, max }: { len: number; max: number }) {
  const over = len > max;
  return (
    <span
      className={`ml-auto rounded px-2 py-0.5 text-[13px] font-bold tabular-nums ${
        over ? "bg-ink text-surface" : "text-ink-2"
      }`}
    >
      {len}/{max}
    </span>
  );
}

function Divider() {
  return <span className="h-7 w-px flex-none bg-hair" aria-hidden="true" />;
}

export function EditToolbar({
  card,
  target,
  onSelect,
  onPatch,
  onSwapPhoto,
}: {
  card: CardDraft;
  target: EditTarget;
  onSelect: (t: EditTarget) => void;
  onPatch: (patch: Partial<Omit<CardDraft, "id">>) => void;
  onSwapPhoto: () => void;
}) {
  const copy = card.copy;
  // hook·cta 에는 본문이 없다. 없는 카드에서는 본문 탭 자체를 띄우지 않는다.
  const body = "body" in copy ? copy.body : undefined;
  const hasPhoto = card.layout !== "text-only";

  const picks: { id: EditTarget; label: string; show: boolean }[] = [
    { id: "heading", label: "헤드라인", show: true },
    { id: "body", label: "본문", show: body !== undefined },
    { id: "photo", label: "사진", show: hasPhoto },
    { id: "card", label: "카드", show: true },
  ];
  const tabs = picks.filter((p) => p.show);

  // 카드를 넘기면 지금 카드에 없는 요소를 가리키고 있을 수 있다(problem 에서 "본문"을 고른 뒤
  // cta 로 이동, text-only 에서 "사진"). 그대로 두면 어느 탭도 선택 표시가 안 되고 패널이
  // 엉뚱하게 비므로, **렌더 중에 순수 계산으로** 항상 있는 "카드"로 떨어뜨린다.
  // effect 로 부모 상태를 고치지 않는다 — 한 프레임 어긋난 화면이 먼저 보이고 렌더가 두 번 돈다.
  const active: EditTarget = tabs.some((p) => p.id === target) ? target : "card";

  const isText = active === "heading" || active === "body";
  const len = active === "body" ? (body?.length ?? 0) : copy.heading.length;
  const max = active === "body" ? 120 : 40;

  return (
    <div className="flex flex-col rounded-xl border border-hair">
      {/* 무엇을 고칠지 고르는 줄. 컨트롤은 바로 아래에 붙는다 — 한 줄에 다 밀어 넣으면
          좁은 폭에서 줄바꿈이 지저분해지고, 고른 것과 그 도구의 관계도 흐려진다. */}
      <div className="flex gap-1 border-b border-hair p-2" role="tablist" aria-label="고칠 요소">
        {tabs.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active === p.id}
            onClick={() => onSelect(p.id)}
            className={`h-10 rounded-lg px-4 text-[14px] font-bold transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
              active === p.id ? "bg-ink text-surface" : "text-ink-2 hover:bg-hair-soft hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="flex min-h-[64px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        {isText && (
          <>
            <span className="text-[14px] text-ink-2">카드에서 글자를 직접 눌러 고쳐요</span>
            <Counter len={len} max={max} />
          </>
        )}

        {active === "photo" && (
          <>
            <span className="text-[14px] text-ink-2">사진 위를 끌어 초점을 옮겨요</span>
            <Divider />
            {card.layout === "full-bleed" && (
              <Dial
                label="글 배경"
                value={Math.round(card.scrim * 100)}
                min={30}
                max={95}
                onChange={(v) => onPatch({ scrim: v / 100 })}
              />
            )}
            {card.layout === "split" && (
              <Dial
                label="사진 높이"
                value={Math.round(card.band * 100)}
                min={30}
                max={70}
                onChange={(v) => onPatch({ band: v / 100 })}
              />
            )}
            <span className="ml-auto">
              <Btn onClick={onSwapPhoto}>
                <ImageIcon size={15} aria-hidden="true" />
                사진 바꾸기
              </Btn>
            </span>
          </>
        )}

        {active === "card" && (
          <span className="flex items-center gap-2.5">
            <span className="text-[14px] text-ink-2">구성</span>
            <Group>
              {CARD_LAYOUTS.map((l) => (
                <Opt
                  key={l}
                  label={LAYOUT_LABELS[l]}
                  on={l === card.layout}
                  onClick={() => onPatch({ layout: l })}
                />
              ))}
            </Group>
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import { GripVertical, Image as ImageIcon } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { LAYOUT_LABEL, TONE_CLASS, type SampleCard } from "./data";

/** 세 시안이 공유하는 조각들 — 배치만 다르고 내용물은 같아야 비교가 성립한다. */

export function CardPreview({ card, size }: { card: SampleCard; size: "sm" | "lg" }) {
  const lg = size === "lg";

  return (
    <div
      className={`flex aspect-[4/5] w-full flex-col overflow-hidden rounded-xl border border-hair bg-surface ${
        lg ? "shadow-sm" : ""
      }`}
    >
      {card.layout === "full-bleed" && (
        <span className={`relative flex flex-1 flex-col justify-end ${TONE_CLASS[card.tone]}`}>
          <span className="flex flex-col gap-1.5 bg-surface/85 p-3">
            <span className={`font-extrabold leading-tight tracking-tight ${lg ? "text-[22px]" : "text-[11px]"}`}>
              {card.heading}
            </span>
            {card.action && (
              <span
                className={`self-start rounded-full bg-plum px-3 py-1 font-semibold text-white ${
                  lg ? "text-sm" : "text-[9px]"
                }`}
              >
                {card.action}
              </span>
            )}
          </span>
        </span>
      )}

      {card.layout === "split" && (
        <>
          <span className={`block h-[42%] w-full ${TONE_CLASS[card.tone]}`} />
          <span className="flex flex-1 flex-col gap-1.5 p-3">
            <span className={`font-extrabold leading-tight tracking-tight ${lg ? "text-[20px]" : "text-[11px]"}`}>
              {card.heading}
            </span>
            {card.body && (
              <span className={`leading-relaxed text-ink-2 ${lg ? "text-[13px]" : "text-[8px]"}`}>{card.body}</span>
            )}
          </span>
        </>
      )}

      {card.layout === "text-only" && (
        <span className="flex flex-1 flex-col justify-center gap-2 p-4">
          <span className={`font-extrabold leading-tight tracking-tight ${lg ? "text-[24px]" : "text-[12px]"}`}>
            {card.heading}
          </span>
          {card.body && (
            <span className={`leading-relaxed text-ink-2 ${lg ? "text-[13px]" : "text-[8px]"}`}>{card.body}</span>
          )}
        </span>
      )}
    </div>
  );
}

export function SlotChip({
  card,
  index,
  selected,
  onSelect,
  orientation = "vertical",
}: {
  card: SampleCard;
  index: number;
  selected: boolean;
  onSelect: () => void;
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex ${
        orientation === "vertical" ? "w-full items-center gap-2.5" : "w-[104px] flex-none flex-col gap-1.5"
      } rounded-lg border p-2 text-left transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
        selected ? "border-plum bg-plum-soft" : "border-hair bg-surface hover:border-ink-3"
      }`}
    >
      <span
        className={`relative flex-none overflow-hidden rounded ${TONE_CLASS[card.tone]} ${
          orientation === "vertical" ? "h-11 w-9" : "aspect-[4/5] w-full"
        }`}
      >
        <span className="absolute left-1 top-1 rounded bg-surface px-1 text-[10px] font-semibold tabular-nums">
          {index + 1}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className={`text-[11px] font-semibold ${selected ? "text-plum" : "text-ink-2"}`}>
            {card.roleLabel}
          </span>
          <span className="rounded bg-hair-soft px-1 text-[10px] text-ink-2">{LAYOUT_LABEL[card.layout]}</span>
        </span>
        <span className="truncate text-[11px] text-ink-2">{card.heading}</span>
      </span>
      {orientation === "vertical" && (
        <GripVertical size={13} aria-hidden="true" className="flex-none text-ink-3" />
      )}
    </button>
  );
}

export function PhotoChip({ name, tone }: { name: string; tone: SampleCard["tone"] }) {
  return (
    <div className="flex w-[76px] flex-none flex-col gap-1">
      <div className={`aspect-[4/5] w-full rounded border border-hair ${TONE_CLASS[tone]}`} />
      <p className="truncate text-[10px] text-ink-2">{name}</p>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-hair bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

/** 인스펙터 — 실제 CardInspector 가 가진 컨트롤을 같은 구성으로 옮겼다. */
export function Inspector({ card, compact = false }: { card: SampleCard; compact?: boolean }) {
  return (
    <div className={`flex flex-col ${compact ? "gap-3" : "gap-4"}`}>
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold text-ink-2">레이아웃</p>
        <div className="inline-flex rounded-lg border border-hair bg-surface p-1">
          {(["full-bleed", "split", "text-only"] as const).map((l) => (
            <span
              key={l}
              className={`h-9 rounded-md px-3 text-sm font-semibold leading-9 ${
                l === card.layout ? "bg-plum text-white" : "text-ink-2"
              }`}
            >
              {LAYOUT_LABEL[l]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-ink-2">헤드라인</p>
          <span className="text-[11px] tabular-nums text-ink-3">{card.heading.length}/40</span>
        </div>
        <textarea readOnly rows={2} value={card.heading} className={INPUT} aria-label="헤드라인" />
      </div>

      {card.body !== undefined && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-ink-2">본문</p>
            <span className="text-[11px] tabular-nums text-ink-3">{card.body.length}/120</span>
          </div>
          <textarea readOnly rows={compact ? 3 : 4} value={card.body} className={INPUT} aria-label="본문" />
        </div>
      )}

      {card.action !== undefined && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-ink-2">버튼 문구</p>
            <span className="text-[11px] tabular-nums text-ink-3">{card.action.length}/40</span>
          </div>
          <input readOnly value={card.action} className={INPUT} aria-label="버튼 문구" />
        </div>
      )}

      {card.layout !== "text-only" && (
        <div className="flex flex-col gap-3 border-t border-hair-soft pt-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-2">
            <ImageIcon size={13} aria-hidden="true" />
            사진 조절
          </div>
          <Slider label="가로 초점" value={50} />
          <Slider label="세로 초점" value={40} />
          {card.layout === "full-bleed" && <Slider label="글 배경 진하기" value={70} />}
          {card.layout === "split" && <Slider label="사진 높이" value={42} />}
        </div>
      )}
    </div>
  );
}

function Slider({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[76px] flex-none text-[13px] text-ink-2">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        defaultValue={value}
        aria-label={label}
        className={`h-1 w-full accent-plum ${FOCUS_RING}`}
      />
      <span className="w-8 flex-none text-right text-[11px] tabular-nums text-ink-2">{value}</span>
    </div>
  );
}

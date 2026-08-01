"use client";

import { Move } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { TONE_CLASS, type SampleCard } from "../lab/wb/data";
import type { Target } from "./Editor";

/**
 * 캔버스 — 카드 자체가 편집 표면이다.
 *
 * 글은 별도 입력칸이 아니라 **여기서 직접** 고친다(선택하면 그 자리가 편집 가능해진다).
 * 사진을 고르면 초점 핸들이 뜨고 끌어서 옮긴다 — 가로·세로 슬라이더 두 개가 사라진다.
 *
 * 겹치는 영역을 각각 고르게 하려면 버튼을 중첩할 수 없다(HTML 규칙). 그래서 사진은 절대배치
 * 버튼으로 뒤에 깔고, 글 블록은 그 위에 `pointer-events` 를 되살린 층으로 얹는다.
 */

function ring(on: boolean) {
  return on ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "";
}

function EditableText({
  value,
  target,
  current,
  onSelect,
  label,
  className,
  cardId,
}: {
  value: string;
  target: Target;
  current: Target;
  onSelect: (t: Target) => void;
  label: string;
  className: string;
  cardId: string;
}) {
  const on = current === target;
  return (
    <div
      // 카드가 바뀌면 새로 마운트한다 — contentEditable 은 값이 DOM 에 남아 갱신되지 않는다
      key={`${cardId}-${target}`}
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      tabIndex={0}
      contentEditable={on}
      suppressContentEditableWarning
      onClick={() => onSelect(target)}
      onFocus={() => onSelect(target)}
      className={`pointer-events-auto cursor-text rounded outline-none ${ring(on)} ${className}`}
    >
      {value}
    </div>
  );
}

function PhotoSurface({
  card,
  current,
  onSelect,
  className,
}: {
  card: SampleCard;
  current: Target;
  onSelect: (t: Target) => void;
  className: string;
}) {
  const on = current === "photo";
  return (
    <button
      type="button"
      aria-label="사진 — 눌러 고르고 끌어서 초점을 옮겨요"
      aria-pressed={on}
      onClick={() => onSelect("photo")}
      className={`${className} ${TONE_CLASS[card.tone]} ${FOCUS_RING} ${on ? "cursor-move" : "cursor-pointer"}`}
    >
      {on && (
        <span className="pointer-events-none absolute left-1/2 top-[40%] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-surface">
          <Move size={17} aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

export function Canvas({
  card,
  target,
  onSelect,
}: {
  card: SampleCard;
  target: Target;
  onSelect: (t: Target) => void;
}) {
  const headingClass = "text-[24px] font-black leading-tight tracking-tight sm:text-[32px]";
  const bodyClass = "text-[15px] leading-relaxed text-ink-2 sm:text-[17px]";

  return (
    <div className="relative flex aspect-[4/5] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-hair bg-surface">
      {card.layout === "full-bleed" && (
        <>
          <PhotoSurface card={card} current={target} onSelect={onSelect} className="absolute inset-0" />
          <div className="pointer-events-none relative mt-auto flex flex-col gap-3 bg-surface/85 p-7">
            <EditableText
              cardId={card.id}
              value={card.heading}
              target="heading"
              current={target}
              onSelect={onSelect}
              label="헤드라인"
              className={headingClass}
            />
            {card.action && (
              <span className="self-start rounded-full bg-ink px-4 py-2 text-[15px] font-bold text-surface">
                {card.action}
              </span>
            )}
          </div>
        </>
      )}

      {card.layout === "split" && (
        <>
          <PhotoSurface card={card} current={target} onSelect={onSelect} className="relative block h-[42%] w-full" />
          <div className="pointer-events-none flex flex-1 flex-col gap-3 p-7">
            <EditableText
              cardId={card.id}
              value={card.heading}
              target="heading"
              current={target}
              onSelect={onSelect}
              label="헤드라인"
              className={headingClass}
            />
            {card.body && (
              <EditableText
                cardId={card.id}
                value={card.body}
                target="body"
                current={target}
                onSelect={onSelect}
                label="본문"
                className={bodyClass}
              />
            )}
          </div>
        </>
      )}

      {card.layout === "text-only" && (
        <div className="pointer-events-none flex flex-1 flex-col justify-center gap-3 p-7">
          <EditableText
            cardId={card.id}
            value={card.heading}
            target="heading"
            current={target}
            onSelect={onSelect}
            label="헤드라인"
            className={headingClass}
          />
          {card.body && (
            <EditableText
              cardId={card.id}
              value={card.body}
              target="body"
              current={target}
              onSelect={onSelect}
              label="본문"
              className={bodyClass}
            />
          )}
        </div>
      )}
    </div>
  );
}

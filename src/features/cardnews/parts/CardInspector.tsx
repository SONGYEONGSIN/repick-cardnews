"use client";

import { Field, SegmentedControl } from "@/components/ui";
import { CARD_LAYOUTS, LAYOUT_LABELS, type CardLayout } from "@/lib/layout-assign";
import type { CardDraft } from "../reducer";

const INPUT =
  "w-full rounded-lg border border-hair bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={`tabular-nums text-[11px] ${value.length > max ? "text-danger" : "text-ink-3"}`}>
      {value.length}/{max}
    </span>
  );
}

export function CardInspector({
  card,
  index,
  onPatch,
}: {
  card: CardDraft;
  index: number;
  onPatch: (patch: Partial<Omit<CardDraft, "id">>) => void;
}) {
  const copy = card.copy;
  const heading = copy.heading;
  const body = "body" in copy ? copy.body : "";

  return (
    <div className="flex flex-col gap-5">
      <Field label="레이아웃" htmlFor={`layout-${index}`}>
        <div id={`layout-${index}`}>
          <SegmentedControl<CardLayout>
            ariaLabel="카드 레이아웃"
            options={CARD_LAYOUTS.map((id) => ({ value: id, label: LAYOUT_LABELS[id] }))}
            value={card.layout}
            onChange={(layout) => onPatch({ layout })}
          />
        </div>
      </Field>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor={`heading-${index}`} className="text-sm font-semibold text-ink-2">
            헤드라인
          </label>
          <Counter value={heading} max={40} />
        </div>
        <textarea
          id={`heading-${index}`}
          rows={2}
          value={heading}
          onChange={(e) => onPatch({ copy: { ...copy, heading: e.target.value } as CardDraft["copy"] })}
          className={INPUT}
        />
      </div>

      {"body" in copy && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={`body-${index}`} className="text-sm font-semibold text-ink-2">
              본문
            </label>
            <Counter value={body} max={120} />
          </div>
          <textarea
            id={`body-${index}`}
            rows={4}
            value={body}
            onChange={(e) => onPatch({ copy: { ...copy, body: e.target.value } as CardDraft["copy"] })}
            className={INPUT}
          />
        </div>
      )}

      {/* cta 카드는 body 가 없고 action(버튼 문구)이 있다. 스키마가 마지막 카드를 cta 로 강제하므로
          이 편집기가 없으면 모든 세트에서 버튼 문구를 못 고친다. */}
      {copy.role === "cta" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={`action-${index}`} className="text-sm font-semibold text-ink-2">
              버튼 문구
            </label>
            <Counter value={copy.action} max={40} />
          </div>
          <input
            id={`action-${index}`}
            value={copy.action}
            onChange={(e) => onPatch({ copy: { ...copy, action: e.target.value } as CardDraft["copy"] })}
            className={INPUT}
          />
        </div>
      )}

      {card.layout !== "text-only" && (
        <>
          <Field label="사진 초점" htmlFor={`focal-${index}`} hint="사진이 4:5가 아닐 때 어디를 남길지 정해요.">
            <div className="flex flex-col gap-2">
              <input
                id={`focal-${index}`}
                type="range"
                min={0}
                max={100}
                value={Math.round(card.focal.x * 100)}
                aria-label="가로 초점"
                onChange={(e) => onPatch({ focal: { ...card.focal, x: Number(e.target.value) / 100 } })}
                className="w-full accent-plum"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(card.focal.y * 100)}
                aria-label="세로 초점"
                onChange={(e) => onPatch({ focal: { ...card.focal, y: Number(e.target.value) / 100 } })}
                className="w-full accent-plum"
              />
            </div>
          </Field>

          {card.layout === "full-bleed" && (
            <Field label="글 배경 진하기" htmlFor={`scrim-${index}`} hint="흐리면 사진이 살고, 진하면 글이 또렷해요.">
              <input
                id={`scrim-${index}`}
                type="range"
                min={30}
                max={95}
                value={Math.round(card.scrim * 100)}
                onChange={(e) => onPatch({ scrim: Number(e.target.value) / 100 })}
                className="w-full accent-plum"
              />
            </Field>
          )}

          {card.layout === "split" && (
            <Field label="사진 높이" htmlFor={`band-${index}`}>
              <input
                id={`band-${index}`}
                type="range"
                min={30}
                max={70}
                value={Math.round(card.band * 100)}
                onChange={(e) => onPatch({ band: Number(e.target.value) / 100 })}
                className="w-full accent-plum"
              />
            </Field>
          )}
        </>
      )}
    </div>
  );
}

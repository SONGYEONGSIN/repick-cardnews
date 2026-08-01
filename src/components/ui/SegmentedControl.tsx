"use client";

import { useRef, type KeyboardEvent } from "react";
import { FOCUS_RING } from "./focus";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // 선택된 항목이 없으면(값이 옵션에 없을 때) 첫 항목을 Tab 정거장으로 삼는다 —
  // 아무것도 tabIndex 0 이 아니면 그룹 전체가 키보드로 도달 불가가 된다.
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  // WAI-ARIA radiogroup: 화살표로 선택과 포커스가 함께 이동하고, Tab 정거장은 선택된 항목 하나뿐이다.
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg border border-hair bg-surface p-1">
      {options.map((opt, i) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(node) => {
              refs.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === activeIndex ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`h-9 rounded-md px-3 text-sm font-semibold transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
              on ? "bg-plum text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { Check } from "lucide-react";
import type { StepDef } from "./types";

export function StepRail({
  steps,
  current,
  maxReached,
  onSelect,
}: {
  steps: readonly StepDef[];
  current: number;
  maxReached: number;
  onSelect: (id: number) => void;
}) {
  return (
    <nav aria-label="제작 단계">
      <ol className="flex flex-col gap-1">
        {steps.map((step) => {
          const done = step.id < current;
          const active = step.id === current;
          const reachable = step.id <= maxReached;
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                onClick={() => onSelect(step.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
                  active
                    ? "bg-plum-soft font-semibold text-plum"
                    : reachable
                      ? "text-ink-2 hover:bg-hair-soft hover:text-ink"
                      : "cursor-not-allowed text-ink-3/60"
                }`}
              >
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                    active
                      ? "bg-plum text-white"
                      : done
                        ? "bg-plum/25 text-plum"
                        : "bg-hair text-ink-3"
                  }`}
                >
                  {done ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : step.id}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

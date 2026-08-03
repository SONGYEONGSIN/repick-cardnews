"use client";

import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Button, ContiMark, FOCUS_RING } from "@/components/ui";
import { StepRail } from "./StepRail";
import type { ShellFooter, StepDef } from "./types";

export function StudioShell({
  flowLabel,
  steps,
  current,
  maxReached,
  onSelectStep,
  meta,
  onReset,
  onExit,
  footer,
  children,
}: {
  flowLabel: string;
  steps: readonly StepDef[];
  current: number;
  maxReached: number;
  onSelectStep: (id: number) => void;
  meta: string;
  onReset: () => void;
  onExit: () => void;
  footer: ShellFooter;
  children: React.ReactNode;
}) {
  const currentStep = steps.find((s) => s.id === current);

  return (
    <div className="flex h-screen bg-canvas text-ink">
      <aside className="flex w-60 flex-none flex-col border-r border-hair bg-surface px-3 py-4">
        <button
          type="button"
          onClick={onExit}
          className={`mb-6 flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-200 hover:bg-hair-soft ${FOCUS_RING} motion-reduce:transition-none`}
        >
          <span className="text-plum">
            <ContiMark size={20} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-tight">콘티</span>
            <span className="block text-[11px] text-ink-2">{flowLabel}</span>
          </span>
        </button>

        <StepRail steps={steps} current={current} maxReached={maxReached} onSelect={onSelectStep} />

        <div className="mt-auto border-t border-hair-soft pt-3 text-[11px] tabular-nums text-ink-2">{meta}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center justify-between border-b border-hair bg-surface px-6">
          <h1 className="min-w-0 truncate text-[15px] font-semibold">
            <span className="mr-2 tabular-nums text-ink-3">{current}</span>
            {currentStep?.label}
          </h1>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" />
            초기화
          </Button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>

        <footer className="flex h-16 flex-none items-center justify-between gap-4 border-t border-hair bg-surface px-6">
          <p className="min-w-0 truncate text-sm text-ink-2">{footer.hint ?? ""}</p>
          <div className="flex flex-none gap-2">
            {footer.onPrev && (
              <Button variant="secondary" onClick={footer.onPrev}>
                <ArrowLeft size={15} aria-hidden="true" />
                이전
              </Button>
            )}
            {footer.onNext && (
              <Button variant="primary" onClick={footer.onNext} disabled={footer.nextDisabled}>
                {footer.nextLabel ?? "다음"}
                <ArrowRight size={15} aria-hidden="true" />
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

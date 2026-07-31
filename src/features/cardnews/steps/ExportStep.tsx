"use client";

import { useState } from "react";
import { Download, FolderDown } from "lucide-react";
import { Button, Panel } from "@/components/ui";
import { CardRenderer } from "@/templates/CardRenderer";
import { toRenderCards } from "../render";
import type { CardnewsAction, CardnewsState } from "../reducer";

export function ExportStep({
  state,
  dispatch,
  onDownload,
  onSave,
}: {
  state: CardnewsState;
  dispatch: React.Dispatch<CardnewsAction>;
  onDownload: () => Promise<void>;
  onSave: () => Promise<{ dir: string; paths: string[] }>;
}) {
  const [saved, setSaved] = useState<{ dir: string; count: number } | null>(null);
  const rendered = toRenderCards(state);

  async function run(fn: () => Promise<void>) {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      await fn();
      dispatch({ type: "SET_BUSY", busy: false });
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: e instanceof Error ? e.message : "내보내기에 실패했어요" });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
        {rendered.map((card, i) => (
          <li key={i}>
            <div className="overflow-hidden rounded-lg border border-hair">
              <span className="block aspect-[4/5] w-full overflow-hidden bg-hair-soft">
                <span className="block origin-top-left scale-[0.1296]">
                  <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
                </span>
              </span>
            </div>
            <p className="mt-1 text-center tabular-nums text-[11px] text-ink-3">{i + 1}</p>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Button variant="secondary" disabled={state.busy} onClick={() => void run(onDownload)}>
          <Download size={15} aria-hidden="true" />
          PNG 다운로드
        </Button>
        <Button
          variant="primary"
          disabled={state.busy}
          onClick={() =>
            void run(async () => {
              const res = await onSave();
              setSaved({ dir: res.dir, count: res.paths.length });
            })
          }
        >
          <FolderDown size={15} aria-hidden="true" />
          폴더에 저장
        </Button>
      </div>

      {saved && (
        <Panel className="p-4">
          <p className="text-sm">
            <span className="font-semibold">{saved.count}장</span> 저장했어요 —{" "}
            <code className="rounded bg-hair-soft px-1.5 py-0.5 font-mono text-[13px]">{saved.dir}</code>
          </p>
        </Panel>
      )}

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}

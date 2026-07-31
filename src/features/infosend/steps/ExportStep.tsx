"use client";

import { useState } from "react";
import { Download, FolderDown } from "lucide-react";
import { Button, Panel } from "@/components/ui";
import { CardRenderer } from "@/templates/CardRenderer";
import { toRenderCard } from "../render";
import type { InfoAction, InfoState } from "../reducer";

export function ExportStep({
  state,
  dispatch,
  onDownload,
  onSave,
}: {
  state: InfoState;
  dispatch: React.Dispatch<InfoAction>;
  onDownload: () => Promise<void>;
  onSave: () => Promise<{ dir: string; paths: string[] }>;
}) {
  const [saved, setSaved] = useState<{ dir: string; count: number } | null>(null);
  const card = toRenderCard(state);

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

  if (!card) return <p className="text-sm text-ink-3">먼저 카피를 생성해 주세요.</p>;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
      {/* 1080×1350 카드를 324×405 미리보기 박스에 담기 위한 고정 픽셀 크기 — Tailwind 토큰으로 표현 불가 */}
      <div className="mx-auto overflow-hidden rounded-xl border border-hair shadow-sm" style={{ width: 324, height: 405 }}>
        <div className="origin-top-left scale-30">
          <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
        </div>
      </div>

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

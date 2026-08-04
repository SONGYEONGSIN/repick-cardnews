"use client";

import { useState, type Dispatch } from "react";
import { ArrowLeft, Check, CircleAlert, Download, FolderDown, RotateCcw } from "lucide-react";
import { StudioFrame, LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { CardRenderer } from "@/templates/CardRenderer";
import { THEMES } from "@/templates/themes";
import { inKorean } from "@/features/cardnews/screens/errors";
import { toRenderCard } from "../render";
import type { InfoAction, InfoState } from "../reducer";

/**
 * 화면 3 — 내보내기.
 *
 * **지금은 파일 저장만 있다.** 폰으로 보내기·인스타그램·예약 발행은 카드뉴스 부품을 그대로
 * 쓸 수 있지만, 인스타는 **1장 게시 경로가 아직 없다**(`src/lib/instagram.ts` 는 캐러셀만
 * 다루고 Graph API 는 2장 미만 캐러셀을 거부한다). 그 경로를 만든 뒤에 함께 붙인다 —
 * **되는 척하는 버튼을 먼저 두지 않는다.**
 */
export function InfoExportScreen({
  state,
  dispatch,
  onPrev,
  onDownload,
  onSave,
}: {
  state: InfoState;
  dispatch: Dispatch<InfoAction>;
  onPrev: () => void;
  onDownload: () => Promise<void>;
  onSave: () => Promise<{ dir: string; paths: string[] }>;
}) {
  const [saved, setSaved] = useState<{ dir: string; count: number } | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const card = toRenderCard(state);

  async function run(fn: () => Promise<void>) {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      await fn();
    } catch (e) {
      dispatch({
        type: "SET_ERROR",
        error: inKorean(e instanceof Error ? e.message : "", "내보내기에 실패했어요. 잠시 뒤 다시 시도해 주세요."),
      });
    } finally {
      dispatch({ type: "SET_BUSY", busy: false });
    }
  }

  return (
    <StudioFrame
      step={2}
      title={state.keyword}
      summary={[
        { label: "형태", value: "정보전달 1장" },
        { label: "테마", value: THEMES[state.themeId].label },
        { label: "크기", value: "1080 × 1350 PNG" },
      ]}
      action={
        <>
          {/* 되돌릴 수 없는 조작은 헤더에 둔다(docs/ui-standards.md §4). */}
          {resetConfirm ? (
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-[13px] font-bold">지금까지 만든 내용이 모두 사라져요.</span>
              <LineButton disabled={state.busy} onClick={() => setResetConfirm(false)}>
                취소
              </LineButton>
              <SolidButton disabled={state.busy} onClick={() => dispatch({ type: "RESET" })}>
                처음부터 다시
              </SolidButton>
            </span>
          ) : (
            <LineButton disabled={state.busy} onClick={() => setResetConfirm(true)}>
              <RotateCcw size={15} aria-hidden="true" />
              처음부터 다시
            </LineButton>
          )}
          <LineButton disabled={state.busy} onClick={onPrev}>
            <ArrowLeft size={16} aria-hidden="true" />
            만들기로 돌아가기
          </LineButton>
        </>
      }
    >
      <div className="flex flex-col gap-9 px-5 py-8 sm:px-8 lg:gap-10 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-3">
          <h2 className="text-balance text-[30px] font-black leading-[1.08] tracking-tight sm:text-[36px] lg:text-[44px]">
            이대로 내보낼까요
          </h2>
          <p className="max-w-[46rem] text-[15px] leading-relaxed text-ink-2 sm:text-[17px]">
            한 장으로 나가요. 인스타에 올릴 때 그대로 보이는 크기예요.
          </p>
        </div>

        {state.error && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[14px] font-bold text-surface">
            <CircleAlert size={16} aria-hidden="true" className="flex-none" />
            {state.error}
          </p>
        )}

        <section className="flex flex-col gap-4">
          <SectionHead title="미리보기" aside="1080 × 1350" />
          {card ? (
            <div className="overflow-hidden rounded-xl border border-hair" style={{ width: 324, height: 405 }} aria-hidden="true">
              <div className="origin-top-left scale-30">
                <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
              </div>
            </div>
          ) : (
            <p className="text-[14px] text-ink-2">먼저 카피를 만들어 주세요.</p>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <SectionHead title="파일로 저장" aside="이 컴퓨터 안에만 남아요" />
          <div className="flex flex-col gap-4 rounded-xl border border-hair p-6">
            <p className="text-[14px] leading-relaxed text-ink-2">
              네트워크 밖으로 나가지 않아요. 폴더에 PNG 한 장으로 남거나, 브라우저 다운로드 폴더에 내려받아요.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <LineButton disabled={state.busy || !card} onClick={() => void run(onDownload)}>
                <Download size={15} aria-hidden="true" />
                내려받기
              </LineButton>
              <SolidButton
                disabled={state.busy || !card}
                onClick={() =>
                  void run(async () => {
                    const { dir, paths } = await onSave();
                    setSaved({ dir, count: paths.length });
                  })
                }
              >
                <FolderDown size={16} aria-hidden="true" />
                폴더에 저장
              </SolidButton>
            </div>
            {saved && (
              <p role="status" className="flex items-center gap-2.5 rounded-lg bg-canvas px-4 py-3 text-[14px]">
                <Check size={16} aria-hidden="true" className="flex-none" />
                <span>
                  <span className="font-bold">{saved.count}장</span> 저장했어요 —{" "}
                  <code className="rounded bg-hair-soft px-1.5 py-0.5 font-mono text-[13px]">{saved.dir}</code>
                </span>
              </p>
            )}
          </div>
        </section>
      </div>
    </StudioFrame>
  );
}

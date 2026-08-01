"use client";

import { useState, type Dispatch } from "react";
import { ArrowLeft, Check, CircleAlert, Download, FolderDown, RotateCcw } from "lucide-react";
import { StudioFrame, LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { CardRenderer } from "@/templates/CardRenderer";
import { outputDir } from "@/lib/paths";
import { mmdd } from "@/features/studio/useGenerate";
import { toRenderCards } from "../render";
import type { CardnewsAction, CardnewsState } from "../reducer";
import { ROLE_LABELS } from "./WorkbenchRail";
import { inKorean } from "./errors";

/**
 * 화면 3 — 내보내기. `src/app/lab2/Export.tsx` 시안에서 캡션·해시태그·인스타 올리기
 * 섹션(조각 2)을 걷어내고 "세트로 확인 → 저장"만 남겼다.
 *
 * 미리보기는 `CardCanvas`(편집 표면)가 아니라 `CardRenderer` 로 실제 템플릿을 그려 축소한다
 * (옛 `steps/ExportStep.tsx` 와 같은 방식) — 테마·핸들이 반영된 진짜 결과라야 저장 직전
 * 확인이 의미가 있다.
 */
export function ExportScreen({
  state,
  dispatch,
  onPrev,
  onDownload,
  onSave,
}: {
  state: CardnewsState;
  dispatch: Dispatch<CardnewsAction>;
  onPrev: () => void;
  onDownload: () => Promise<void>;
  onSave: () => Promise<{ dir: string; paths: string[] }>;
}) {
  // 어디에 저장됐는지는 저장할 값이 아니라 이 화면을 보는 동안의 확인 표시다 — reducer 에 넣지 않는다.
  const [saved, setSaved] = useState<{ dir: string; count: number } | null>(null);
  // 되돌릴 수 없는 조작이라 확인을 한 번 거친다 — 이 화면 안의 지역 상태로, window.confirm 은 쓰지 않는다.
  const [resetConfirm, setResetConfirm] = useState(false);

  const rendered = toRenderCards(state);
  const dir = outputDir("cardnews", state.keyword, mmdd());

  async function run(fn: () => Promise<void>) {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      await fn();
    } catch (e) {
      // 캡처·다운로드·폴더 저장은 파일시스템/네트워크 API 라 영문 오류를 던질 수 있다.
      const message = inKorean(
        e instanceof Error ? e.message : "",
        "내보내기에 실패했어요. 잠시 뒤 다시 시도해 주세요."
      );
      dispatch({ type: "SET_ERROR", error: message });
    } finally {
      dispatch({ type: "SET_BUSY", busy: false });
    }
  }

  return (
    <StudioFrame
      step={2}
      title={state.keyword}
      summary={[
        { label: "형태", value: `카드뉴스 ${state.cards.length}장` },
        { label: "크기", value: "1080 × 1350 PNG" },
        { label: "저장 위치", value: dir },
      ]}
      action={
        <>
          <LineButton disabled={state.busy} onClick={onPrev}>
            <ArrowLeft size={16} aria-hidden="true" />
            만들기로 돌아가기
          </LineButton>
          <LineButton disabled={state.busy} onClick={() => void run(onDownload)}>
            <Download size={15} aria-hidden="true" />
            내려받기
          </LineButton>
          <SolidButton
            disabled={state.busy}
            onClick={() =>
              void run(async () => {
                const res = await onSave();
                setSaved({ dir: res.dir, count: res.paths.length });
              })
            }
          >
            <FolderDown size={16} aria-hidden="true" />
            저장
          </SolidButton>
        </>
      }
    >
      <div className="flex flex-col gap-9 px-5 py-8 sm:px-8 lg:gap-10 lg:px-10 lg:py-12">
        <div className="flex flex-col gap-3">
          <h2 className="text-balance text-[30px] font-black leading-[1.08] tracking-tight sm:text-[36px] lg:text-[44px]">
            이대로 내보낼까요
          </h2>
          <p className="max-w-[54ch] text-[15px] leading-relaxed text-ink-2 sm:text-[17px]">
            넘겨 보는 순서대로 늘어놓았어요. 한 덩어리로 읽히는지 마지막으로 확인해 보세요.
          </p>
          {state.busy && (
            <p role="status" className="text-[14px] text-ink-2">
              내보내는 중이에요. 잠시만 기다려 주세요.
            </p>
          )}
        </div>

        {state.error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[14px] font-bold text-surface"
          >
            <CircleAlert size={16} aria-hidden="true" className="flex-none" />
            {state.error}
          </p>
        )}

        {saved && (
          <p
            role="status"
            className="flex items-center gap-2.5 rounded-lg border border-hair bg-canvas px-4 py-3 text-[14px]"
          >
            <Check size={16} aria-hidden="true" className="flex-none" />
            <span>
              <span className="font-bold">{saved.count}장</span> 저장했어요 —{" "}
              <code className="rounded bg-hair-soft px-1.5 py-0.5 font-mono text-[13px]">{saved.dir}</code>
            </span>
          </p>
        )}

        <section className="flex flex-col gap-4">
          <SectionHead
            title={`${state.cards.length}장 이어 보기`}
            aside="인스타에서 넘어가는 순서 그대로예요"
          />
          <ol className="flex gap-4 overflow-x-auto pb-3">
            {rendered.map((card, i) => {
              const draft = state.cards[i];
              return (
                <li key={draft.id} className="flex w-[152px] flex-none flex-col gap-2">
                  {/* 순수 시각 미리보기 — 헤드라인·본문·핸들은 실제 템플릿 텍스트라 스크린리더에
                      그대로 노출되면 아래 순번·역할 캡션, "저장될 파일" 목록과 카드 수만큼
                      중복 낭독된다. 보이는 정보는 그 두 곳에 이미 텍스트로 있다. */}
                  <div className="overflow-hidden rounded-xl border border-hair bg-surface" aria-hidden="true">
                    <span className="block aspect-[4/5] w-full overflow-hidden bg-hair-soft">
                      <span className="block origin-top-left scale-[0.1407]">
                        <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
                      </span>
                    </span>
                  </div>
                  <p className="flex items-baseline gap-2">
                    <span className="text-[13px] font-bold tabular-nums text-ink-2">{i + 1}</span>
                    <span className="truncate text-[14px] font-bold">{ROLE_LABELS[draft.copy.role]}</span>
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="flex max-w-[640px] flex-col gap-4">
          <SectionHead title="저장될 파일" />
          <div className="flex flex-col gap-4 rounded-xl border border-hair p-6">
            <p className="text-[17px] font-bold tracking-tight">{dir}/</p>
            <ul className="flex flex-col gap-2">
              {state.cards.map((card, i) => (
                <li key={card.id} className="flex items-center gap-2.5 text-[14px] text-ink-2">
                  <Check size={14} aria-hidden="true" className="flex-none" />
                  <span className="tabular-nums">{i + 1}.png</span>
                  <span className="text-ink-3">·</span>
                  <span className="truncate">{card.copy.heading}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-hair pt-4 text-[14px] leading-relaxed text-ink-2">
              같은 주제로 오늘 다시 저장하면 이 폴더를 덮어써요. 이전 회차를 남기려면 폴더 이름을 바꿔 주세요.
            </p>
          </div>
        </section>

        <section className="flex max-w-[640px] flex-col gap-4">
          <SectionHead title="새로 만들기" />
          {resetConfirm ? (
            <div className="flex flex-col gap-3 rounded-xl border border-hair p-6">
              <p className="text-[14px] leading-relaxed text-ink-2">
                정말 처음부터 다시 할까요? 지금까지 만든 내용이 모두 사라져요.
              </p>
              <div className="flex gap-2.5">
                <LineButton disabled={state.busy} onClick={() => setResetConfirm(false)}>
                  취소
                </LineButton>
                <SolidButton disabled={state.busy} onClick={() => dispatch({ type: "RESET" })}>
                  처음부터 다시
                </SolidButton>
              </div>
            </div>
          ) : (
            <LineButton disabled={state.busy} onClick={() => setResetConfirm(true)}>
              <RotateCcw size={15} aria-hidden="true" />
              처음부터 다시
            </LineButton>
          )}
        </section>
      </div>
    </StudioFrame>
  );
}

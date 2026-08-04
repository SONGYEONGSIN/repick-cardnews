"use client";

import { useState, type Dispatch } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, ImagePlus, LoaderCircle, Sparkles } from "lucide-react";
import { PLACEHOLDER_BOX, PLACEHOLDER_MIN_H } from "@/components/ui";
import { StudioFrame, LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { Dropzone } from "@/features/photos/Dropzone";
import { PhotoGrid } from "@/features/photos/PhotoGrid";
import { CardRenderer } from "@/templates/CardRenderer";
import { THEMES } from "@/templates/themes";
import { requestSpec } from "@/features/studio/useGenerate";
import type { InfographicSpec } from "@/lib/schema";
import { inKorean } from "@/features/cardnews/screens/errors";
import { useFitScale } from "@/features/studio/useFitScale";
import { infoChecks } from "../checks";
import { canGenerate, photoStage, type StartChoice } from "../workbench-view";
import { InfoToolbar } from "../parts/InfoToolbar";
import { toRenderCard } from "../render";
import { canLeaveInfoWorkbench, selectedPhoto, type InfoAction, type InfoState } from "../reducer";

/**
 * 화면 2 — 만들기. 옛 위저드의 사진·주제·편집 세 단계가 이 한 화면이다(카드뉴스와 같은 구조).
 *
 * **사진이 왼쪽, 카드가 오른쪽.** 카드뉴스 `WorkbenchScreen` 과 같은 두 칸이라 오가며 다른
 * 배치를 배우지 않아도 된다. 사진은 **선택**이라 없어도 오른쪽에 카드가 나온다 — 없으면 제목이
 * 테마 색 띠로 그려진다(`@/templates/infographic-band`).
 */
/** 저장 이미지 크기 — 미리보기는 이 크기를 자리에 맞게 줄여 그린다. */
const CARD_W = 1080;
const CARD_H = 1350;

export function InfoWorkbenchScreen({
  state,
  dispatch,
  onPrev,
  onNext,
}: {
  state: InfoState;
  dispatch: Dispatch<InfoAction>;
  onPrev: () => void;
  onNext: () => void;
}) {
  // 저장할 값이 아니라 이 화면을 보는 동안의 시선이다 — reducer 에 넣지 않는다.
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState<StartChoice>("unset");
  const card = toRenderCard(state);
  const photo = selectedPhoto(state);
  const checks = infoChecks(state);
  const stage = photoStage(choice, state.photos.length, state.spec !== null);
  const fit = useFitScale(CARD_W, CARD_H);

  async function generate() {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      const spec = await requestSpec<InfographicSpec>({
        type: "informationsend",
        keyword: state.keyword,
        // 사진은 선택이다 — 없으면 빈 배열로 보낸다(주제만 보고 쓴다).
        photos: photo ? [photo.thumbUrl] : [],
      });
      dispatch({ type: "SET_SPEC", spec });
    } catch (e) {
      dispatch({
        type: "SET_ERROR",
        error: inKorean(e instanceof Error ? e.message : "", "카피 생성에 실패했어요. 잠시 뒤 다시 시도해 주세요."),
      });
    } finally {
      dispatch({ type: "SET_BUSY", busy: false });
    }
  }

  const dropOpen = !state.busy && adding;
  const status = state.busy
    ? "주제를 보고 카피를 쓰는 중이에요."
    : !canGenerate(stage)
      ? "사진을 올리면 만들 수 있어요."
      : state.spec
        ? "다시 만들면 지금 고친 글은 사라져요."
        : "주제를 보고 제목·항목·팁을 써요.";

  return (
    <StudioFrame
      step={1}
      title={state.keyword}
      summary={[
        { label: "형태", value: "정보전달 1장" },
        { label: "올린 사진", value: `${state.photos.length}장` },
        { label: "테마", value: THEMES[state.themeId].label },
        { label: "저장 크기", value: "1080 × 1350 PNG" },
      ]}
      sidebar={
        checks.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <h2 className="text-[13px] text-ink-2">점검</h2>
            <ul className="flex flex-col gap-1.5">
              {checks.map((c) => (
                <li key={c.text} className="flex items-start gap-2 text-[14px] font-bold leading-snug">
                  {c.tone === "ok" ? (
                    <Check size={14} aria-hidden="true" className="mt-0.5 flex-none" />
                  ) : (
                    <CircleAlert size={14} aria-hidden="true" className="mt-0.5 flex-none" />
                  )}
                  {c.text}
                </li>
              ))}
            </ul>
          </section>
        ) : undefined
      }
      action={
        <>
          <LineButton disabled={state.busy} onClick={onPrev}>
            <ArrowLeft size={16} aria-hidden="true" />
            주제로 돌아가기
          </LineButton>
          <SolidButton disabled={!canLeaveInfoWorkbench(state) || state.busy} onClick={onNext}>
            내보내기
            <ArrowRight size={16} aria-hidden="true" />
          </SolidButton>
        </>
      }
    >
      <div className="flex flex-col gap-8 px-5 py-6 sm:px-8 lg:gap-9 lg:px-10 lg:py-9 xl:h-full xl:flex-row xl:gap-x-8 xl:py-3">
        {/* 왼쪽 = 고치는 곳(사진 + 글·항목·테마). 오른쪽은 결과만 본다 — 편집칸이 카드 위에
            얹혀 있으면 고치면서 카드를 볼 수 없다는 지적을 받아 옮겼다(2026-08-04). */}
        <div className="flex flex-col gap-8 lg:gap-9 xl:min-h-0 xl:max-w-[680px] xl:min-w-[420px] xl:flex-none xl:basis-[34%] xl:overflow-y-auto">
          <section className="flex flex-col gap-4">
            <SectionHead title="사진" aside="없어도 돼요" />

            {/* 사진을 쓸지 말지 **먼저 고른다.** 드롭존과 만들기 버튼을 나란히 두면 사진이
                필수처럼 읽힌다 — 선택인데도. */}
            {stage === "choose" && (
              <div className={`flex ${PLACEHOLDER_MIN_H} flex-col items-center justify-center gap-4 rounded-xl border border-hair p-6 text-center`}>
                <p className="text-[14px] leading-relaxed text-ink-2">
                  사진을 쓸지 먼저 정해요. 안 쓰면 제목을 테마 색 띠로 그려요.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <SolidButton onClick={() => setChoice("with-photo")}>
                    <ImagePlus size={16} aria-hidden="true" />
                    사진 올리고 만들기
                  </SolidButton>
                  <LineButton onClick={() => setChoice("without-photo")}>사진 없이 만들기</LineButton>
                </div>
              </div>
            )}

            {stage === "upload" && (
              <>
                <Dropzone
                  hint="폴더째 올려도 돼요. 한 장만 골라 씁니다."
                  onPhotos={(photos) => {
                    dispatch({ type: "ADD_PHOTOS", photos });
                    setAdding(false);
                  }}
                  onError={(error) => dispatch({ type: "SET_ERROR", error })}
                />
                {/* 되돌아갈 길을 둔다 — 사진을 고른 뒤 마음이 바뀌면 여기서 막혔다. */}
                <LineButton onClick={() => setChoice("without-photo")}>사진 없이 만들기</LineButton>
              </>
            )}

            {stage === "ready" &&
              (dropOpen ? (
                <Dropzone
                  hint="폴더째 올려도 돼요. 한 장만 골라 씁니다."
                  onPhotos={(photos) => {
                    dispatch({ type: "ADD_PHOTOS", photos });
                    setAdding(false);
                  }}
                  onError={(error) => dispatch({ type: "SET_ERROR", error })}
                />
              ) : state.photos.length > 0 ? (
                <>
                  <PhotoGrid
                    photos={state.photos}
                    selectedIds={state.selectedPhotoId ? [state.selectedPhotoId] : []}
                    onToggle={(photoId) => dispatch({ type: "SELECT_PHOTO", photoId })}
                  />
                  <LineButton onClick={() => setAdding(true)}>사진 더 올리기</LineButton>
                </>
              ) : (
                <div
                  className={`flex ${PLACEHOLDER_MIN_H} flex-col items-center justify-center gap-4 rounded-xl border border-hair p-6 text-center`}
                >
                  <p className="text-[14px] text-ink-2">사진 없이 만드는 중이에요.</p>
                  <LineButton onClick={() => setAdding(true)}>사진 올리기</LineButton>
                </div>
              ))}

            {stage !== "choose" && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <SolidButton
                  disabled={state.busy || !canGenerate(stage) || state.keyword.trim().length === 0}
                  onClick={() => void generate()}
                >
                  {state.busy ? (
                    <LoaderCircle size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Sparkles size={16} aria-hidden="true" />
                  )}
                  {state.busy ? "카피 쓰는 중" : state.spec ? "카피 다시 만들기" : "카피 만들기"}
                </SolidButton>
                <p role="status" className="text-[14px] text-ink-2">
                  {status}
                </p>
              </div>
            )}
          </section>

          {card && state.spec && (
            <section className="flex flex-col gap-4">
              <SectionHead title="고치기" aside="바로 반영돼요" />
              <InfoToolbar state={state} dispatch={dispatch} hasPhoto={photo !== null} />
            </section>
          )}
        </div>

        {/* 오른쪽 = 카드만. 제목→내용 간격은 왼쪽과 같아야 한다(docs/ui-standards.md). */}
        <div className="flex flex-col gap-8 xl:min-h-0 xl:min-w-0 xl:flex-1 xl:gap-3">
          <section className="flex flex-col gap-4 xl:min-h-0 xl:flex-1">
            <SectionHead title="카드" aside={state.spec ? "1080 × 1350" : undefined} />

            {state.error && (
              <p role="alert" className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[14px] font-bold text-surface">
                <CircleAlert size={16} aria-hidden="true" className="flex-none" />
                {state.error}
              </p>
            )}

            {card && state.spec ? (
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-canvas p-4">
                {/* 자리를 재서 그 안에 맞게 줄인다 — 배율을 박아 두면 자리가 좁아져도 안 줄어
                    밖으로 튀어나온다(`useFitScale` 주석 참고). */}
                <div ref={fit.ref} className="h-full max-h-[760px] w-full">
                  <div
                    className="mx-auto overflow-hidden rounded-xl"
                    style={{ width: CARD_W * fit.scale, height: CARD_H * fit.scale }}
                  >
                    <div
                      className="origin-top-left"
                      style={{ width: CARD_W, height: CARD_H, transform: `scale(${fit.scale})` }}
                    >
                      <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`${PLACEHOLDER_BOX} gap-2 bg-canvas`}>
                <p className="text-[17px] font-bold">카피를 만들면 여기에 카드가 나와요</p>
                <p className="text-[14px] text-ink-2">제목·항목·팁은 왼쪽에서 고쳐요.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </StudioFrame>
  );
}

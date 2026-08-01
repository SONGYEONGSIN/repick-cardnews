"use client";

import { useState, type Dispatch } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, LoaderCircle, Sparkles } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { StudioFrame, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { Dropzone } from "@/features/photos/Dropzone";
import { requestSpec } from "@/features/studio/useGenerate";
import type { CardnewsSpec } from "@/lib/schema";
import { CardCanvas } from "../parts/CardCanvas";
import { EditToolbar, type EditTarget } from "../parts/EditToolbar";
import { ROLE_LABELS, WorkbenchRail } from "./WorkbenchRail";
import { WorkbenchSetBar } from "./WorkbenchSetBar";
import {
  CARDNEWS_MAX,
  CARDNEWS_MIN,
  canLeaveWorkbench,
  slotPhotos,
  trayPhotos,
  type CardnewsAction,
  type CardnewsState,
} from "../reducer";

/**
 * 화면 2 — 만들기. 옛 위저드의 사진·순서·편집 세 단계가 이 한 화면이다.
 *
 * 설정이 두 층이다. **세트 단위**(테마·핸들)는 `WorkbenchSetBar`, **카드 단위**는 `EditToolbar`.
 * 순서 레일은 `WorkbenchRail` 로 뺐다 — 세 덩어리가 각각 다른 것을 고른다.
 *
 * 액센트 색을 쓰지 않는다 — 선택도 오류도 검정 채움(`bg-ink text-surface`)과 굵기로만 만든다.
 * 그래서 **사진과 카드 프리뷰가 화면에서 유일하게 색을 가진 것**이 된다.
 *
 * 인덱스가 두 개다: 레일은 `state.order`(= `slotPhotos`), 캔버스는 `state.cards`. 카피 생성
 * 전에는 `cards` 가 비어 있고 사진을 갈아 끼우면 `order` 가 줄 수 있으므로, 둘 다 **렌더 중
 * 순수 계산으로** 좁혀서 접근한다(아래 `active`·`card`). effect 로 되돌리지 않는다.
 *
 * 시안(`src/app/lab2/Workbench.tsx`)에서 뺀 것: 되돌리기·다시 실행(조각 2), 제목 서체
 * 그룹(데이터 모델에 없다), 순서 드래그(이 화면이 받는 동작이 아니다).
 */

/** 카피 생성 줄. 20~50초 걸리는 호출이라 버튼 문구와 옆 한 줄이 진행 상황을 함께 말한다. */
function GenerateRow({
  busy,
  disabled,
  hasCards,
  status,
  onGenerate,
}: {
  busy: boolean;
  disabled: boolean;
  hasCards: boolean;
  status: string;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <SolidButton disabled={disabled} onClick={onGenerate}>
        {busy ? (
          <LoaderCircle size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Sparkles size={16} aria-hidden="true" />
        )}
        {busy ? "카피 쓰는 중" : hasCards ? "카피 다시 만들기" : "카피 만들기"}
      </SolidButton>
      {/* 진행 상황과 막힌 이유를 한 줄로. 문구가 바뀌면 스크린리더도 읽도록 status 로 둔다 */}
      <p role="status" className="text-[14px] text-ink-2">
        {status}
      </p>
    </div>
  );
}

export function WorkbenchScreen({
  state,
  dispatch,
  onPrev,
  onNext,
}: {
  state: CardnewsState;
  dispatch: Dispatch<CardnewsAction>;
  onPrev: () => void;
  onNext: () => void;
}) {
  // 저장할 값이 아니라 이 화면을 보는 동안의 시선이다 — reducer 에 넣지 않는다.
  const [selected, setSelected] = useState(0);
  const [target, setTarget] = useState<EditTarget>("heading");
  const [adding, setAdding] = useState(false);

  const slots = slotPhotos(state);
  const tray = trayPhotos(state);

  // 사진을 갈아 끼우거나 빼면 order 가 줄 수 있다. effect 로 selected 를 고치지 않고 렌더 중에
  // 좁힌다 — 범위를 벗어난 한 프레임이 먼저 그려지지 않고 렌더도 한 번만 돈다.
  const active = slots.length === 0 ? 0 : Math.min(selected, slots.length - 1);
  // `.at()` 은 `CardDraft | undefined` 를 준다. 카피 생성 전에는 반드시 undefined 이므로
  // 아래에서 카드가 있을 때만 툴바·캔버스를 그린다(단언으로 뭉개지 않는다).
  const card = state.cards.at(active);
  // 카드의 사진은 order 가 아니라 card.photoId 로 찾는다 — 출력(`toRenderCards`)이 쓰는 것과
  // 같은 식이라야 캔버스와 저장 결과가 어긋나지 않는다.
  const photo = card ? state.photos.find((p) => p.id === card.photoId) : undefined;

  // 사진이 아직 없으면 올릴 곳이 늘 보여야 한다 — 이 화면의 첫 상태다.
  const dropOpen = adding || state.photos.length === 0;
  const canGenerate = slots.length >= CARDNEWS_MIN && !state.busy;

  function pick(index: number) {
    setSelected(index);
    // 카드가 바뀌면 편집 대상도 되돌린다. heading 은 다섯 역할 전부에 있어 항상 유효하다 —
    // 그대로 두면 부모가 지금 카드에 없는 대상(본문·사진)을 가리킨 채 남는다.
    setTarget("heading");
  }

  function swapIn(photoId: string) {
    dispatch({ type: "SWAP_IN", slotIndex: active, photoId });
    // order 만 바꾸면 이미 만들어진 카드는 옛 사진을 계속 본다(card.photoId 는 SET_SPEC 시점 값이고
    // 캔버스도 출력도 그것으로 사진을 찾는다). 레일과 카드가 같은 사진을 가리키게 함께 옮긴다.
    if (card) dispatch({ type: "UPDATE_CARD", index: active, patch: { photoId } });
    setAdding(false);
  }

  async function generate() {
    dispatch({ type: "SET_BUSY", busy: true });
    try {
      const spec = await requestSpec<CardnewsSpec>({
        type: "cardnews",
        keyword: state.keyword,
        // 보내는 것은 thumbUrl 이다 — dataUrl 은 원본(PNG 캡처용)이라 페이로드가 몇 배가 된다.
        photos: slots.map((p) => p.thumbUrl),
      });
      dispatch({ type: "SET_SPEC", spec });
      // 카드가 통째로 바뀌었다. 고르기와 같은 이유로 편집 대상을 되돌린다.
      setTarget("heading");
    } catch (e) {
      // 서버가 한국어로 준 문구를 그대로 보여 준다(`api-errors.ts`).
      dispatch({ type: "SET_ERROR", error: e instanceof Error ? e.message : "카피 생성에 실패했어요." });
    } finally {
      dispatch({ type: "SET_BUSY", busy: false });
    }
  }

  const status = state.busy
    ? "사진을 보고 카피를 쓰는 중이에요. 20~50초쯤 걸려요."
    : slots.length < CARDNEWS_MIN
      ? `사진이 ${CARDNEWS_MIN}장 이상이면 만들 수 있어요. 지금 ${slots.length}장.`
      : state.cards.length === 0
        ? "주제와 사진을 함께 보고 카드마다 카피를 써요."
        : "다시 만들면 지금 고친 글은 사라져요.";

  return (
    <StudioFrame
      step={1}
      title={state.keyword}
      summary={[
        { label: "형태", value: `카드뉴스 ${slots.length}장` },
        { label: "올린 사진", value: `${state.photos.length}장` },
      ]}
      action={
        <>
          {/* 셸의 LineButton 은 onClick 을 받지 않는다(셸은 이 태스크에서 건드리지 않는다) —
              같은 모양을 여기서 만든다. */}
          <button
            type="button"
            onClick={onPrev}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-hair px-5 text-[15px] font-bold transition-colors duration-200 hover:border-ink ${FOCUS_RING} motion-reduce:transition-none`}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            주제 고치기
          </button>
          <SolidButton disabled={!canLeaveWorkbench(state)} onClick={onNext}>
            내보내기
            <ArrowRight size={16} aria-hidden="true" />
          </SolidButton>
        </>
      }
    >
      <div className="flex flex-col gap-8 px-5 py-6 sm:px-8 lg:gap-9 lg:px-10 lg:py-9">
        <WorkbenchSetBar themeId={state.themeId} handle={state.handle} dispatch={dispatch} />

        <section className="flex flex-col gap-4">
          <SectionHead
            title="넘겨 보는 순서"
            aside={`${slots.length}장 · ${CARDNEWS_MIN}~${CARDNEWS_MAX}장으로 만들어요`}
          />
          {slots.length > 0 && (
            <WorkbenchRail
              slots={slots}
              tray={tray}
              cards={state.cards}
              active={active}
              dropOpen={dropOpen}
              onPick={pick}
              onSwapIn={swapIn}
              onToggleDrop={() => setAdding((v) => !v)}
            />
          )}
          {tray.length > 0 && (
            <p className="text-[13px] text-ink-2">
              안 쓴 사진을 누르면 지금 고른 <span className="tabular-nums">{active + 1}</span>번 자리에 들어가요.
            </p>
          )}
          {dropOpen && (
            <Dropzone
              hint={`카드뉴스는 사진 ${CARDNEWS_MIN}~${CARDNEWS_MAX}장으로 만들어요. 더 올리면 안 쓴 사진으로 남겨 뒀다가 바꿔 낄 수 있어요.`}
              onPhotos={(photos) => {
                dispatch({ type: "ADD_PHOTOS", photos });
                setAdding(false);
              }}
              onError={(error) => dispatch({ type: "SET_ERROR", error })}
            />
          )}
        </section>

        <section className="flex flex-col gap-4">
          <SectionHead
            title={card ? `${active + 1}번 · ${ROLE_LABELS[card.copy.role]}` : "카드"}
            aside={card ? "1080 × 1350" : undefined}
          />

          <GenerateRow
            busy={state.busy}
            disabled={!canGenerate}
            hasCards={state.cards.length > 0}
            status={status}
            onGenerate={() => void generate()}
          />

          {state.error && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[14px] font-bold text-surface"
            >
              <CircleAlert size={16} aria-hidden="true" className="flex-none" />
              {state.error}
            </p>
          )}

          {card ? (
            <>
              <EditToolbar
                card={card}
                target={target}
                onSelect={setTarget}
                onPatch={(patch) => dispatch({ type: "UPDATE_CARD", index: active, patch })}
                onSwapPhoto={() => setAdding(true)}
              />
              <div className="flex justify-center rounded-2xl bg-canvas px-4 py-8">
                <CardCanvas
                  card={card}
                  photo={photo}
                  target={target}
                  onSelect={setTarget}
                  onPatch={(patch) => dispatch({ type: "UPDATE_CARD", index: active, patch })}
                />
              </div>
              <p className="text-center text-[13px] text-ink-2">고칠 곳을 눌러요. 글은 그 자리에서 바로 고쳐요.</p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-hair bg-canvas px-6 py-16 text-center">
              <p className="text-[17px] font-bold">사진을 올리고 카피를 만들면 여기에 카드가 나와요</p>
              <p className="text-[14px] text-ink-2">카드마다 헤드라인·본문·사진을 여기서 바로 고쳐요.</p>
            </div>
          )}
        </section>
      </div>
    </StudioFrame>
  );
}

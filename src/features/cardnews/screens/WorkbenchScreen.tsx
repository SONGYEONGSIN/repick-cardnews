"use client";

import { useState, type Dispatch } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, LoaderCircle, Sparkles } from "lucide-react";
import { StudioFrame, LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { Dropzone } from "@/features/photos/Dropzone";
import { requestSpec } from "@/features/studio/useGenerate";
import type { CardnewsSpec } from "@/lib/schema";
import { CardCanvas } from "../parts/CardCanvas";
import { EditToolbar, type EditTarget } from "../parts/EditToolbar";
import { ROLE_LABELS, WorkbenchRail, type RailItem } from "./WorkbenchRail";
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
 * 레일 칩의 기준은 **카피 생성 전에는 사진, 생성 후에는 카드**다(`items`). 카드가 사진보다
 * 많을 수 있어 사진 기준으로만 그리면 마지막 카드에 닿지 못한다. 길이가 상황마다 달라지므로
 * 고른 자리(`selected`)는 **렌더 중 순수 계산으로** 좁혀서 쓴다(`active`) — effect 로 되돌리지
 * 않는다. 카드가 없는 자리에서는 캔버스를 아예 그리지 않는다.
 *
 * `order` 와 `cards` 의 사진 연결은 reducer 가 지킨다(`relinkPhotos`). 이 화면은 `REORDER`·
 * `SWAP_IN`·`REMOVE_PHOTO` 를 그대로 보내기만 하고 카드 쪽을 따로 보정하지 않는다.
 *
 * 시안(`src/app/lab2/Workbench.tsx`)에서 뺀 것: 되돌리기·다시 실행(조각 2), 제목 서체
 * 그룹(데이터 모델에 없다), 순서 드래그(버튼으로 대신한다 — 키보드로도 되어야 한다).
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

  // 칩 하나가 가리키는 것. 카피가 나오면 카드가 기준이 된다 — 사진이 모자란 카드도 칩을 가져야
  // 글을 고칠 수 있다. 카드의 사진은 order 가 아니라 card.photoId 로 찾는다(출력 `toRenderCards`
  // 와 같은 식이라야 캔버스와 저장 결과가 어긋나지 않는다).
  const items: RailItem[] =
    state.cards.length > 0
      ? state.cards.map((card) => ({
          key: card.id,
          photo: state.photos.find((p) => p.id === card.photoId),
          card,
        }))
      : slots.map((photo) => ({ key: photo.id, photo, card: undefined }));

  // 사진을 빼거나 갈아 끼우면 레일이 줄 수 있다. effect 로 selected 를 고치지 않고 렌더 중에
  // 좁힌다 — 범위를 벗어난 한 프레임이 먼저 그려지지 않고 렌더도 한 번만 돈다.
  const active = items.length === 0 ? 0 : Math.min(selected, items.length - 1);
  // `.at()` 은 `RailItem | undefined` 를 준다. 카드도 사진도 없을 수 있으므로 아래에서 카드가
  // 있을 때만 툴바·캔버스를 그린다(단언으로 뭉개지 않는다).
  const item = items.at(active);
  const card = item?.card;
  const photo = item?.photo;

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
    setAdding(false);
  }

  function moveTo(to: number) {
    dispatch({ type: "REORDER", from: active, to });
    // 선택은 **옮긴 사진**을 따라간다(`move` 가 그 사진을 to 자리에 놓는다). 자리에 남겨 두면
    // 방금 옮긴 사진이 아니라 옆 사진이 골라진 채가 돼 같은 버튼을 다시 못 누른다.
    // 자리가 바뀌면 그 자리의 카피가 달라지므로 pick 이 편집 대상도 heading 으로 되돌린다.
    pick(to);
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
          <LineButton onClick={onPrev}>
            <ArrowLeft size={16} aria-hidden="true" />
            주제 고치기
          </LineButton>
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
          {items.length > 0 && (
            <>
              <WorkbenchRail
                items={items}
                tray={tray}
                active={active}
                orderCount={state.order.length}
                dropOpen={dropOpen}
                onPick={pick}
                onMove={moveTo}
                onRemove={(photoId) => dispatch({ type: "REMOVE_PHOTO", photoId })}
                onSwapIn={swapIn}
                onToggleDrop={() => setAdding((v) => !v)}
              />
              <p className="text-[13px] text-ink-2">
                {/* 카피가 나오기 전에는 "카피는 자리에 남는다"는 말이 성립하지 않는다 —
                    카드 순서는 hook→cta 로 스키마가 고정하므로 바뀌는 것은 늘 사진뿐이다 */}
                {state.cards.length > 0
                  ? "칩을 누르면 그 카드를 고쳐요. 고른 칩의 화살표는 사진을 앞뒤 카드로 옮겨요 — 카피는 자리에 남아요."
                  : "고른 칩의 화살표로 사진 차례를 바꿔요."}{" "}
                빼기를 누르면 그 사진을 지워요.
                {tray.length > 0 && (
                  <>
                    {" "}
                    안 쓴 사진을 누르면 지금 고른 <span className="tabular-nums">{active + 1}</span>번 자리에
                    들어가요.
                  </>
                )}
              </p>
            </>
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

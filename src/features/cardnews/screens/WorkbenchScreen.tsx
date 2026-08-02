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
import { inKorean } from "./errors";
import {
  CARDNEWS_MAX,
  CARDNEWS_MIN,
  canLeaveWorkbench,
  slotPhotos,
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

  // 트레이는 **칩에 안 뜬 사진 전부**다. order 기준 파생만 쓰면, 카드보다
  // 사진이 많을 때(6장으로 생성했는데 카드가 5장, 또는 생성 뒤 사진을 더 올림) order 뒤쪽 사진이
  // 칩에도 트레이에도 없어 화면에서 사라지고 뺄 수도 없었다. 올린 사진은 예외 없이 둘 중
  // 하나에 보여야 한다.
  const shownIds = new Set(items.flatMap((it) => (it.photo ? [it.photo.id] : [])));
  const tray = state.photos.filter((p) => !shownIds.has(p.id));

  // 사진을 빼거나 갈아 끼우면 레일이 줄 수 있다. effect 로 selected 를 고치지 않고 렌더 중에
  // 좁힌다 — 범위를 벗어난 한 프레임이 먼저 그려지지 않고 렌더도 한 번만 돈다.
  const active = items.length === 0 ? 0 : Math.min(selected, items.length - 1);
  // `.at()` 은 `RailItem | undefined` 를 준다. 카드도 사진도 없을 수 있으므로 아래에서 카드가
  // 있을 때만 툴바·캔버스를 그린다(단언으로 뭉개지 않는다).
  const item = items.at(active);
  const card = item?.card;
  const photo = item?.photo;

  // 사진이 아직 없으면 올릴 곳이 늘 보여야 한다 — 이 화면의 첫 상태다.
  // 생성 중에는 닫는다: 지금 올린 사진이 order 에 들어가면 도착한 카피가 다른 사진에 붙는다.
  const dropOpen = !state.busy && (adding || state.photos.length === 0);
  const canGenerate = slots.length >= CARDNEWS_MIN && !state.busy;

  function pick(index: number) {
    setSelected(index);
    // 카드가 바뀌면 편집 대상도 되돌린다. heading 은 다섯 역할 전부에 있어 항상 유효하다 —
    // 그대로 두면 부모가 지금 카드에 없는 대상(본문·사진)을 가리킨 채 남는다.
    setTarget("heading");
  }

  function swapIn(photoId: string) {
    // 트레이에는 두 종류가 있다. order 밖 사진은 갈아 끼우고(SWAP_IN), 카드보다 뒤라 칩이 없는
    // order 안 사진은 자리를 옮겨 데려온다 — SWAP_IN 은 이미 order 에 있는 사진을 무시한다.
    const from = state.order.indexOf(photoId);
    if (from >= 0) dispatch({ type: "REORDER", from, to: active });
    else dispatch({ type: "SWAP_IN", slotIndex: active, photoId });
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
      // 네트워크가 끊기거나 dev 서버가 재시작되면 `Failed to fetch` 같은 영문이 여기로 온다.
      const message = inKorean(
        e instanceof Error ? e.message : "",
        "카피 생성에 실패했어요. 잠시 뒤 다시 시도해 주세요."
      );
      dispatch({ type: "SET_ERROR", error: message });
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
        // 생성 전에는 만들 장수(사진), 생성 후에는 실제 카드 수를 말한다 — 카드가 사진보다
        // 적게 올 수 있어(스키마 5~6장) 사진 장수를 계속 쓰면 사이드바가 거짓을 말한다.
        { label: "형태", value: `카드뉴스 ${state.cards.length > 0 ? state.cards.length : slots.length}장` },
        { label: "올린 사진", value: `${state.photos.length}장` },
      ]}
      action={
        <>
          <LineButton onClick={onPrev}>
            <ArrowLeft size={16} aria-hidden="true" />
            주제 고치기
          </LineButton>
          <SolidButton disabled={!canLeaveWorkbench(state) || state.busy} onClick={onNext}>
            내보내기
            <ArrowRight size={16} aria-hidden="true" />
          </SolidButton>
        </>
      }
    >
      {/*
        xl(1280px) 이상에서 두 칸으로 나눈다 — 왼쪽 = 설정(세트 바·순서 레일·카피 만들기),
        오른쪽 = 결과(카드 섹션 타이틀·오류·툴바·캔버스). lg(1024px)에서 반으로 나누면 왼쪽이
        460px 안팎이라 레일 칩 다섯 개가 가로로 못 들어간다(칩 152px×5+간격 ≈ 800px) — 그래서
        lg 은 지금처럼 쌓인 채로 두고 xl 부터만 칸을 나눈다.

        오른쪽은 비율이 아니라 **상한(550px)**이다. 카드는 세로 비율(`aspect-[4/5]`)이라 높이
        (`h-[min(70vh,760px)]`)로 크기가 정해지고 폭은 거기 따라온다(뷰포트 900px 기준 504px) —
        화면이 넓어져도 카드는 안 커진다. 오른쪽을 비율(fr)로 잡으면 화면이 넓을수록 카드 둘레의
        빈 여백만 커진다(이 작업을 시작한 "오른쪽이 통째로 빈다" 문제를 오른쪽 칸 안으로 옮겨
        놓을 뿐이다). 550px 은 카드가 필요로 하는 최소 536px(카드 504px + 캔버스 wrapper 좌우
        패딩 32px)에 14px 여유를 더한 값이다 — 왼쪽(`1fr`)이 남는 폭을 전부 가져가 화면이
        넓어질수록 레일이 더 넓게 펼쳐진다. 칸 사이 간격도 `xl` 부터는 `gap-3`(12px)로 좁힌다 —
        아래로 쌓일 때(`lg` 이하)의 세로 간격(`lg:gap-9`)은 그대로 두고 `column-gap`만 xl 그리드에서
        줄인다. 1920px 에서 레일(칩 5개+추가 버튼, 자연 폭 997px)이 가로 스크롤 없이 다 보이도록
        맞춘 값이다(수치는 2col-report.md §12 참고).
      */}
      <div className="flex flex-col gap-8 px-5 py-6 sm:px-8 lg:gap-9 lg:px-10 lg:py-9 xl:grid xl:grid-cols-[1fr_550px] xl:gap-x-3 xl:items-start">
        {/* 왼쪽 = 설정. 세트 바 → 순서 레일 → 카피 만들기 순서는 좁은 화면의 쌓인 순서와 같다. */}
        <div className="flex flex-col gap-8 lg:gap-9 xl:min-w-0">
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
                  locked={state.busy}
                  onPick={pick}
                  onMove={moveTo}
                  onRemove={(photoId) => dispatch({ type: "REMOVE_PHOTO", photoId })}
                  onSwapIn={swapIn}
                  onToggleDrop={() => setAdding((v) => !v)}
                />
                {/* 잠긴 이유를 잠긴 컨트롤 바로 옆에서 말한다 — 비활성만 보이면 고장으로 읽힌다 */}
                <p className="text-[13px] text-ink-2">
                  {state.busy ? (
                    "카피를 쓰는 중에는 사진을 바꿀 수 없어요. 지금 바꾸면 옛 사진을 보고 쓴 글이 다른 사진에 붙어요."
                  ) : (
                    <>
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
                // Dropzone 이 넘겨주는 문구도 늘 한국어는 아니다 — 파일 읽기가 던진 영문
                // DOMException 이 그대로 올라올 수 있어 생성 오류와 같은 필터를 거친다.
                onError={(error) =>
                  dispatch({
                    type: "SET_ERROR",
                    error: inKorean(error, "사진을 읽지 못했어요. 다른 사진으로 다시 해 주세요."),
                  })
                }
              />
            )}
          </section>

          <GenerateRow
            busy={state.busy}
            disabled={!canGenerate}
            hasCards={state.cards.length > 0}
            status={status}
            onGenerate={() => void generate()}
          />
        </div>

        {/*
          오른쪽 = 결과. xl 이상에서 스크롤을 따라오도록 고정한다 — 왼쪽 설정을 훑는 동안 카드가
          눈에 남아야 한다. `max-h` + `overflow-y-auto` 로 자체 스크롤을 두는 이유는, 카드가
          화면보다 길 때 고정을 그대로 두면 아래쪽(캡션·카드 하단)이 뷰포트 밖으로 밀려 닿을
          방법이 없어지기 때문이다 — 위아래로 top 오프셋(2.25rem)만큼씩 숨 쉴 자리를 남기고,
          넘치면 이 칸 안에서만 스크롤한다.
        */}
        <section className="flex flex-col gap-4 xl:sticky xl:top-9 xl:min-w-0 xl:max-h-[calc(100vh-4.5rem)] xl:overflow-y-auto">
          <SectionHead
            title={card ? `${active + 1}번 · ${ROLE_LABELS[card.copy.role]}` : "카드"}
            aside={card ? "1080 × 1350" : undefined}
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

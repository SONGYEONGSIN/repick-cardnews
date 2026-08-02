"use client";

import { useState, type Dispatch } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, LoaderCircle, Sparkles } from "lucide-react";
import { StudioFrame, LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { Dropzone } from "@/features/photos/Dropzone";
import { requestSpec } from "@/features/studio/useGenerate";
import type { CardnewsSpec } from "@/lib/schema";
import { CardCanvas } from "../parts/CardCanvas";
import { EditToolbar, type EditTarget } from "../parts/EditToolbar";
import { WorkbenchRail, type RailItem } from "./WorkbenchRail";
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
 * 그룹(데이터 모델에 없다). 순서 바꾸기는 한동안 버튼(위/아래 화살표)이었다가, 행을 직접 끌 수
 * 있어야 한다는 요구로 `WorkbenchRail` 안에서 `@dnd-kit` 드래그(키보드 포함)로 되돌아갔다.
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
  // 툴바의 "추가" 버튼이 캔버스의 빈 칸에 포커스를 옮겨 달라는 신호. 값 자체는 의미 없고
  // 매 클릭마다 늘어나기만 한다(CardCanvas 상단 주석 참고) — 같은 칸을 연달아 눌러도 신호가
  // 매번 달라져야 CardCanvas 의 effect 가 다시 돈다.
  const [focusToken, setFocusToken] = useState(0);

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

  function moveTo(from: number, to: number) {
    dispatch({ type: "REORDER", from, to });
    // 선택은 **옮긴 사진**을 따라간다(`move` 가 그 사진을 to 자리에 놓는다). 자리에 남겨 두면
    // 방금 끈 사진이 아니라 옆 사진이 골라진 채가 돼 방금 놓은 자리를 다시 못 고친다.
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
          {/* 생성 중에는 나갈 수 없다. 나가서 주제를 고치고 돌아오면 busy 가 안 풀린 채로 화면이
              잠기고, 뒤늦게 도착한 카피가 **고치기 전 주제**로 쓴 것이라 조용히 어긋난다. */}
          <LineButton disabled={state.busy} onClick={onPrev}>
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
        xl(1280px) 이상에서 두 칸으로 나눈다. **최대 폭 상한도, 전체를 가운데로 묶는 `mx-auto`
        도 두지 않는다** — 그 둘은 예전에 페이지 좌우에 죽은 여백을 남기던 원인이었다(그 결함을
        고친 기록은 `fullwidth-report.md`). 좌우 여백은 다른 화면(`TopicScreen`·`ExportScreen`)
        과 같은 `px-5 sm:px-8 lg:px-10` 뿐이다.

        **왼쪽(순서 레일 + 카피 만들기)은 `xl:basis-[34%]` 에 `xl:min-w-[420px] xl:max-w-[680px]`
        로 폭을 못박는다.** 고정 px 가 아니라 비율인 이유는 화면이 커질수록 사진 목록도 같이
        넓어져야 하기 때문이다(400px 고정이던 시절에는 2560 에서도 400px 그대로였다). 하한은
        썸네일 96px + 글이 들어갈 최소치, 상한은 카드 쪽 몫을 지키는 선이다.

        예전엔 이 칸이 `xl:flex-1` 로 남는 폭을 전부 가져갔는데, 그러면 카드가 있는 오른쪽 칸은
        **자기 내용 크기만큼만** 차지해(아래 설명) 남는 폭이 죄다 이 왼쪽 빈 레일로 흡수됐다 —
        1920 폭에서 카드 왼쪽에만 1136px 빈 공간이 남던 결함이 이것이다.

        **오른쪽(세트 바 + 결과)은 `xl:flex-1` 로 남는 폭을 전부 가져간다. 상한을 두지 않는다.**
        예전에 `xl:max-w-[1400px]` 상한이 있었는데, 2560 폭에서 그 상한에 걸려 오른쪽에 372px
        짜리 빈 띠가 남았다 — 페이지 폭을 채우라는 요구와 정면으로 어긋나서 걷어냈다.
        `xl:min-w-0` 은 좁은 xl 폭(1280 근처)에서 내용보다 좁아질 수 있게 하는 안전판이다.

        카드는 세로 비율(`aspect-[4/5]`, `CardCanvas` 소관, 편집 동작은 안 건드린다)을 지키며
        **남는 높이와 폭 중 더 좁은 쪽**에 맞춘다. 오른쪽 칸을 세로 flex 로 나눠 세트 바·툴바는
        제 높이만 쓰고(`flex-none`, 기본값), 카드+캡션 묶음만 `xl:flex-1`로 남는 높이를 전부
        가져간다(아래 결과 section 과 카드 상자 참고). 이 flex 가 실제 픽셀 높이를 가지려면
        조상 사슬에 확정 높이가 있어야 한다 — `StudioFrame` 의 `xl:h-screen`(그 파일 주석 참고)이
        `<main>` 까지 내려주고, 이 컨테이너는 그걸 `xl:h-full` 로 받아 두 칸(왼쪽 레일 전체, 오른쪽
        세트 바+결과)에 flex 기본 정렬(`stretch`)로 물려준다. 카드 상자는 `xl:grid`(자식 기본
        정렬이 `stretch`) 로 카드에 **확정된 세로 높이**를 준다 — `CardCanvas` 는 그 높이를
        받아 `aspect-[4/5]` 로 폭을 역산하고(flexbox/grid 의 "정의된 cross size 에서 aspect-ratio
        로 main size 를 구하는" 표준 동작), `xl:max-h-full`·`max-w-full`(그 파일의 크기 클래스)
        이 그 결과를 상자 안으로 다시 잘라 넣는다. 예전엔 카드 상자에 `xl:items-center` 를 써서
        이 stretch 를 껐었다 — stretch 가 꺼지면 세로 신호가 없어 `CardCanvas` 의 유일한 in-flow
        내용(사진 층은 `absolute` 라 크기 계산에서 빠진다)인 글 텍스트의 자연 폭만큼만 그려졌다.
        이게 카드가 411×514 로 굳어 있던, 화면이 커져도 안 커지던 진짜 원인이다(사진과 무관하게
        헤드라인 글자 폭이 상한이 됐었다). 왼쪽 레일은 내용이 남는 높이보다 길면
        `xl:overflow-y-auto` 로 그 칸 안에서만 스크롤한다 — 카드 쪽을 밀어내지 않는다.

        DOM 순서는 [왼쪽 레일 전체] → [카피 만들기] → [세트 바] → [결과]이고, `xl` flex 는 이
        순서를 배치로만 재배열한다(순서 클래스를 안 쓰므로 DOM 순서 그대로 나열된다). 그 아래
        폭에서는 지금처럼 위아래로 쌓인다.
      */}
      <div className="flex flex-col gap-8 px-5 py-6 sm:px-8 lg:gap-9 lg:px-10 lg:py-9 xl:h-full xl:flex-row xl:gap-x-8 xl:py-3">
        {/* 왼쪽 = 순서 레일 + 카피 만들기. 화면 폭의 34% 를 쓰되 하한 420px·상한 680px —
            화면이 커지면 사진 목록도 같이 넓어지고, 그래도 카드 몫은 지켜진다. 폭을 여기서
            정해야 나머지가 전부 오른쪽(카드)으로 간다. 내용이 넘치면 이 칸 안에서만 스크롤한다. */}
        <div className="flex flex-col gap-8 lg:gap-9 xl:min-h-0 xl:max-w-[680px] xl:min-w-[420px] xl:flex-none xl:basis-[34%] xl:overflow-y-auto">
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
                  onReorder={moveTo}
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
                        ? "행을 누르면 그 카드를 고쳐요. 손잡이를 끌면 사진이 앞뒤 카드로 옮겨요(키보드는 Space 로 집고 화살표로 옮긴 뒤 Space 로 놓아요) — 카피는 자리에 남아요."
                        : "손잡이를 끌면 사진 차례가 바뀌어요(키보드는 Space 로 집고 화살표로 옮긴 뒤 Space 로 놓아요)."}{" "}
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
          오른쪽 = 세트 바 + 결과. `xl:flex-1` 로 왼쪽이 쓰고 남는 폭을 **전부** 가져간다 —
          상한은 두지 않는다(위 그리드 주석 참고). 안쪽은 세로 flex 로 나눈다 —
          세트 바는 제 높이만(`flex-none`, 기본값), 결과 section 은 `xl:flex-1`로 남는 높이를
          가져간다. gap 은 아래 폭(비 xl)에서 쓰던 `gap-8` 을 그대로 두고, xl 에서만 12px 로
          좁힌다 — 세트 바와 카드 사이는 레일 항목 사이보다 붙어도 된다.
        */}
        <div className="flex flex-col gap-8 xl:min-h-0 xl:min-w-0 xl:flex-1 xl:gap-3">
          {/* 세트 바(테마·핸들). 고르면 바로 아래 카드에 반영되는 자리라야 한다. */}
          <WorkbenchSetBar themeId={state.themeId} handle={state.handle} dispatch={dispatch} />

          <section className="flex flex-col gap-4 xl:min-h-0 xl:flex-1 xl:gap-2">
            <SectionHead
              title={card ? `${active + 1}번 카드` : "카드"}
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
                  onRequestFocus={() => setFocusToken((n) => n + 1)}
                />
                {/* 카드 상자 + 캡션을 한 덩어리로 묶는다 — 이 안의 gap(`gap-1`)만 좁혀서 캡션이
                    카드 바로 아래 붙게 하고, section 의 `gap-2`(위 SectionHead·EditToolbar 사이)
                    는 그대로 둔다. 이 묶음 자체가 `xl:flex-1` 로 남는 높이를 전부 받는다.
                    카드 상자는 `xl:grid`(자식 기본 정렬이 `stretch`) 로 — 세로가 stretch 돼야
                    `CardCanvas` 의 `aspect-[4/5]` 가 그 정해진 높이에서 폭을 역산한다(그 파일
                    주석의 "자동 축소"가 실제로 작동하려면 이 stretch 가 필요하다 — `items-center`
                    로 stretch 를 끄면 세로 신호가 없어 텍스트 폭만큼만 작게 그려진다. 이전에
                    `items-center` 를 쓴 것이 바로 카드가 작던 원인이었다. `xl:max-h-full` 이
                    있으니 늘어나도 이 상자를 넘지 않는다). */}
                <div className="flex min-h-0 flex-col gap-1 xl:flex-1">
                  <div className="flex min-h-0 flex-1 justify-center rounded-2xl bg-canvas px-4 py-8 xl:grid xl:py-3">
                    <CardCanvas
                      card={card}
                      photo={photo}
                      target={target}
                      themeId={state.themeId}
                      focusToken={focusToken}
                      onSelect={setTarget}
                      onPatch={(patch) => dispatch({ type: "UPDATE_CARD", index: active, patch })}
                    />
                  </div>
                  <p className="flex-none text-center text-[13px] text-ink-2">
                    고칠 곳을 눌러요. 글은 그 자리에서 바로 고쳐요.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-hair bg-canvas px-6 py-16 text-center">
                <p className="text-[17px] font-bold">사진을 올리고 카피를 만들면 여기에 카드가 나와요</p>
                <p className="text-[14px] text-ink-2">카드마다 헤드라인·본문·사진을 여기서 바로 고쳐요.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </StudioFrame>
  );
}

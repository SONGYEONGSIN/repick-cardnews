"use client";

import { MoveVertical } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { clamp01, textYFromPointer, TEXT_Y_STEP, type TextBounds } from "./text-drag";

/**
 * 글 위치 손잡이. 끌어서도 옮기고 방향키로도 옮긴다.
 *
 * 글 덩어리 **자체를** 끌게 하지 않는다 — 그 자리는 눌러서 글자를 고치는 곳이라 드래그가
 * 텍스트 선택과 싸운다. 그래서 사진의 초점 핸들과 같은 방식으로 **따로 난 손잡이**를 둔다.
 * 다만 초점 핸들과 달리 이 손잡이가 직접 포인터를 받는다(밑에 끌 수 있는 면이 없다).
 *
 * 글 덩어리 **바로 바깥**, 오른쪽 여백(`p-7` = 28px) 안에 선다(`left-full` = 글 덩어리의 오른쪽
 * 끝에서 시작). 글자 클릭 영역을 한 픽셀도 가로채지 않아야 하기 때문이다 — 여기는 눌러서 글을
 * 고치는 주 편집면이라 손잡이가 캐럿을 먹으면 안 된다. 그래서 폭은 여백에 들어가는 24px 이고
 * (WCAG 2.5.8 최소 24px), 대신 끄는 방향인 세로를 44px 로 잡아 세로 그립 모양이 된다.
 * 카드 오른쪽 끝과는 2px 이 남아 좁은 화면에서도 잘리지 않는다 — 여백 폭은 카드 폭과 무관하다.
 *
 * 자리를 클래스로만 잡아 글을 옮겨도 따라오고, 인라인 style 을 하나도 더 쓰지 않는다.
 *
 * 세로로만 움직인다. 좌우 방향키는 흘려보낸다(글 좌우 위치는 이 기능의 범위가 아니다).
 */
export function TextYHandle({
  textY,
  measure,
  onTextY,
}: {
  textY: number;
  /** 끄는 동안 글 영역·글 덩어리 치수를 재는 함수. 부모가 ref 로 잰다 — 전역 DOM 조회를 쓰지 않는다. */
  measure: () => TextBounds | null;
  onTextY: (textY: number) => void;
}) {
  function handleDown(e: React.PointerEvent<HTMLButtonElement>) {
    // 포인터를 잡아 두면 손잡이 밖으로 나가도 드래그가 이어진다 — 끝(0·1)까지 밀 때 필요하다.
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const bounds = measure();
    if (!bounds) return;
    const next = textYFromPointer({ ...bounds, pointerY: e.clientY });
    // 남는 공간이 없으면 옮길 자리도 없다 — 값을 건드리지 않는다.
    if (next !== null) onTextY(next);
  }

  function handleUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function handleKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const dy = e.key === "ArrowUp" ? -TEXT_Y_STEP : e.key === "ArrowDown" ? TEXT_Y_STEP : 0;
    if (dy === 0) return;
    e.preventDefault(); // 방향키로 화면이 같이 스크롤되지 않게
    onTextY(clamp01(textY + dy));
  }

  const percent = Math.round(clamp01(textY) * 100);

  return (
    <button
      type="button"
      // 값이 있는 한 방향 조작이라 슬라이더로 알린다 — 방향키로 값이 바뀌면 현재 값이 다시 읽힌다
      role="slider"
      aria-label="글 위치 — 끌거나 위아래 방향키로 옮겨요"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`위에서 ${percent}%`}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onKeyDown={handleKey}
      // 글 층은 pointer-events 를 꺼 두므로(밑의 사진이 눌려야 한다) 손잡이만 되살린다.
      // touch-none 은 손가락으로 끌 때 화면이 대신 스크롤되는 것을 막는다.
      className={`pointer-events-auto absolute left-full top-1/2 ml-0.5 flex h-11 w-6 -translate-y-1/2 cursor-ns-resize touch-none items-center justify-center rounded-full border-2 border-ink bg-surface ${FOCUS_RING}`}
    >
      <MoveVertical size={13} aria-hidden="true" />
    </button>
  );
}

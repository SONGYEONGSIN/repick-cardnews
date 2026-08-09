"use client";

import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * 끌어서 순서 바꾸기의 **입력 규칙** — 사진 레일과 항목 목록이 **같은 것을 쓴다.**
 *
 * 두 벌로 두면 한쪽만 고쳐진다. 실제로 그랬다: 폰에서 순서가 안 바뀐다는 보고를 받고
 * 보니 두 목록 다 마우스 기준 센서 하나만 달고 있었다(2026-08-09).
 *
 * **왜 마우스와 손가락을 갈랐나.**
 *
 * 예전에는 `PointerSensor` 하나에 `distance: 4` 였다. 마우스에는 맞는 값이다 — 손떨림
 * 4px 는 클릭으로 본다. 그런데 **손가락은 4px 를 무조건 넘긴다.** 목록을 스크롤하려고
 * 쓸어내리는 순간 드래그가 시작되고, 그렇다고 브라우저가 스크롤을 가져가면 드래그가
 * 아예 안 잡힌다. 둘 다 "안 된다" 로 느껴진다.
 *
 * 그래서 손가락에는 **꾹 눌러서 시작**(`delay`)을 쓴다. 짧게 쓸면 평소대로 스크롤되고,
 * 잠깐 누르고 있으면 그때부터 끌린다. `tolerance` 는 누르는 동안 허용할 흔들림이다 —
 * 0으로 두면 손끝이 조금만 밀려도 취소된다.
 *
 * 손잡이에는 `touch-none`(`DRAG_HANDLE_TOUCH`)이 함께 있어야 한다. 없으면 브라우저가
 * 스크롤로 가져가 이 센서까지 오지 않는다.
 */

/** 마우스: 이보다 작은 움직임은 클릭으로 본다. */
const MOUSE_DISTANCE_PX = 4;

/** 손가락: 이만큼 누르고 있으면 드래그 시작. 짧게 쓸면 스크롤이다. */
const TOUCH_DELAY_MS = 200;

/** 누르는 동안 허용하는 흔들림. 이보다 크게 움직이면 스크롤로 본다. */
const TOUCH_TOLERANCE_PX = 8;

/**
 * 드래그 손잡이에 반드시 붙인다. 브라우저가 이 요소의 제스처를 스크롤로 가로채지 않게 한다.
 * 손잡이에만 붙인다 — 줄 전체에 붙이면 목록을 스크롤할 수 없다.
 */
export const DRAG_HANDLE_TOUCH = "touch-none";

export function useSortableSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: MOUSE_DISTANCE_PX } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: TOUCH_TOLERANCE_PX },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

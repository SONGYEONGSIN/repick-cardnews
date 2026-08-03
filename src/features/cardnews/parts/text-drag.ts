/**
 * 캔버스에서 글 덩어리를 위아래로 끌 때 쓰는 환산.
 *
 * 화면(React)과 떼어 둔다 — 이 계산이 이 기능의 핵심이라 단위 테스트로 못을 박아야 한다.
 */

/** 방향키 한 번에 5%. 초점 핸들(CardCanvas 의 FOCAL_STEP)과 같은 감각으로 맞춘다. */
export const TEXT_Y_STEP = 0.05;

/** 끄는 순간의 치수 — 화면에서 재서 넘긴다. */
export type TextBounds = {
  /** 글 영역(패딩 안쪽) 위 끝의 세로 좌표 */
  contentTop: number;
  /** 글 덩어리가 쓰고 남은 공간 — 위·아래 신축 여백이 나눠 갖는 높이 */
  freeSpace: number;
  /** 글 덩어리 자신의 높이 */
  blockHeight: number;
};

export type TextDragGeometry = TextBounds & {
  /** 포인터의 세로 좌표 (clientY) */
  pointerY: number;
};

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * 포인터 세로 좌표를 `textY` 로 바꾼다.
 *
 * `textY` 는 절대 위치가 아니라 **남는 공간(글 영역 높이 − 글 덩어리 높이)을 위아래로 나누는
 * 비율**이다. 그래서 포인터 위치를 영역 높이로 나눠 쓰면 안 된다 — 글 덩어리가 두꺼울수록
 * 손이 커서보다 앞서 나간다. 글 덩어리의 **가운데가 포인터를 따라오게** 두고 풀면:
 *
 *   contentTop + freeSpace × textY + blockHeight / 2 = pointerY
 *   → textY = (pointerY − contentTop − blockHeight / 2) / freeSpace
 *
 * 남는 공간이 0 이하면(글이 영역을 꽉 채우거나 넘칠 때) 옮길 여지 자체가 없다. 0 으로 나누면
 * Infinity·NaN 이 상태로 들어가므로 `null` 로 답해 호출한 쪽이 값을 건드리지 않게 한다.
 */
export function textYFromPointer({
  pointerY,
  contentTop,
  freeSpace,
  blockHeight,
}: TextDragGeometry): number | null {
  if (freeSpace <= 0) return null;
  return clamp01((pointerY - contentTop - blockHeight / 2) / freeSpace);
}

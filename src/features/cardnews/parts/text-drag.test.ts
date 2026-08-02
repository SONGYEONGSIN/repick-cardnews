import { describe, it, expect } from "vitest";
import { textYFromPointer } from "./text-drag";

/**
 * 글 영역(패딩 안쪽)이 100~500(높이 400)이고 글 덩어리가 200 높이인 상황.
 * 남는 공간은 200 이고, textY 는 그 200 을 위아래로 나누는 비율이다.
 */
const geometry = { contentTop: 100, freeSpace: 200, blockHeight: 200 };

describe("textYFromPointer — 포인터 세로 좌표를 textY 로", () => {
  it("글 영역 한가운데를 가리키면 글 덩어리 가운데가 거기 온다", () => {
    expect(textYFromPointer({ ...geometry, pointerY: 300 })).toBeCloseTo(0.5);
  });

  it("글 덩어리 높이를 뺀 남는 공간을 기준으로 환산한다", () => {
    // 포인터 250 → 글 덩어리 가운데(150 만큼 아래)가 250 에 오려면 위 여백이 50 이어야 한다.
    // 50/200 = 0.25 — 좌표 비율((250-100)/400 = 0.375)을 그대로 쓰면 안 된다는 뜻이다.
    expect(textYFromPointer({ ...geometry, pointerY: 250 })).toBeCloseTo(0.25);
  });

  it("글 영역 위 끝보다 위를 가리켜도 0 을 넘어가지 않는다", () => {
    expect(textYFromPointer({ ...geometry, pointerY: 0 })).toBe(0);
  });

  it("글 영역 아래 끝보다 아래를 가리켜도 1 을 넘어가지 않는다", () => {
    expect(textYFromPointer({ ...geometry, pointerY: 900 })).toBe(1);
  });

  it("남는 공간이 0 이면 옮길 여지가 없다 — 0 으로 나누지 않는다", () => {
    expect(textYFromPointer({ contentTop: 100, freeSpace: 0, blockHeight: 400, pointerY: 300 })).toBeNull();
  });

  it("글이 영역보다 커서 남는 공간이 음수여도 옮기지 않는다", () => {
    expect(textYFromPointer({ contentTop: 100, freeSpace: -60, blockHeight: 460, pointerY: 300 })).toBeNull();
  });
});

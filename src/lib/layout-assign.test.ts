import { describe, it, expect } from "vitest";
import { assignLayouts, CARD_LAYOUTS, LAYOUT_LABELS } from "@/lib/layout-assign";

describe("assignLayouts", () => {
  it("5장이면 표지 full-bleed · 중간 split · 마지막 text-only", () => {
    expect(assignLayouts(5)).toEqual(["full-bleed", "split", "split", "split", "text-only"]);
  });
  it("6장도 같은 규칙을 따른다", () => {
    expect(assignLayouts(6)).toEqual(["full-bleed", "split", "split", "split", "split", "text-only"]);
  });
  it("2장이면 표지와 마무리만 남는다", () => {
    expect(assignLayouts(2)).toEqual(["full-bleed", "text-only"]);
  });
  it("1장이면 full-bleed 하나다", () => {
    expect(assignLayouts(1)).toEqual(["full-bleed"]);
  });
  it("0장이면 빈 배열이다", () => {
    expect(assignLayouts(0)).toEqual([]);
  });
});

describe("카탈로그", () => {
  it("레이아웃은 3종이다", () => {
    expect(CARD_LAYOUTS).toEqual(["full-bleed", "split", "text-only"]);
  });
  it("모든 레이아웃에 한국어 라벨이 있다", () => {
    for (const id of CARD_LAYOUTS) expect(LAYOUT_LABELS[id].length).toBeGreaterThan(0);
  });
});

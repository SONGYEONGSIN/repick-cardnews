import { describe, expect, it } from "vitest";
import {
  BOX_PRESETS,
  DEFAULT_TEXT_BOX,
  boxBackground,
  clampOpacity,
  readabilityWarning,
} from "./text-box";

describe("clampOpacity", () => {
  it("0~1 밖으로 나가지 않는다", () => {
    expect(clampOpacity(-0.5)).toBe(0);
    expect(clampOpacity(1.5)).toBe(1);
  });

  it("안쪽 값은 그대로 둔다", () => {
    expect(clampOpacity(0.62)).toBe(0.62);
  });

  // 슬라이더에서 온 값이 문자열이거나 NaN 이 될 수 있다. 그때 카드가 사라지면 안 된다.
  it("숫자가 아니면 기본값으로 떨어진다", () => {
    expect(clampOpacity(Number.NaN)).toBe(DEFAULT_TEXT_BOX.opacity);
  });
});

describe("boxBackground", () => {
  it("색과 불투명도를 rgba 로 합친다", () => {
    expect(boxBackground("#000000", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
    expect(boxBackground("#ffffff", 1)).toBe("rgba(255, 255, 255, 1)");
  });

  it("세 자리 hex 도 읽는다", () => {
    expect(boxBackground("#fff", 0.2)).toBe("rgba(255, 255, 255, 0.2)");
  });

  // 색 고르기 칸에서 이상한 값이 올 수 있다. 카드가 깨지느니 안 그린다.
  it("색을 못 읽으면 null — 상자를 그리지 않는다", () => {
    expect(boxBackground("초록색", 0.5)).toBeNull();
    expect(boxBackground("", 0.5)).toBeNull();
  });
});

describe("readabilityWarning", () => {
  // 자유롭게 고르게 한 대가다 — 안 읽히는 조합을 막지는 않되 **말은 해 준다.**
  it("검은 상자에 흰 글자는 괜찮다", () => {
    expect(readabilityWarning("#ffffff", "#000000", 0.85)).toBeNull();
  });

  it("같은 색끼리는 경고한다", () => {
    const msg = readabilityWarning("#222222", "#222222", 1);
    expect(msg).toMatch(/[가-힣]/);
  });

  it("상자가 거의 투명하면 상자 색으로 판단하지 않는다 — 사진이 그대로 비친다", () => {
    // 흰 글자 + 흰 상자라도 상자가 투명하면 그 조합으로 재는 것이 무의미하다.
    expect(readabilityWarning("#ffffff", "#ffffff", 0.05)).toBeNull();
  });

  it("색을 못 읽으면 조용히 넘어간다", () => {
    expect(readabilityWarning("초록", "#000000", 1)).toBeNull();
  });
});

describe("BOX_PRESETS", () => {
  it("자주 쓰는 색을 손쉽게 고를 수 있다", () => {
    expect(BOX_PRESETS.length).toBeGreaterThanOrEqual(2);
    for (const p of BOX_PRESETS) {
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.label).toMatch(/[가-힣]/);
    }
  });
});

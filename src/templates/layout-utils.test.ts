import { describe, it, expect } from "vitest";
import {
  objectPosition,
  scrimGradient,
  DEFAULT_FOCAL,
  DEFAULT_SCRIM,
  DEFAULT_BAND_CARDNEWS,
  DEFAULT_BAND_INFO,
} from "@/templates/layout-utils";

describe("objectPosition", () => {
  it("0~1 좌표를 퍼센트로 바꾼다", () => {
    expect(objectPosition({ x: 0.5, y: 0.3 })).toBe("50% 30%");
  });
  it("반올림해 정수 퍼센트로 만든다", () => {
    expect(objectPosition({ x: 0.333, y: 0.666 })).toBe("33% 67%");
  });
  it("범위를 벗어나면 0~100으로 자른다", () => {
    expect(objectPosition({ x: -1, y: 2 })).toBe("0% 100%");
  });
  it("기본 초점은 정중앙이다", () => {
    expect(objectPosition(DEFAULT_FOCAL)).toBe("50% 50%");
  });
});

describe("scrimGradient", () => {
  it("아래에서 위로 옅어지는 그라데이션을 만든다", () => {
    expect(scrimGradient(0.8)).toBe(
      "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 34%, rgba(0,0,0,0) 68%)",
    );
  });
  it("강도를 0~1로 자른다", () => {
    expect(scrimGradient(2)).toContain("rgba(0,0,0,1)");
    expect(scrimGradient(-1)).toContain("rgba(0,0,0,0) 0%");
  });
  it("소수 둘째 자리로 반올림해 결정론을 지킨다", () => {
    expect(scrimGradient(0.333)).toContain("rgba(0,0,0,0.33)");
  });
});

describe("기본값", () => {
  it("스크림 기본값은 대비를 확보하는 0.72다", () => {
    expect(DEFAULT_SCRIM).toBe(0.72);
  });
  it("밴드 기본값은 카드뉴스 0.6 · 정보전달 0.35다", () => {
    expect(DEFAULT_BAND_CARDNEWS).toBe(0.6);
    expect(DEFAULT_BAND_INFO).toBe(0.35);
  });
});

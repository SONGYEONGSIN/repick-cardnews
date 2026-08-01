import { describe, it, expect } from "vitest";
import { relativeLuminance, contrastRatio } from "@/lib/contrast";

describe("relativeLuminance", () => {
  it("흰색은 1, 검정은 0 이다", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("3자리 축약형도 읽는다", () => {
    expect(relativeLuminance("#fff")).toBeCloseTo(relativeLuminance("#FFFFFF"), 5);
  });

  it("hex 가 아니면 거부한다", () => {
    expect(() => relativeLuminance("rgb(0,0,0)")).toThrow(/hex/);
  });
});

describe("contrastRatio", () => {
  it("흰 배경 위 검정은 21:1 이다", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  it("같은 색끼리는 1:1 이다", () => {
    expect(contrastRatio("#7A2E6B", "#7A2E6B")).toBeCloseTo(1, 5);
  });

  it("순서를 바꿔도 같은 값이다", () => {
    expect(contrastRatio("#7A2E6B", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#7A2E6B"), 5);
  });

  it("plum 은 흰 배경에서 8.64:1 이다", () => {
    expect(contrastRatio("#7A2E6B", "#FFFFFF")).toBeCloseTo(8.64, 1);
  });

  it("현재 ink3 는 흰 배경에서 AA 본문 기준에 못 미친다", () => {
    // Lighthouse 실측 3.51:1 — 이 계획이 고치려는 결함
    expect(contrastRatio("#8B8791", "#FFFFFF")).toBeLessThan(4.5);
  });
});

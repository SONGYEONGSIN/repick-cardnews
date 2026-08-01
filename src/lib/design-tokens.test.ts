import { describe, it, expect } from "vitest";
import { contrastRatio } from "@/lib/contrast";
import { colors } from "@/lib/design-tokens";

/** WCAG AA: 본문 4.5:1, 대형·UI 요소 3:1 */
const AA_BODY = 4.5;
const AA_LARGE = 3;

describe("본문·보조 텍스트 대비", () => {
  it("ink 는 모든 표면에서 본문 기준을 넘는다", () => {
    for (const bg of [colors.surface, colors.canvas, colors.hairSoft]) {
      expect(contrastRatio(colors.ink, bg)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("ink2 는 muted 표면 위에서도 본문 기준을 넘는다", () => {
    for (const bg of [colors.surface, colors.canvas, colors.hairSoft]) {
      expect(contrastRatio(colors.ink2, bg)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("ink3 는 순백·canvas 에서 본문 기준을 넘는다", () => {
    expect(contrastRatio(colors.ink3, colors.surface)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(colors.ink3, colors.canvas)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("ink3 는 muted 표면에서 기준에 못 미친다 — 그래서 그 위에서는 ink2 를 쓴다", () => {
    // 이 사실이 'muted 표면에서는 ink2' 규칙의 근거다. 값이 바뀌면 규칙도 다시 봐야 한다.
    expect(contrastRatio(colors.ink3, colors.hairSoft)).toBeLessThan(AA_BODY);
  });
});

describe("액센트 대비", () => {
  it("plum 위의 흰 글자가 본문 기준을 넘는다", () => {
    for (const bg of [colors.plum, colors.plumHover, colors.plumActive]) {
      expect(contrastRatio(colors.surface, bg)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("plumSoft 배경 위의 plum 글자가 본문 기준을 넘는다", () => {
    expect(contrastRatio(colors.plum, colors.plumSoft)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("plum 은 흰 배경에서 UI 요소 기준을 넘는다", () => {
    expect(contrastRatio(colors.plum, colors.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe("상태 색 대비", () => {
  it("warn 조합이 본문 기준을 넘는다", () => {
    expect(contrastRatio(colors.warnInk, colors.warnSoft)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("danger 가 흰 배경에서 본문 기준을 넘는다", () => {
    expect(contrastRatio(colors.danger, colors.surface)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe("경계선", () => {
  it("hair 가 캔버스와 구분된다", () => {
    expect(contrastRatio(colors.hair, colors.canvas)).toBeGreaterThan(1.2);
  });
});

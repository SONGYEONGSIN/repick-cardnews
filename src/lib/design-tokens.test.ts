import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { contrastRatio } from "@/lib/contrast";
import { colors, utilityName } from "@/lib/design-tokens";

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

/**
 * `colors` 는 브라우저가 읽지 않는다 — 실제로 렌더되는 값은 globals.css 의
 * `@theme inline` 블록에 중복된 리터럴이다. 이 스위트는 그 둘이 계속 같은 값을
 * 갖도록 bijection 을 고정한다: colors 의 모든 키가 같은 값의 `--color-*` 로 있고,
 * globals.css 에 colors 에 없는 `--color-*` 가 없다.
 */
describe("globals.css 와 색상 토큰 동기화", () => {
  function parseThemeColors(): Map<string, string> {
    const css = readFileSync("src/app/globals.css", "utf8");
    const themeBlock = css.match(/@theme inline\s*\{([\s\S]*?)\}/);
    if (!themeBlock) throw new Error("globals.css 에서 @theme inline 블록을 찾지 못했습니다");
    const found = new Map<string, string>();
    const colorDecl = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/g;
    let m: RegExpExecArray | null;
    while ((m = colorDecl.exec(themeBlock[1]))) {
      found.set(m[1], m[2].toLowerCase());
    }
    return found;
  }

  it("파서가 실제로 선언을 읽는다 — 매칭 0건이면 아래 테스트가 공허하게 통과한다", () => {
    expect(parseThemeColors().size).toBeGreaterThan(0);
  });

  it("colors 의 모든 토큰이 globals.css 에 같은 값의 --color-* 로 있다", () => {
    const cssColors = parseThemeColors();
    for (const [key, hex] of Object.entries(colors)) {
      const name = utilityName(key);
      expect(cssColors.get(name), `--color-${name} 이 globals.css 에 없거나 값이 다름`).toBe(
        hex.toLowerCase()
      );
    }
  });

  it("globals.css 에 colors 에 없는 --color-* 항목이 없다", () => {
    const cssColors = parseThemeColors();
    const expectedNames = new Set(Object.keys(colors).map(utilityName));
    const extra = [...cssColors.keys()].filter((name) => !expectedNames.has(name));
    expect(extra).toEqual([]);
  });
});

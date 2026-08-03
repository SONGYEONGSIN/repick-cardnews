import { describe, it, expect } from "vitest";
import { contrastRatio } from "@/lib/contrast";
import { THEMES, THEME_IDS, type ThemeId } from "./themes";

/**
 * 테마는 데이터 파일 한 곳에서 늘어난다(`themes.ts`) — 늘리는 건 쉬운데, **읽기 힘든 조합이
 * 들어가도 아무도 안 막던 상태**였다. 여기서 잠근다.
 *
 * 기준값은 2026-08-03 기준 기존 세 테마의 실측 최저치에서 잡았다:
 * `fg/bg` 14.09 · `accent/bg` 3.44 · `fg/highlight` 11.34.
 * 새 테마가 그보다 눈에 띄게 나빠지지 않게 하되, 디자인 여지를 남겨 문턱은 아래로 둔다.
 */

/** 본문 글자 — WCAG AAA(7:1)를 넘긴다. 카드 글은 사진 위에 겹치기도 해 여유를 둔다. */
const MIN_FG_ON_BG = 7;
/** accent 는 CTA 알약처럼 **큰 글자·UI 요소**에 쓴다 — AA 큰 글자 기준 3:1. */
const MIN_ACCENT_ON_BG = 3;
/** 형광 위에 글이 그대로 올라간다 — 형광이 진하면 글이 묻힌다. AA 본문 기준 4.5:1. */
const MIN_FG_ON_HIGHLIGHT = 4.5;

/** 대소문자는 섞여 있어도 된다 — `contrastRatio` 가 둘 다 다룬다(기존 값이 대문자다). */
const HEX = /^#[0-9a-fA-F]{6}$/;

describe("THEMES — 목록", () => {
  it("여섯 개이고 id 가 THEME_IDS 와 일치한다", () => {
    expect(THEME_IDS).toEqual([
      "violet-doodle",
      "mint-clean",
      "mono-bold",
      "warm-cream",
      "navy-classic",
      "green-natural",
    ]);
    expect(Object.keys(THEMES)).toHaveLength(6);
  });

  it("이름은 전부 한국어다 — 툴바에 그대로 나간다", () => {
    for (const id of THEME_IDS) {
      expect(THEMES[id].label).not.toMatch(/[A-Za-z]/);
    }
  });

  it("이름이 겹치지 않는다", () => {
    const labels = THEME_IDS.map((id) => THEMES[id].label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("THEMES — 색 값 형식", () => {
  it("색은 전부 6자리 hex 다 — 축약형(#abc)이나 rgb() 는 대비 계산이 못 읽는다", () => {
    for (const id of THEME_IDS) {
      const t = THEMES[id];
      for (const [field, value] of Object.entries({
        bg: t.bg,
        fg: t.fg,
        accent: t.accent,
        highlight: t.highlight,
        onPhoto: t.onPhoto,
      })) {
        expect({ where: `${id}.${field}`, ok: HEX.test(value) }).toEqual({ where: `${id}.${field}`, ok: true });
      }
    }
  });

  it("글꼴은 layout.tsx 가 실제로 불러오는 것만 쓴다", () => {
    // 새 글꼴을 쓰려면 src/app/layout.tsx 의 구글 폰트 링크에 먼저 추가해야 한다 —
    // 안 하면 조용히 기본 글꼴로 떨어져 테마가 반쯤만 적용된다.
    const loaded = ["Gaegu", "Do Hyeon"];
    for (const id of THEME_IDS) {
      expect(loaded.some((f) => THEMES[id].displayFont.includes(f))).toBe(true);
    }
  });
});

describe("THEMES — 읽을 수 있어야 한다", () => {
  it.each(THEME_IDS)("%s 는 글자/배경 대비가 충분하다", (id: ThemeId) => {
    expect(contrastRatio(THEMES[id].fg, THEMES[id].bg)).toBeGreaterThanOrEqual(MIN_FG_ON_BG);
  });

  it.each(THEME_IDS)("%s 는 accent/배경 대비가 충분하다", (id: ThemeId) => {
    expect(contrastRatio(THEMES[id].accent, THEMES[id].bg)).toBeGreaterThanOrEqual(MIN_ACCENT_ON_BG);
  });

  it.each(THEME_IDS)("%s 는 형광 위 글자가 읽힌다", (id: ThemeId) => {
    expect(contrastRatio(THEMES[id].fg, THEMES[id].highlight)).toBeGreaterThanOrEqual(MIN_FG_ON_HIGHLIGHT);
  });

  // 사진 위 글자는 어두운 스크림 위에 얹힌다(`layout-utils` 의 scrimGradient) — 밝아야 한다.
  it.each(THEME_IDS)("%s 의 사진 위 글자색은 검정 스크림 위에서 읽힌다", (id: ThemeId) => {
    expect(contrastRatio(THEMES[id].onPhoto, "#000000")).toBeGreaterThanOrEqual(MIN_FG_ON_BG);
  });
});

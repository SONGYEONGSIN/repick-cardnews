/**
 * 카드 다섯 장 전체에 걸리는 색·글꼴 묶음. **여기만 늘리면 툴바·캔버스·저장 결과가 다 따라온다**
 * (`THEME_IDS` 가 이 객체에서 파생된다).
 *
 * 새 테마를 넣을 때 지켜야 할 두 가지 — `themes.test.ts` 가 잠근다:
 * 1. **명암비** — 글자/배경, accent/배경, 형광 위 글자가 읽혀야 한다
 * 2. **글꼴** — `src/app/layout.tsx` 의 구글 폰트 링크가 실제로 불러오는 것만 쓴다.
 *    새 글꼴을 쓰려면 그 링크에 먼저 추가한다(안 하면 조용히 기본 글꼴로 떨어진다)
 */
export type ThemeId =
  | "violet-doodle"
  | "mint-clean"
  | "mono-bold"
  | "warm-cream"
  | "navy-classic"
  | "green-natural";

export type Theme = {
  label: string;
  bg: string;
  fg: string;
  accent: string;
  highlight: string;
  displayFont: string;
  /** 사진 위 스크림에 얹는 텍스트 색 */
  onPhoto: string;
};

export const THEMES: Record<ThemeId, Theme> = {
  "violet-doodle": {
    label: "보라 두들",
    bg: "#fbfaff",
    fg: "#1a1330",
    accent: "#6E56CF",
    highlight: "#e9defb",
    displayFont: '"Gaegu", cursive',
    onPhoto: "#ffffff",
  },
  "mint-clean": {
    label: "민트 클린",
    bg: "#ffffff",
    fg: "#16302a",
    accent: "#0f9d76",
    highlight: "#fff6a8",
    displayFont: '"Do Hyeon", sans-serif',
    onPhoto: "#ffffff",
  },
  "mono-bold": {
    label: "모노 볼드",
    bg: "#0f0f10",
    fg: "#ffffff",
    accent: "#ff5a36",
    highlight: "#3a3a3d",
    displayFont: '"Do Hyeon", sans-serif',
    onPhoto: "#ffffff",
  },
  // 아래 셋은 30~40대 맘 생활 정보를 겨냥해 더한 것이다(2026-08-03). 기존 두 글꼴을 다시
  // 조합했다 — 새 글꼴을 불러오지 않아 로딩이 늘지 않는다.
  "warm-cream": {
    label: "따뜻한 크림",
    bg: "#fffaf3",
    fg: "#2b1d12",
    accent: "#b4471f",
    highlight: "#ffe3c2",
    displayFont: '"Do Hyeon", sans-serif',
    onPhoto: "#ffffff",
  },
  "navy-classic": {
    label: "네이비 클래식",
    bg: "#f7f9fc",
    fg: "#101f3a",
    accent: "#1f4e9c",
    highlight: "#d6e4ff",
    displayFont: '"Do Hyeon", sans-serif',
    onPhoto: "#ffffff",
  },
  "green-natural": {
    label: "그린 내추럴",
    bg: "#f6faf3",
    fg: "#16281a",
    accent: "#2f6b34",
    highlight: "#dcf0cd",
    displayFont: '"Gaegu", cursive',
    onPhoto: "#ffffff",
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

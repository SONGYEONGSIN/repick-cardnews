export type ThemeId = "violet-doodle" | "mint-clean" | "mono-bold";

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
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

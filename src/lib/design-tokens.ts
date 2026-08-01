/**
 * 스튜디오 UI 디자인 토큰.
 *
 * 중성색은 zinc 계열 순백 기반("진짜 라이트")이고 액센트는 plum 하나뿐이다.
 * 조합별 명암비는 `design-tokens.test.ts` 가 고정한다 — 값을 바꾸면 그 테스트가 잡는다.
 *
 * `ink3` 는 순백·canvas 표면 전용이다. hairSoft 이상 muted 표면 위 보조 텍스트에는
 * `ink2` 를 써야 한다 (ink3 는 hairSoft 위에서 4.39:1 로 AA 미달).
 */
export const colors = {
  canvas: "#FAFAFA",
  surface: "#FFFFFF",
  hairSoft: "#F4F4F5",
  hair: "#E4E4E7",
  ink: "#18181B",
  ink2: "#52525B",
  ink3: "#71717A",
  /** 비활성 컨트롤 전용. WCAG 는 비활성 요소를 대비 요건에서 면제한다. */
  inkDisabled: "#A1A1AA",
  plum: "#7A2E6B",
  plumHover: "#66255A",
  plumActive: "#521D48",
  plumSoft: "#F6EAF3",
  /** 경고 뱃지 전용 amber 쌍. 액센트(plum)와 겹치지 않게 별도로 유지한다. */
  warnSoft: "#FDF1E7",
  warnInk: "#8A4B12",
  danger: "#B4231F",
} as const;

export const radii = {
  control: "0.5rem",
  panel: "0.75rem",
} as const;

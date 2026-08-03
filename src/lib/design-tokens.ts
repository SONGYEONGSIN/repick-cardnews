/**
 * 스튜디오 UI 디자인 토큰.
 *
 * 중성색은 zinc 계열 순백 기반("진짜 라이트")이고 액센트는 plum 하나뿐이다.
 * 조합별 명암비는 `design-tokens.test.ts` 가 고정한다 — 값을 바꾸면 그 테스트가 잡는다.
 *
 * `ink3` 는 순백·canvas 표면 전용이다. hairSoft 이상 muted 표면 위 보조 텍스트에는
 * `ink2` 를 써야 한다 (ink3 는 hairSoft 위에서 4.39:1 로 AA 미달).
 *
 * **주의**: 이 객체는 브라우저가 읽지 않는다 — 실제 렌더 값은 `src/app/globals.css` 의
 * `@theme inline` 블록에 별도로 선언돼 있다. `design-tokens.test.ts` 의 "globals.css 와
 * 색상 토큰 동기화" 스위트가 둘이 같은 값을 갖도록 bijection 을 고정한다 — globals.css 만
 * 고쳐도 그 테스트가 잡는다. 여기 값만 바꾸고 globals.css 를 안 고치면 테스트가 잡지만,
 * 대비 계산 자체는 이 파일의 값을 기준으로 하므로 두 파일을 항상 같이 고쳐야 한다.
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

/**
 * TS 토큰 키를 Tailwind CSS 변수/유틸 이름으로 변환.
 * hairSoft → hair-soft, ink2 → ink-2.
 *
 * `design-tokens.test.ts` 의 globals.css 동기화 테스트와 `design-gate.test.ts` 가
 * 공유한다 — 사본을 두면 그 자체가 이 함수가 막으려는 중복이 된다.
 */
export function utilityName(key: string): string {
  return key.replace(/([A-Z])/g, "-$1").replace(/(\d)/g, "-$1").toLowerCase();
}

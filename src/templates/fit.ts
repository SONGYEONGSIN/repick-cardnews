/**
 * 카드 안 여백·크기 손잡이.
 *
 * 값은 **배수**다 — 자동 규칙(항목 5개 이상이면 타이포가 줄어드는 `compact`)을 그대로 두고 그
 * 위에 곱한다. 1 이면 지금까지와 똑같다. 절대 px 로 저장하면 `compact` 가 켜지고 꺼질 때
 * 맞춰 둔 값이 엉뚱해지지만, 배수는 어느 쪽에서도 "조금 크게/작게"라는 뜻을 유지한다.
 *
 * 순수 함수다 — 이 저장소 vitest 는 `environment: "node"` 라 화면을 못 그린다.
 */

export type Fit = {
  /** 글자 크기 */
  text: number;
  /** 항목 사이 간격 */
  gap: number;
  /** 카드 안쪽 위아래 여백 */
  pad: number;
};

export const DEFAULT_FIT: Fit = { text: 1, gap: 1, pad: 1 };

/** 손잡이가 움직일 수 있는 범위. 화면(`InfoToolbar`)이 이 값으로 눈금을 만든다. */
export const FIT_RANGE = {
  text: { min: 0.8, max: 1.2 },
  gap: { min: 0.5, max: 2 },
  pad: { min: 0.5, max: 1.5 },
} as const;

function clampOne(value: number, key: keyof Fit): number {
  if (!Number.isFinite(value)) return DEFAULT_FIT[key];
  const { min, max } = FIT_RANGE[key];
  return Math.min(max, Math.max(min, value));
}

export function clampFit(fit: Fit): Fit {
  return { text: clampOne(fit.text, "text"), gap: clampOne(fit.gap, "gap"), pad: clampOne(fit.pad, "pad") };
}

/** 기준 px 에 배수를 곱해 실제 px 를 낸다. 소수 px 는 글꼴을 흐리게 만들어 정수로 떨어뜨린다. */
export function sizeWith(base: number, multiplier: number): number {
  return Math.max(1, Math.round(base * multiplier));
}

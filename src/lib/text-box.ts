import { contrastRatio } from "@/lib/contrast";

/**
 * 글 뒤에 까는 **상자** — 사진 위 글이 안 읽힐 때 쓴다.
 *
 * 사진 전체를 어둡게 하는 `scrim` 과 다르다. scrim 은 사진을 죽이고, 이 상자는 **글이 있는
 * 자리만** 덮는다 — 참고로 받은 인스타 게시물들이 전부 이 방식이었다(2026-08-09).
 *
 * 색은 사용자가 자유롭게 고른다. 그래서 **안 읽히는 조합이 나올 수 있는데, 막지 않고 말해
 * 준다**(`readabilityWarning`) — 고르는 자유를 준 이상 대신 정해 주지 않는다.
 *
 * raw hex 가 여기 있는 것은 정당하다: `src/lib` 은 색을 다루는 자리다(`design-gate.test.ts`
 * 주석 참고). 화면 컴포넌트는 이 함수가 만든 값만 받는다.
 */

export type TextBox = { color: string; opacity: number };

/** 처음 켰을 때 값 — 참고 사진들이 쓰던 "거의 검정, 살짝 비침" 에 맞췄다. */
export const DEFAULT_TEXT_BOX: TextBox = { color: "#111111", opacity: 0.62 };

/** 색 고르기 전에 손쉽게 집는 자리. 자유 선택을 막지 않고 **빠른 길**만 둔다. */
export const BOX_PRESETS: readonly { color: string; label: string }[] = [
  { color: "#111111", label: "검정" },
  { color: "#ffffff", label: "흰색" },
];

export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TEXT_BOX.opacity;
  return Math.min(1, Math.max(0, value));
}

function toRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const body = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [
    Number.parseInt(body.slice(0, 2), 16),
    Number.parseInt(body.slice(2, 4), 16),
    Number.parseInt(body.slice(4, 6), 16),
  ];
}

/** 못 읽는 색이면 `null` — 카드가 깨지느니 상자를 안 그린다. */
export function boxBackground(color: string, opacity: number): string | null {
  const rgb = toRgb(color);
  if (!rgb) return null;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clampOpacity(opacity)})`;
}

/** 이 아래로 옅으면 상자보다 사진이 더 많이 비친다 — 상자 색으로 명암비를 재는 게 무의미하다. */
const OPAQUE_ENOUGH = 0.35;

/** 본문 기준으로 흔히 쓰는 최소 명암비. 큰 글자만 있는 카드라 4.5 대신 3 을 쓴다. */
const MIN_RATIO = 3;

/**
 * 안 읽힐 것 같으면 한 줄로 말한다. 괜찮으면 `null` — 잘 된 일에는 말을 붙이지 않는다.
 *
 * **막지는 않는다.** 자유롭게 고르겠다고 정했으므로, 판단은 사람이 한다.
 */
export function readabilityWarning(textColor: string, boxColor: string, opacity: number): string | null {
  if (clampOpacity(opacity) < OPAQUE_ENOUGH) return null;
  if (!toRgb(textColor) || !toRgb(boxColor)) return null;
  return contrastRatio(textColor, boxColor) < MIN_RATIO
    ? "글자와 상자 색이 비슷해서 잘 안 읽힐 수 있어요."
    : null;
}

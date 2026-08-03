export type CardLayout = "full-bleed" | "split" | "text-only";

export const CARD_LAYOUTS = ["full-bleed", "split", "text-only"] as const satisfies readonly CardLayout[];

export const LAYOUT_LABELS: Record<CardLayout, string> = {
  "full-bleed": "사진 전면",
  split: "사진 + 글",
  "text-only": "글만",
};

/**
 * **전부 사진 전면으로 시작한다.**
 *
 * 예전에는 표지만 full-bleed, 마무리(CTA)는 text-only, 가운데는 split 으로 섞었다. 사진이
 * 카드뉴스의 축인데 넘겨 보다 보면 구성이 계속 바뀌어 한 덩어리로 안 읽힌다는 요청으로
 * 전부 사진 전면으로 바꿨다(2026-08-04).
 *
 * **여기는 시작값일 뿐이다** — 카드마다 툴바 '카드' 탭의 구성에서 따로 바꿀 수 있다.
 */
export function assignLayouts(count: number): CardLayout[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, () => "full-bleed");
}

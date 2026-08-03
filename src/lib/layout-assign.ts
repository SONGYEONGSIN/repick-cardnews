export type CardLayout = "full-bleed" | "split" | "text-only";

export const CARD_LAYOUTS = ["full-bleed", "split", "text-only"] as const satisfies readonly CardLayout[];

export const LAYOUT_LABELS: Record<CardLayout, string> = {
  "full-bleed": "사진 전면",
  split: "사진 + 글",
  "text-only": "글만",
};

/** 표지는 사진을 꽉 채우고, 마무리(CTA)는 글만 남기는 것이 기본 문법이다. */
export function assignLayouts(count: number): CardLayout[] {
  if (count <= 0) return [];
  if (count === 1) return ["full-bleed"];
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? "full-bleed" : i === count - 1 ? "text-only" : "split",
  );
}

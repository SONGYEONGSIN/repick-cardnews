import { itemRangeOf, itemTexts, type InfoFormat, type InfoItem, type InfographicSpec } from "@/lib/schema";

/**
 * 형식을 고르고 바꾸는 판단.
 *
 * 형식은 **카피를 만들기 전에** 고른다 — 담는 정보가 달라(비교는 양쪽 값, 숫자는 수치)
 * 나중에 바꾸면 카피를 다시 만들어야 한다. 순수 함수다.
 */

/**
 * 형식을 바꾼 뒤 알릴 말. 알릴 게 없으면 `null`.
 *
 * 형식을 바꾸면 항목이 그 형식의 **빈 항목**으로 갈린다(`seedItemsFor`). 그 상태가 곧
 * "다시 만들거나 직접 채워야 한다" 는 뜻이다 — 이전 형식을 따로 기억하지 않아도 안다.
 */
export function formatChangeWarning(items: readonly InfoItem[] | null): string | null {
  if (!items || items.length === 0) return null;
  const allBlank = items.every((item) => itemTexts(item).every((text) => text.trim().length === 0));
  return allBlank ? "형식을 바꿨어요. 카피를 다시 만들거나 항목을 직접 채워 주세요." : null;
}

/**
 * 그 형식의 **빈 항목**을 최소 개수만큼. 형식을 바꾼 직후 카피를 다시 만들기 전에도 화면이
 * 깨지지 않게 한다 — 이전 형식의 항목은 칸이 달라 그대로 옮길 수 없다.
 */
export function seedItemsFor(format: InfoFormat): InfoItem[] {
  const { min } = itemRangeOf(format);
  const one = (): InfoItem => {
    switch (format) {
      case "compare":
        return { label: "", left: "", right: "" };
      case "stat":
        return { value: "", label: "" };
      case "check":
        return { text: "" };
      default:
        return { keyword: "", desc: "" };
    }
  };
  return Array.from({ length: min }, one);
}

/**
 * 형식을 바꿀 때 갈아 끼울 **스펙 전체**. 항목만 바꾸면 형식마다 따로 있는 칸이 빠진다 —
 * 비교형의 `columns` 가 없으면 카드를 그리다 죽는다(2026-08-05 실제로 그랬다).
 *
 * 공통 글(제목·부제·팁)은 남긴다: 형식이 달라도 그 글은 그대로 쓸 수 있다.
 */
export function reshapeSpec(spec: InfographicSpec, format: InfoFormat): InfographicSpec {
  const common = { type: spec.type, title: spec.title, subtitle: spec.subtitle, tip: spec.tip };
  const items = seedItemsFor(format);
  if (format === "compare") {
    return { ...common, format, columns: { left: "", right: "" }, items } as InfographicSpec;
  }
  // 다른 형식에는 `columns` 가 없다 — 남겨 두면 스키마가 거절한다.
  return { ...common, format, items } as InfographicSpec;
}

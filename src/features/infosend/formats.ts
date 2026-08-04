import { itemRangeOf, itemTexts, type InfoFormat, type InfoItem } from "@/lib/schema";

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

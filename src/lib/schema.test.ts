import { describe, it, expect } from "vitest";
import { InfographicSpec, CardnewsSpec, CardnewsCard } from "@/lib/schema";
import { MAX_STEPS } from "@/features/cardnews/parts/EditToolbar";
import { infographicFixture, cardnewsFixture } from "@/lib/fixtures";

describe("InfographicSpec", () => {
  it("유효한 픽스처를 통과시킨다", () => {
    expect(InfographicSpec.safeParse(infographicFixture).success).toBe(true);
  });
  it("items가 2개 이하면 거부한다", () => {
    const bad = { ...infographicFixture, items: infographicFixture.items.slice(0, 2) };
    expect(InfographicSpec.safeParse(bad).success).toBe(false);
  });
});

describe("CardnewsSpec", () => {
  it("유효한 픽스처를 통과시킨다", () => {
    expect(CardnewsSpec.safeParse(cardnewsFixture).success).toBe(true);
  });
  it("첫 카드가 hook이 아니면 거부한다", () => {
    const bad = { ...cardnewsFixture, cards: [...cardnewsFixture.cards].reverse() };
    expect(CardnewsSpec.safeParse(bad).success).toBe(false);
  });
  it("마지막 카드가 cta가 아니면 거부한다", () => {
    const bad = { ...cardnewsFixture, cards: cardnewsFixture.cards.slice(0, -1) };
    expect(CardnewsSpec.safeParse(bad).success).toBe(false);
  });
});

// 툴바의 "단계 추가" 상한(`MAX_STEPS`)은 이 스키마의 `.max(5)` 를 손으로 베낀 값이다.
// 스키마가 줄면 툴바가 스키마에 없는 데이터를 만들게 되므로 여기서 묶는다.
describe("SolutionCard.steps 상한 ↔ 툴바 MAX_STEPS", () => {
  const base = { role: "solution" as const, heading: "제목", body: "본문" };

  it("MAX_STEPS 개까지는 스키마가 받는다", () => {
    const steps = Array.from({ length: MAX_STEPS }, (_, i) => `단계${i + 1}`);
    expect(CardnewsCard.safeParse({ ...base, steps }).success).toBe(true);
  });

  it("MAX_STEPS 를 넘기면 스키마가 거절한다 — 툴바가 그 이상 못 만들어야 한다", () => {
    const steps = Array.from({ length: MAX_STEPS + 1 }, (_, i) => `단계${i + 1}`);
    expect(CardnewsCard.safeParse({ ...base, steps }).success).toBe(false);
  });
});

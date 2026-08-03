import { describe, it, expect } from "vitest";
import { InfographicSpec, CardnewsSpec } from "@/lib/schema";
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

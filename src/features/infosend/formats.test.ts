import { describe, it, expect } from "vitest";
import { INFO_FORMATS } from "@/lib/schema";
import { formatChangeWarning, seedItemsFor } from "./formats";

/**
 * 형식은 **카피를 만들기 전에** 고른다 — 담는 정보가 달라 나중에 바꾸면 카피를 다시 만들어야
 * 한다. 그 사실을 바꾸는 자리에서 말한다(설계: 2026-08-05).
 */
describe("formatChangeWarning", () => {
  const filled = [{ keyword: "온도", desc: "26도" }];
  const blank = [{ text: "" }, { text: "" }];

  it("아직 카피가 없으면 조용하다 — 겁줄 일이 아니다", () => {
    expect(formatChangeWarning(null)).toBeNull();
  });

  it("항목이 차 있으면 조용하다", () => {
    expect(formatChangeWarning(filled)).toBeNull();
  });

  // 형식을 바꾸면 항목이 그 형식의 **빈 항목**으로 갈린다(`seedItemsFor`). 그 상태가 곧
  // "다시 만들거나 직접 채워야 한다" 는 뜻이다 — 이전 형식을 따로 기억하지 않아도 안다.
  it("항목이 전부 비어 있으면 다시 만들라고 말한다", () => {
    const msg = formatChangeWarning(blank);
    expect(msg).toContain("다시");
  });

  it("일부만 비었으면 조용하다 — 사람이 채우는 중이다", () => {
    expect(formatChangeWarning([{ text: "하나" }, { text: "" }])).toBeNull();
  });
});

/**
 * 형식을 바꾸면 항목 모양이 달라 **기존 항목을 그대로 옮길 수 없다.** 빈 항목을 그 형식의
 * 최소 개수만큼 깔아 두면, 카피를 다시 만들기 전에도 화면이 깨지지 않는다.
 */
describe("seedItemsFor", () => {
  it("형식마다 최소 개수만큼 만든다", () => {
    for (const f of INFO_FORMATS) {
      const seeded = seedItemsFor(f.id);
      expect(seeded.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("형식에 맞는 칸을 가진 빈 항목이다", () => {
    expect(seedItemsFor("list")[0]).toEqual({ keyword: "", desc: "" });
    expect(seedItemsFor("compare")[0]).toEqual({ label: "", left: "", right: "" });
    expect(seedItemsFor("steps")[0]).toEqual({ keyword: "", desc: "" });
    expect(seedItemsFor("stat")[0]).toEqual({ value: "", label: "" });
    expect(seedItemsFor("check")[0]).toEqual({ text: "" });
  });
});

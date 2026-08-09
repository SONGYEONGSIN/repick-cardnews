import { describe, it, expect } from "vitest";
import { CardnewsCard } from "@/lib/schema";
import { BODY_MAX, HEADING_MAX, workbenchChecks } from "./checks";
import { initialCardnewsState, type CardDraft, type CardnewsState } from "./reducer";

function card(over: Partial<CardDraft> & { copy: CardDraft["copy"] }): CardDraft {
  return {
    id: `c${Math.round(over.textY ?? 0)}${over.photoId ?? ""}${over.copy.heading}`,
    photoId: "p1",
    layout: "full-bleed",
    focal: { x: 0.5, y: 0.5 },
    scrim: 0.5,
    band: 0.5,
    textY: 1,
    textScale: 1,
    textAlign: "left",
    highlight: "",
    textBox: null,
    textColor: null,
    ...over,
  };
}

function stateWith(cards: CardDraft[], photoIds: string[]): CardnewsState {
  return {
    ...initialCardnewsState,
    cards,
    photos: photoIds.map((id) => ({ id, name: `${id}.jpg`, dataUrl: "", thumbUrl: "", width: 1080, height: 1350, bytes: 1 })),
    order: photoIds,
  };
}

const ok = card({ copy: { role: "problem", heading: "제목", body: "본문" } });

describe("상한값은 스키마와 같아야 한다", () => {
  it("헤드라인 상한을 넘기면 스키마가 거절한다", () => {
    const base = { role: "problem" as const, body: "본문" };
    expect(CardnewsCard.safeParse({ ...base, heading: "가".repeat(HEADING_MAX) }).success).toBe(true);
    expect(CardnewsCard.safeParse({ ...base, heading: "가".repeat(HEADING_MAX + 1) }).success).toBe(false);
  });

  it("본문 상한을 넘기면 스키마가 거절한다", () => {
    const base = { role: "problem" as const, heading: "제목" };
    expect(CardnewsCard.safeParse({ ...base, body: "가".repeat(BODY_MAX) }).success).toBe(true);
    expect(CardnewsCard.safeParse({ ...base, body: "가".repeat(BODY_MAX + 1) }).success).toBe(false);
  });
});

describe("workbenchChecks — 지금 고쳐야 할 것", () => {
  it("카드가 없으면 아무 점검도 하지 않는다 — 아직 만들기 전이다", () => {
    expect(workbenchChecks(stateWith([], ["p1"]))).toEqual([]);
  });

  it("문제가 없으면 준비됐다고 한 줄로 말한다", () => {
    const checks = workbenchChecks(stateWith([ok], ["p1"]));

    expect(checks).toHaveLength(1);
    expect(checks[0].tone).toBe("ok");
    expect(/[가-힣]/.test(checks[0].text)).toBe(true);
  });

  it("사진이 없는 카드를 센다", () => {
    const checks = workbenchChecks(stateWith([ok, card({ photoId: "", copy: ok.copy })], ["p1"]));

    expect(checks.some((c) => c.tone === "todo" && c.text.includes("사진"))).toBe(true);
  });

  it("글만 카드는 사진이 없어도 세지 않는다 — 원래 사진을 안 쓰는 구성이다", () => {
    const textOnly = card({ photoId: "", layout: "text-only", copy: { role: "cta", heading: "제목", action: "저장" } });

    expect(workbenchChecks(stateWith([textOnly], []))).toEqual([
      expect.objectContaining({ tone: "ok" }),
    ]);
  });

  it("헤드라인이 빈 카드를 센다", () => {
    const blank = card({ copy: { role: "problem", heading: "   ", body: "본문" } });

    expect(workbenchChecks(stateWith([blank], ["p1"])).some((c) => c.text.includes("헤드라인"))).toBe(true);
  });

  it("본문이 빈 카드를 센다", () => {
    const blank = card({ copy: { role: "problem", heading: "제목", body: "" } });

    expect(workbenchChecks(stateWith([blank], ["p1"])).some((c) => c.text.includes("본문"))).toBe(true);
  });

  it("글자 수를 넘긴 카드를 센다", () => {
    const over = card({ copy: { role: "problem", heading: "가".repeat(HEADING_MAX + 1), body: "본문" } });

    expect(workbenchChecks(stateWith([over], ["p1"])).some((c) => c.text.includes("글자"))).toBe(true);
  });

  it("여러 문제가 겹치면 각각 한 줄씩 나오고 '준비됐어요'는 없다", () => {
    const bad = card({ photoId: "", copy: { role: "problem", heading: "", body: "" } });
    const checks = workbenchChecks(stateWith([bad], []));

    expect(checks.length).toBeGreaterThan(1);
    expect(checks.every((c) => c.tone === "todo")).toBe(true);
  });

  it("문구는 전부 한국어다 — 사이드바에 그대로 나간다", () => {
    const bad = card({ photoId: "", copy: { role: "problem", heading: "", body: "" } });

    for (const c of workbenchChecks(stateWith([bad], []))) {
      expect(c.text).not.toMatch(/[A-Za-z]/);
    }
  });
});

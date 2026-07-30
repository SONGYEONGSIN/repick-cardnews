import { describe, it, expect } from "vitest";
import {
  cardnewsReducer,
  initialCardnewsState,
  slotPhotos,
  trayPhotos,
  canLeaveOrder,
  bandFor,
  CARDNEWS_MAX,
  type CardnewsState,
} from "@/features/cardnews/reducer";
import type { Photo } from "@/lib/photos";

function photo(id: string): Photo {
  return { id, name: `${id}.jpg`, dataUrl: "data:image/jpeg;base64,AAA", thumbUrl: "data:image/jpeg;base64,AAA", width: 1080, height: 1350, bytes: 1000 };
}

function withPhotos(count: number): CardnewsState {
  const photos = Array.from({ length: count }, (_, i) => photo(`p${i + 1}`));
  return cardnewsReducer(initialCardnewsState, { type: "ADD_PHOTOS", photos });
}

describe("ADD_PHOTOS", () => {
  it("정원까지만 슬롯에 채운다", () => {
    const s = withPhotos(8);
    expect(s.order).toHaveLength(CARDNEWS_MAX);
    expect(s.photos).toHaveLength(8);
  });
  it("나머지는 트레이에 남는다", () => {
    const s = withPhotos(8);
    expect(trayPhotos(s).map((p) => p.id)).toEqual(["p7", "p8"]);
  });
  it("정원보다 적으면 전부 슬롯에 들어간다", () => {
    expect(withPhotos(3).order).toEqual(["p1", "p2", "p3"]);
  });
  it("같은 사진을 다시 넣어도 중복되지 않는다", () => {
    const s = cardnewsReducer(withPhotos(2), { type: "ADD_PHOTOS", photos: [photo("p1")] });
    expect(s.photos).toHaveLength(2);
  });
});

describe("canLeaveOrder", () => {
  it("5장 미만이면 못 넘어간다", () => {
    expect(canLeaveOrder(withPhotos(4))).toBe(false);
  });
  it("5장이면 넘어간다", () => {
    expect(canLeaveOrder(withPhotos(5))).toBe(true);
  });
});

describe("REORDER", () => {
  it("슬롯 순서를 바꾼다", () => {
    const s = cardnewsReducer(withPhotos(5), { type: "REORDER", from: 0, to: 2 });
    expect(s.order).toEqual(["p2", "p3", "p1", "p4", "p5"]);
  });
});

describe("SWAP_IN", () => {
  it("트레이 사진을 슬롯 자리와 맞바꾼다", () => {
    const s = cardnewsReducer(withPhotos(8), { type: "SWAP_IN", slotIndex: 0, photoId: "p7" });
    expect(s.order[0]).toBe("p7");
    expect(trayPhotos(s).map((p) => p.id)).toContain("p1");
  });
  it("이미 슬롯에 있는 사진이면 아무 일도 없다", () => {
    const before = withPhotos(8);
    const after = cardnewsReducer(before, { type: "SWAP_IN", slotIndex: 0, photoId: "p2" });
    expect(after.order).toEqual(before.order);
  });
});

describe("REMOVE_PHOTO", () => {
  it("슬롯에서 빼면 트레이의 다음 사진이 자동으로 들어오지 않는다", () => {
    const s = cardnewsReducer(withPhotos(8), { type: "REMOVE_PHOTO", photoId: "p1" });
    expect(s.order).not.toContain("p1");
    expect(s.order).toHaveLength(CARDNEWS_MAX - 1);
    expect(s.photos.map((p) => p.id)).not.toContain("p1");
  });
});

describe("SET_SPEC", () => {
  const spec = {
    type: "cardnews" as const,
    keyword: "에어컨",
    cards: [
      { role: "hook" as const, heading: "표지" },
      { role: "problem" as const, heading: "문제", body: "본문" },
      { role: "evidence" as const, heading: "근거", body: "본문" },
      { role: "solution" as const, heading: "해결", body: "본문" },
      { role: "cta" as const, heading: "마무리", action: "저장하기" },
    ],
  };

  it("카드 수만큼 draft를 만들고 레이아웃을 배정한다", () => {
    const s = cardnewsReducer(withPhotos(5), { type: "SET_SPEC", spec });
    expect(s.cards.map((c) => c.layout)).toEqual(["full-bleed", "split", "split", "split", "text-only"]);
  });
  it("슬롯 순서대로 사진을 붙인다", () => {
    const s = cardnewsReducer(withPhotos(5), { type: "SET_SPEC", spec });
    expect(s.cards.map((c) => c.photoId)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });
  it("단계가 4개 이상인 solution 카드는 밴드를 0.3으로 줄인다", () => {
    const specWithSteps = {
      ...spec,
      cards: spec.cards.map((c) => (c.role === "solution" ? { ...c, steps: ["1", "2", "3", "4"] } : c)),
    };
    const s = cardnewsReducer(withPhotos(5), { type: "SET_SPEC", spec: specWithSteps });
    const solutionCard = s.cards.find((c) => c.copy.role === "solution");
    expect(solutionCard?.band).toBe(0.3);
  });
});

describe("UPDATE_CARD", () => {
  it("한 장만 바꾸고 나머지는 그대로 둔다", () => {
    const base = cardnewsReducer(withPhotos(5), {
      type: "SET_SPEC",
      spec: {
        type: "cardnews",
        keyword: "k",
        cards: [
          { role: "hook", heading: "표지" },
          { role: "problem", heading: "문제", body: "b" },
          { role: "evidence", heading: "근거", body: "b" },
          { role: "solution", heading: "해결", body: "b" },
          { role: "cta", heading: "마무리", action: "저장" },
        ],
      },
    });
    const next = cardnewsReducer(base, { type: "UPDATE_CARD", index: 1, patch: { layout: "text-only" } });
    expect(next.cards[1].layout).toBe("text-only");
    expect(next.cards[0]).toBe(base.cards[0]);
  });
});

describe("bandFor", () => {
  it("단계가 없으면 기본 밴드다", () => {
    expect(bandFor({ role: "hook", heading: "표지" })).toBe(0.45);
  });
  it("단계가 3개 이하면 기본 밴드다", () => {
    expect(bandFor({ role: "solution", heading: "해결", body: "본문", steps: ["1", "2", "3"] })).toBe(0.45);
  });
  it("단계가 4개 이상이면 사진을 줄여 글 자리를 만든다", () => {
    expect(bandFor({ role: "solution", heading: "해결", body: "본문", steps: ["1", "2", "3", "4"] })).toBe(0.3);
  });
});

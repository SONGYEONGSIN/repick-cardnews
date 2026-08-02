import { describe, it, expect } from "vitest";
import { toRenderCards } from "@/features/cardnews/render";
import type { CardnewsState, CardDraft } from "@/features/cardnews/reducer";
import type { Photo } from "@/lib/photos";

function photo(id: string, dataUrl = `data:image/jpeg;base64,${id}`): Photo {
  return { id, name: `${id}.jpg`, dataUrl, thumbUrl: dataUrl, width: 1080, height: 1350, bytes: 1000 };
}

function draft(overrides: Partial<CardDraft> = {}): CardDraft {
  return {
    id: "card-1",
    photoId: "p1",
    layout: "full-bleed",
    focal: { x: 0.5, y: 0.5 },
    scrim: 0.72,
    band: 0.45,
    textY: 1,
    textScale: 1,
    textAlign: "left",
    copy: { role: "hook", heading: "헤드라인" },
    ...overrides,
  };
}

function state(overrides: Partial<CardnewsState> = {}): CardnewsState {
  return {
    step: 4,
    photos: [photo("p1")],
    order: ["p1"],
    keyword: "키워드",
    themeId: "mint-clean",
    handle: "",
    cards: [draft()],
    error: null,
    busy: false,
    ...overrides,
  };
}

describe("toRenderCards", () => {
  it("photoId가 빈 문자열이면 photoUrl은 null이 된다", () => {
    const s = state({ cards: [draft({ photoId: "" })] });
    const [card] = toRenderCards(s);
    expect(card.photoUrl).toBeNull();
  });

  it("존재하지 않는 photoId를 가리키면 크래시 없이 photoUrl이 null이 된다", () => {
    const s = state({ cards: [draft({ photoId: "no-such-id" })] });
    const [card] = toRenderCards(s);
    expect(card.photoUrl).toBeNull();
  });

  it("photos에 있는 photoId면 해당 사진의 dataUrl을 그대로 가져온다", () => {
    const s = state({
      photos: [photo("p1", "data:image/jpeg;base64,AAA")],
      cards: [draft({ photoId: "p1" })],
    });
    const [card] = toRenderCards(s);
    expect(card.photoUrl).toBe("data:image/jpeg;base64,AAA");
  });

  it("badge는 'n / 전체' 형식이고 카드 수를 반영한다", () => {
    const s = state({
      photos: [photo("p1"), photo("p2"), photo("p3")],
      cards: [
        draft({ id: "card-1", photoId: "p1" }),
        draft({ id: "card-2", photoId: "p2" }),
        draft({ id: "card-3", photoId: "p3" }),
      ],
    });
    const cards = toRenderCards(s);
    expect(cards.map((c) => c.badge)).toEqual(["1 / 3", "2 / 3", "3 / 3"]);
  });

  it("layout·focal·scrim·band·textY·textScale·textAlign·copy는 CardDraft에서 그대로 옮겨진다", () => {
    const focal = { x: 0.2, y: 0.8 };
    const copy = { role: "solution" as const, heading: "h", body: "b", steps: ["1", "2"] };
    const s = state({
      cards: [
        draft({ layout: "split", focal, scrim: 0.5, band: 0.6, textY: 0.3, textScale: 1.2, textAlign: "center", copy }),
      ],
    });
    const [card] = toRenderCards(s);
    expect(card.layout).toBe("split");
    expect(card.focal).toEqual(focal);
    expect(card.scrim).toBe(0.5);
    expect(card.band).toBe(0.6);
    expect(card.textY).toBe(0.3);
    expect(card.textScale).toBe(1.2);
    expect(card.textAlign).toBe("center");
    expect(card.copy).toEqual(copy);
  });
});

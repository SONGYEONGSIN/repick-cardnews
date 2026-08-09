import { describe, it, expect } from "vitest";
import {
  cardnewsReducer,
  initialCardnewsState,
  slotPhotos,
  canLeaveTopic,
  canLeaveWorkbench,
  bandFor,
  textAlignFor,
  CARDNEWS_MAX,
  type CardnewsState,
  type CardDraft,
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
  it("나머지는 트레이(슬롯 밖)에 남는다", () => {
    const s = withPhotos(8);
    const tray = s.photos.filter((p) => !s.order.includes(p.id));
    expect(tray.map((p) => p.id)).toEqual(["p7", "p8"]);
  });
  it("정원보다 적으면 전부 슬롯에 들어간다", () => {
    expect(withPhotos(3).order).toEqual(["p1", "p2", "p3"]);
  });
  it("같은 사진을 다시 넣어도 중복되지 않는다", () => {
    const s = cardnewsReducer(withPhotos(2), { type: "ADD_PHOTOS", photos: [photo("p1")] });
    expect(s.photos).toHaveLength(2);
  });
});

// canLeaveOrder 는 canLeaveWorkbench 내부에서만 쓰는 비-export 함수라 공개 게이트로 검증한다.
// 카드는 고정으로 채워 두어 사진 장수 경계만 갈린다.
describe("canLeaveWorkbench 의 사진 장수 경계(canLeaveOrder)", () => {
  // 카드 수가 사진 수를 따라가므로 5장을 요구하지 않는다(2026-08-09). 두 장은 있어야
  // 한다 — 첫 장이 hook, 마지막이 cta 라 한 장으로는 시퀀스가 안 된다.
  it("한 장이면 못 넘어간다", () => {
    expect(canLeaveWorkbench({ ...withPhotos(1), cards: [CARD] })).toBe(false);
  });
  it("두 장이면 넘어간다", () => {
    expect(canLeaveWorkbench({ ...withPhotos(2), cards: [CARD] })).toBe(true);
  });
  it("네 장도 넘어간다 — 예전에는 5장 미만이라 막혔다", () => {
    expect(canLeaveWorkbench({ ...withPhotos(4), cards: [CARD] })).toBe(true);
  });
  // 7장을 올려도 ADD_PHOTOS 가 슬롯을 정원까지만 채우므로(위 describe) 여기선 통과가 맞다.
  // 상한을 넘는 상태는 슬롯을 직접 조작해야 만들어진다.
  it("슬롯이 정원을 넘으면 못 넘어간다", () => {
    const over = { ...withPhotos(6), order: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"], cards: [CARD] };
    expect(canLeaveWorkbench(over)).toBe(false);
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
    const tray = s.photos.filter((p) => !s.order.includes(p.id));
    expect(tray.map((p) => p.id)).toContain("p1");
  });
  it("이미 슬롯에 있는 사진이면 아무 일도 없다", () => {
    const before = withPhotos(8);
    const after = cardnewsReducer(before, { type: "SWAP_IN", slotIndex: 0, photoId: "p2" });
    expect(after.order).toEqual(before.order);
  });
});

describe("REMOVE_PHOTO", () => {
  it("슬롯에서 빼면 트레이의 첫 사진이 그 자리를 메운다", () => {
    const s = cardnewsReducer(withPhotos(8), { type: "REMOVE_PHOTO", photoId: "p1" });
    expect(s.order).not.toContain("p1");
    expect(s.order).toHaveLength(CARDNEWS_MAX);
    expect(s.order).toEqual(["p2", "p3", "p4", "p5", "p6", "p7"]);
    expect(s.photos.map((p) => p.id)).not.toContain("p1");
    const tray = s.photos.filter((p) => !s.order.includes(p.id));
    expect(tray.map((p) => p.id)).toEqual(["p8"]);
  });
  it("트레이가 비어 있으면 순서가 한 칸 줄어든다", () => {
    const s = cardnewsReducer(withPhotos(5), { type: "REMOVE_PHOTO", photoId: "p1" });
    expect(s.order).toEqual(["p2", "p3", "p4", "p5"]);
    const tray = s.photos.filter((p) => !s.order.includes(p.id));
    expect(tray).toHaveLength(0);
  });
  it("트레이 사진을 빼면 슬롯은 그대로다", () => {
    const before = withPhotos(8);
    const after = cardnewsReducer(before, { type: "REMOVE_PHOTO", photoId: "p7" });
    expect(after.order).toEqual(before.order);
    const tray = after.photos.filter((p) => !after.order.includes(p.id));
    expect(tray.map((p) => p.id)).toEqual(["p8"]);
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

  it("카드 수만큼 draft를 만들고 전부 사진 전면으로 시작한다", () => {
    // 예전에는 표지 full-bleed · 중간 split · 마지막 text-only 로 섞었다. 넘겨 보다 구성이 계속
    // 바뀌어 한 덩어리로 안 읽힌다는 요청으로 전부 full-bleed 로 바꿨다(`@/lib/layout-assign`).
    const s = cardnewsReducer(withPhotos(5), { type: "SET_SPEC", spec });
    expect(s.cards.map((c) => c.layout)).toEqual(["full-bleed", "full-bleed", "full-bleed", "full-bleed", "full-bleed"]);
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
  it("레이아웃별 기본 textY 를 정한다 — full-bleed 는 1(아래), 나머지는 0.5(가운데)", () => {
    // FullBleedCard 는 글을 아래 끝에, Split·TextOnly 는 가운데에 둔다(textYSpacers 가 만드는
    // 여백 비율). 이 기본값이 그 배치와 어긋나면 텍스트 위치가 바뀌어 보인다.
    // 지금은 전부 full-bleed 로 시작하므로 전부 1 이다 — 구성을 바꾸면 그때 다시 계산된다.
    const s = cardnewsReducer(withPhotos(5), { type: "SET_SPEC", spec });
    expect(s.cards.map((c) => c.textY)).toEqual([1, 1, 1, 1, 1]);
  });
  it("글자 크기·정렬 기본값을 준다 — 크기는 1(보통), 정렬은 cta만 가운데 나머지는 왼쪽", () => {
    const s = cardnewsReducer(withPhotos(5), { type: "SET_SPEC", spec });
    expect(s.cards.map((c) => c.textScale)).toEqual([1, 1, 1, 1, 1]);
    expect(s.cards.map((c) => c.textAlign)).toEqual(["left", "left", "left", "left", "center"]);
  });
  it("형광 기본값은 빈 문자열(강조 없음)이다", () => {
    const s = cardnewsReducer(withPhotos(5), { type: "SET_SPEC", spec });
    expect(s.cards.map((c) => c.highlight)).toEqual(["", "", "", "", ""]);
  });
  it("사진보다 카드가 많으면 남는 카드는 사진 없이 둔다", () => {
    const sixCardSpec = {
      type: "cardnews" as const,
      keyword: "에어컨",
      cards: [
        { role: "hook" as const, heading: "표지" },
        { role: "problem" as const, heading: "문제", body: "본문" },
        { role: "evidence" as const, heading: "근거", body: "본문" },
        { role: "solution" as const, heading: "해결", body: "본문" },
        { role: "evidence" as const, heading: "근거2", body: "본문" },
        { role: "cta" as const, heading: "마무리", action: "저장하기" },
      ],
    };
    // 사진은 5장만 슬롯에 있다
    const s = cardnewsReducer(withPhotos(5), { type: "SET_SPEC", spec: sixCardSpec });
    expect(s.cards.map((c) => c.photoId)).toEqual(["p1", "p2", "p3", "p4", "p5", ""]);
  });
});

/**
 * 불변식: `cards[i].photoId === (order[i] ?? "")`.
 *
 * `SET_SPEC` 이 이렇게 세우므로 order 를 건드리는 액션(SWAP_IN·REORDER·REMOVE_PHOTO)은 전부
 * 이것을 다시 세워야 한다. 안 그러면 레일은 새 사진을 보여 주는데 캔버스와 출력
 * (`toRenderCards` 는 card.photoId 로 사진을 찾는다)은 옛 사진을 계속 쓴다.
 */
describe("order 와 cards 의 사진 연결", () => {
  function specOf(count: number) {
    const middle = Array.from({ length: count - 2 }, (_, i) => ({
      role: "problem" as const,
      heading: `문제${i + 1}`,
      body: "본문",
    }));
    return {
      type: "cardnews" as const,
      keyword: "에어컨",
      cards: [
        { role: "hook" as const, heading: "표지" },
        ...middle,
        { role: "cta" as const, heading: "마무리", action: "저장" },
      ],
    };
  }

  function withCards(photoCount: number, cardCount: number): CardnewsState {
    return cardnewsReducer(withPhotos(photoCount), { type: "SET_SPEC", spec: specOf(cardCount) });
  }

  /** 카드가 실제로 가리키는 사진 vs 슬롯 순서가 요구하는 사진 */
  function linkage(s: CardnewsState): { actual: string[]; expected: string[] } {
    return {
      actual: s.cards.map((c) => c.photoId),
      expected: s.cards.map((_, i) => s.order[i] ?? ""),
    };
  }

  it("SWAP_IN 하면 그 자리의 카드도 새 사진을 가리킨다", () => {
    const s = cardnewsReducer(withCards(8, 6), { type: "SWAP_IN", slotIndex: 0, photoId: "p7" });
    expect(s.cards[0].photoId).toBe("p7");
    const { actual, expected } = linkage(s);
    expect(actual).toEqual(expected);
  });

  it("REORDER 하면 카드가 옮겨진 순서를 따라간다", () => {
    const s = cardnewsReducer(withCards(5, 5), { type: "REORDER", from: 0, to: 2 });
    expect(s.cards.map((c) => c.photoId)).toEqual(["p2", "p3", "p1", "p4", "p5"]);
  });

  it("REMOVE_PHOTO 로 트레이가 자리를 메우면 카드도 그 사진을 가리킨다", () => {
    const s = cardnewsReducer(withCards(8, 6), { type: "REMOVE_PHOTO", photoId: "p1" });
    expect(s.cards.map((c) => c.photoId)).toEqual(["p2", "p3", "p4", "p5", "p6", "p7"]);
    const { actual, expected } = linkage(s);
    expect(actual).toEqual(expected);
  });

  it("REMOVE_PHOTO 로 순서가 줄면 남는 카드는 사진 없이 남는다", () => {
    const s = cardnewsReducer(withCards(5, 5), { type: "REMOVE_PHOTO", photoId: "p1" });
    expect(s.cards.map((c) => c.photoId)).toEqual(["p2", "p3", "p4", "p5", ""]);
    const { actual, expected } = linkage(s);
    expect(actual).toEqual(expected);
  });

  it("사진보다 카드가 많아도 남는 카드는 빈 채로 유지된다", () => {
    const s = cardnewsReducer(withCards(5, 6), { type: "REORDER", from: 0, to: 4 });
    expect(s.cards.map((c) => c.photoId)).toEqual(["p2", "p3", "p4", "p5", "p1", ""]);
  });

  it("카피 생성 전에는 아무 일도 하지 않는다", () => {
    const s = cardnewsReducer(withPhotos(5), { type: "REORDER", from: 0, to: 2 });
    expect(s.cards).toEqual([]);
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

  it("textY 를 바꾼다", () => {
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
    const next = cardnewsReducer(base, { type: "UPDATE_CARD", index: 0, patch: { textY: 0.2 } });
    expect(next.cards[0].textY).toBe(0.2);
  });

  it("레이아웃을 바꿔도 사용자가 정한 textY 는 초기화되지 않는다", () => {
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
    const moved = cardnewsReducer(base, { type: "UPDATE_CARD", index: 0, patch: { textY: 0.2 } });
    const relayouted = cardnewsReducer(moved, { type: "UPDATE_CARD", index: 0, patch: { layout: "split" } });
    expect(relayouted.cards[0].textY).toBe(0.2);
  });
});

describe("SET_ERROR", () => {
  it("생성이 진행 중이라는 사실을 건드리지 않는다", () => {
    // 오류가 났다는 사실과 생성이 도는 중이라는 사실은 별개다. 함께 풀면 Dropzone 오류
    // 한 번에 생성 버튼이 되살아나 CLI 호출이 둘 동시에 돈다.
    const s = cardnewsReducer({ ...initialCardnewsState, busy: true }, { type: "SET_ERROR", error: "사진을 읽지 못했어요." });
    expect(s.busy).toBe(true);
    expect(s.error).toBe("사진을 읽지 못했어요.");
  });

  it("생성 중이 아니면 그대로 꺼져 있다", () => {
    const s = cardnewsReducer(initialCardnewsState, { type: "SET_ERROR", error: "실패" });
    expect(s.busy).toBe(false);
  });
});

describe("SET_STEP", () => {
  it("화면을 옮기면 이전 화면이 세운 오류를 지운다", () => {
    // 한 화면의 오류가 다른 화면의 오류 자리에 그대로 뜨면 안 된다 —
    // 예: 만들기 화면의 429 오류가 내보내기 화면 상단에 내보내기 실패인 것처럼 뜨는 사고.
    const withError = { ...initialCardnewsState, error: "요청이 많아요. 잠시 후 다시 시도해 주세요." };
    const s = cardnewsReducer(withError, { type: "SET_STEP", step: 2 });
    expect(s.error).toBeNull();
  });
});

describe("textAlignFor", () => {
  it("cta 카드는 가운데가 기본이다 — CardnewsBody가 지금도 그렇게 그린다", () => {
    expect(textAlignFor({ role: "cta", heading: "마무리", action: "저장" })).toBe("center");
  });
  it("cta 가 아닌 역할은 왼쪽이 기본이다", () => {
    expect(textAlignFor({ role: "hook", heading: "표지" })).toBe("left");
    expect(textAlignFor({ role: "problem", heading: "문제", body: "b" })).toBe("left");
    expect(textAlignFor({ role: "evidence", heading: "근거", body: "b" })).toBe("left");
    expect(textAlignFor({ role: "solution", heading: "해결", body: "b" })).toBe("left");
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

const CARD: CardDraft = {
  id: "card-1",
  photoId: "a",
  layout: "full-bleed",
  focal: { x: 0.5, y: 0.5 },
  scrim: 0.7,
  band: 0.45,
  textY: 1,
  textScale: 1,
  textAlign: "left",
  highlight: "",
  textBox: null,
  textColor: null,
  copy: { role: "hook", heading: "후크" },
};

describe("단계 게이트", () => {
  it("주제 화면은 키워드가 있어야 넘어간다", () => {
    expect(canLeaveTopic({ ...initialCardnewsState, keyword: "" })).toBe(false);
    expect(canLeaveTopic({ ...initialCardnewsState, keyword: "   " })).toBe(false);
    expect(canLeaveTopic({ ...initialCardnewsState, keyword: "에어컨 전기세" })).toBe(true);
  });

  it("만들기 화면은 사진 5~6장과 생성된 카피가 둘 다 있어야 넘어간다", () => {
    const five = ["a", "b", "c", "d", "e"];
    const base = { ...initialCardnewsState, keyword: "에어컨" };

    // 사진만 있고 카피가 없으면 못 넘어간다
    expect(canLeaveWorkbench({ ...base, order: five })).toBe(false);
    // 카피만 있고 사진이 모자라면 못 넘어간다
    expect(canLeaveWorkbench({ ...base, order: ["a"], cards: [CARD] })).toBe(false);
    // 둘 다 있어야 넘어간다
    expect(canLeaveWorkbench({ ...base, order: five, cards: [CARD] })).toBe(true);
  });

  it("사진이 7장이면 넘어가지 못한다", () => {
    const seven = ["a", "b", "c", "d", "e", "f", "g"];
    expect(canLeaveWorkbench({ ...initialCardnewsState, order: seven, cards: [CARD] })).toBe(false);
  });

  it("처음 단계는 0 이다", () => {
    expect(initialCardnewsState.step).toBe(0);
  });
});

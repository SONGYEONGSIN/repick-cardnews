import { describe, it, expect } from "vitest";
import {
  FINDER_CATEGORIES,
  FINDER_SHOPPING_CATEGORIES,
  FINDER_MODES,
  RANK_LENSES,
  SELLING_SHOPPING_CATEGORIES,
  SELLING_SHOPPING_CATEGORY_IDS,
  buildMaterialsQuery,
  buildTopicsQuery,
  lensAfterSourceChange,
  lensAvailability,
  materialsSourceLine,
  toMaterialsView,
} from "./material-finder";
import { isShoppingCategoryId } from "@/lib/naver-shopping";

describe("모드와 렌즈 목록", () => {
  it("세 모드가 있고 이름·설명이 전부 한국어다", () => {
    expect(FINDER_MODES.map((m) => m.id)).toEqual(["trending", "search", "curated"]);
    for (const mode of FINDER_MODES) {
      expect(mode.label).not.toMatch(/[A-Za-z]/);
      expect(/[가-힣]/.test(mode.hint)).toBe(true);
    }
  });

  it("키워드 검색 설명은 하루 100번 상한을 밝힌다", () => {
    expect(FINDER_MODES.find((m) => m.id === "search")!.hint).toContain("100번");
  });

  it("소재 추천 설명은 오래 걸린다는 것을 미리 말한다", () => {
    expect(FINDER_MODES.find((m) => m.id === "curated")!.hint).toContain("1분 40초");
  });

  it("쇼핑인사이트 렌즈는 물건에만 맞는다는 한계를 밝힌다", () => {
    expect(RANK_LENSES.find((l) => l.id === "shopping")!.hint).toContain("물건");
  });

  it("렌즈 이름·설명도 전부 한국어다", () => {
    expect(RANK_LENSES.map((l) => l.id)).toEqual(["search-trend", "shopping", "claude"]);
    for (const lens of RANK_LENSES) {
      expect(/[가-힣]/.test(lens.hint)).toBe(true);
    }
  });
});

describe("lensAvailability — 네이버 키가 없으면 고를 수 없다", () => {
  it("네이버가 없으면 검색어트렌드·쇼핑인사이트는 막고 이유를 준다", () => {
    for (const lens of ["search-trend", "shopping"] as const) {
      const state = lensAvailability(lens, false);
      expect(state.enabled).toBe(false);
      expect(/[가-힣]/.test(state.reason ?? "")).toBe(true);
    }
  });

  it("Claude 판단은 네이버 없이도 언제나 고를 수 있다", () => {
    expect(lensAvailability("claude", false)).toEqual({ enabled: true, reason: null });
  });

  it("네이버가 있으면 '요즘 사는 것' 에서 셋 다 열린다", () => {
    for (const lens of ["search-trend", "shopping", "claude"] as const) {
      expect(lensAvailability(lens, true, "selling").enabled).toBe(true);
    }
  });
});

/**
 * 쇼핑인사이트는 **쇼핑 클릭 비중**으로 줄 세운다. 유튜브에서 온 후보는 물건이 아닌 것이
 * 많아(`감자전 레시피`) 데이터가 없고, 100초를 들인 끝에 Claude 순위로 폴백된다. 기다린 뒤에
 * 알려 주느니 고르기 전에 막는다.
 *
 * 서버는 그대로 둔다 — 직접 부르는 쪽에는 폴백이 여전히 옳은 답이다. 여기서 막는 것은
 * **사람이 100초를 헛되이 쓰지 않게 하려는 것**이지 조합이 위험해서가 아니다.
 */
describe("lensAvailability — 쇼핑인사이트는 '요즘 사는 것' 에서만", () => {
  it("유튜브에서 찾을 때는 쇼핑인사이트를 막고 이유를 준다", () => {
    const state = lensAvailability("shopping", true, "youtube");
    expect(state.enabled).toBe(false);
    expect(/[가-힣]/.test(state.reason ?? "")).toBe(true);
  });

  it("쿠팡에서 찾을 때는 쇼핑인사이트가 열린다", () => {
    expect(lensAvailability("shopping", true, "selling")).toEqual({ enabled: true, reason: null });
  });

  it("나머지 두 렌즈는 출처를 가리지 않는다 — 어느 후보든 줄 세울 수 있다", () => {
    for (const source of ["youtube", "selling"] as const) {
      expect(lensAvailability("search-trend", true, source).enabled).toBe(true);
      expect(lensAvailability("claude", false, source).enabled).toBe(true);
    }
  });

  // 키가 없는 것은 설정 문제라 출처를 바꿔도 안 풀린다. 그 사실을 먼저 말해야 헛걸음이 없다.
  it("네이버 키가 없으면 출처와 무관하게 키 안내를 먼저 준다", () => {
    const state = lensAvailability("shopping", false, "selling");
    expect(state.enabled).toBe(false);
    expect(state.reason).toContain("네이버");
  });
});

/**
 * 출처를 바꾸면 **고른 렌즈가 못 쓰는 것이 될 수 있다.** 그대로 두면 화면에는 흐린 렌즈가
 * 선택된 채 남고, 눌러 보면 그 조합으로 요청이 나간다. 쓸 수 있는 렌즈로 되돌린다.
 */
describe("lensAfterSourceChange — 출처를 바꿔도 못 고르는 렌즈가 남지 않는다", () => {
  it("쇼핑인사이트를 고른 채 유튜브로 옮기면 검색어트렌드로 되돌린다", () => {
    expect(lensAfterSourceChange("shopping", true, "youtube")).toBe("search-trend");
  });

  it("네이버가 없으면 Claude 판단으로 되돌린다 — 검색어트렌드도 못 쓴다", () => {
    expect(lensAfterSourceChange("shopping", false, "youtube")).toBe("claude");
  });

  it("아직 쓸 수 있는 렌즈면 그대로 둔다 — 사용자가 고른 것을 함부로 바꾸지 않는다", () => {
    expect(lensAfterSourceChange("shopping", true, "selling")).toBe("shopping");
    expect(lensAfterSourceChange("claude", true, "youtube")).toBe("claude");
    expect(lensAfterSourceChange("search-trend", true, "selling")).toBe("search-trend");
  });
});

/**
 * 쿠팡은 **네 분야만** 긁는다(`coupang-best.ts` 의 `COUPANG_SEASONAL_CATEGORIES`). 그런데
 * 쇼핑인사이트 분야는 아홉이라, 패션의류처럼 쿠팡이 가져오지도 않는 분야를 고를 수 있었다.
 * 고르면 데이터가 없어 Claude 순위로 밀린다 — 유튜브+쇼핑인사이트를 막은 것과 같은 일이다.
 */
describe("SELLING_SHOPPING_CATEGORIES — 쿠팡 소재와 짝이 맞는 분야만", () => {
  it("전체 목록의 부분집합이다 — 없는 분야를 지어내지 않는다", () => {
    const all = new Set(FINDER_SHOPPING_CATEGORIES.map((c) => c.id));
    for (const c of SELLING_SHOPPING_CATEGORIES) expect(all.has(c.id)).toBe(true);
  });

  /**
   * id 를 손으로 적었으므로 여기서 묶는다. 서버가 분야를 지우거나 id 를 바꾸면 filter 결과가
   * 줄어들어 이 개수가 어긋난다 — 조용히 사라지지 않게 하는 장치다.
   */
  it("골라 둔 id 가 전부 살아 있다", () => {
    expect(SELLING_SHOPPING_CATEGORIES).toHaveLength(SELLING_SHOPPING_CATEGORY_IDS.size);
  });

  it("쿠팡이 가져오지 않는 분야는 빠져 있다", () => {
    const names = SELLING_SHOPPING_CATEGORIES.map((c) => c.name);
    for (const absent of ["패션의류", "패션잡화", "화장품·미용", "출산·육아", "스포츠·레저"]) {
      expect(names).not.toContain(absent);
    }
  });

  it("쿠팡이 가져오는 것과 짝이 맞는 분야는 들어 있다", () => {
    const names = SELLING_SHOPPING_CATEGORIES.map((c) => c.name);
    for (const present of ["디지털·가전", "식품", "생활·건강"]) {
      expect(names).toContain(present);
    }
  });

  it("서버가 받는 분야 id 다 — 좁힌 목록이 400 을 부르면 안 된다", () => {
    for (const c of SELLING_SHOPPING_CATEGORIES) expect(isShoppingCategoryId(c.id)).toBe(true);
  });
});

describe("쿼리 만들기", () => {
  it("급상승은 고른 카테고리를 쉼표로 잇는다", () => {
    expect(buildMaterialsQuery("trending", { categoryIds: ["26", "28"], query: "" })).toBe(
      "mode=trending&categories=26%2C28",
    );
  });

  it("키워드 검색은 검색어를 인코딩해 싣는다", () => {
    expect(buildMaterialsQuery("search", { categoryIds: [], query: "에어컨 전기세" })).toBe(
      "mode=search&q=%EC%97%90%EC%96%B4%EC%BB%A8+%EC%A0%84%EA%B8%B0%EC%84%B8",
    );
  });

  // 후보 출처가 둘이 되면서 `source` 가 함께 실린다(기본은 유튜브).
  it("소재 추천은 렌즈를 싣고, 쇼핑일 때만 분야를 함께 싣는다", () => {
    expect(buildTopicsQuery("search-trend", "")).toBe("lens=search-trend&source=youtube");
    expect(buildTopicsQuery("claude", "50000005")).toBe("lens=claude&source=youtube");
    expect(buildTopicsQuery("shopping", "50000005")).toBe(
      "lens=shopping&source=youtube&shoppingCategory=50000005",
    );
    // 출처를 바꿔도 렌즈·분야는 그대로 실린다.
    expect(buildTopicsQuery("shopping", "50000005", "selling")).toBe(
      "lens=shopping&source=selling&shoppingCategory=50000005",
    );
  });
});

describe("toMaterialsView", () => {
  const body = {
    items: [{ videoId: "v1", title: "제목1", channelTitle: "채널1" }],
    mode: "trending",
    youtubeCategories: ["살림·요리·꿀팁"],
  };

  it("결과가 있으면 목록과 출처를 들고 온다", () => {
    const view = toMaterialsView(200, body);

    expect(view.kind).toBe("items");
    if (view.kind !== "items") return;
    expect(view.items).toHaveLength(1);
    expect(view.categories).toEqual(["살림·요리·꿀팁"]);
    expect(view.skipped).toEqual([]);
  });

  // 탭을 바꿔도 결과는 남는다 — 출처는 화면의 현재 탭이 아니라 이 결과를 만든 요청을 따라야 한다.
  it("모드를 응답에서 읽어 담는다 — 화면의 현재 탭을 믿지 않는다", () => {
    const trending = toMaterialsView(200, body);
    const search = toMaterialsView(200, { items: body.items, mode: "search", query: "전기세" });

    expect(trending.kind === "items" && trending.mode).toBe("trending");
    expect(search.kind === "items" && search.mode).toBe("search");
    expect(search.kind === "items" && search.query).toBe("전기세");
  });

  it("모드를 모르면 오류로 접는다 — 출처를 지어내지 않는다", () => {
    expect(toMaterialsView(200, { items: body.items }).kind).toBe("error");
    expect(toMaterialsView(200, { items: body.items, mode: "nope" }).kind).toBe("error");
  });

  it("결과가 0개면 '없음' 상태다 — 빈 목록을 그냥 두지 않는다", () => {
    const view = toMaterialsView(200, { ...body, items: [] });

    expect(view.kind).toBe("empty");
  });

  it("건너뛴 카테고리를 감추지 않는다", () => {
    const view = toMaterialsView(200, { ...body, skippedYoutubeCategories: ["일상·브이로그"] });

    expect(view.kind === "items" && view.skipped).toEqual(["일상·브이로그"]);
  });

  it("오류는 한국어로 바꿔 준다", () => {
    expect(toMaterialsView(502, { error: "Internal Server Error" })).toEqual({
      kind: "error",
      message: expect.stringMatching(/[가-힣]/),
    });
  });

  it("200 인데 형태가 어긋나면 raw 를 보이지 않고 오류로 접는다", () => {
    for (const bad of [null, {}, { items: "nope" }, "<html>"]) {
      const view = toMaterialsView(200, bad);
      expect(view.kind).toBe("error");
      expect(view.kind === "error" && /[가-힣]/.test(view.message)).toBe(true);
    }
  });
});

describe("materialsSourceLine — 어디서 가져온 것인지", () => {
  it("급상승이면 인기 급상승과 실제로 쓴 카테고리를 말한다", () => {
    const view = toMaterialsView(200, {
      items: [{ videoId: "v1", title: "제목1", channelTitle: "채널1" }],
      mode: "trending",
      youtubeCategories: ["살림·요리·꿀팁", "일상·브이로그"],
    });

    const line = materialsSourceLine(view)!;
    expect(line).toContain("인기 급상승");
    expect(line).toContain("살림·요리·꿀팁, 일상·브이로그");
  });

  it("키워드 검색이면 검색이라는 것과 무엇으로 찾았는지를 말한다 — 급상승이라고 하지 않는다", () => {
    const view = toMaterialsView(200, {
      items: [{ videoId: "v1", title: "제목1", channelTitle: "채널1" }],
      mode: "search",
      query: "에어컨 전기세",
    });

    const line = materialsSourceLine(view)!;
    expect(line).toContain("검색");
    expect(line).toContain("에어컨 전기세");
    expect(line).not.toContain("급상승");
  });

  it("카테고리 정보가 없으면 출처 이름만 말한다 — 빈 구분자를 남기지 않는다", () => {
    const view = toMaterialsView(200, {
      items: [{ videoId: "v1", title: "제목1", channelTitle: "채널1" }],
      mode: "trending",
    });

    expect(materialsSourceLine(view)).toBe("유튜브 인기 급상승(한국)");
  });

  it("결과가 0개여도 어디서 찾아봤는지는 밝힌다 — 빈손인 이유를 알아야 한다", () => {
    const view = toMaterialsView(200, { items: [], mode: "trending", youtubeCategories: ["살림·요리·꿀팁"] });

    expect(view.kind).toBe("empty");
    expect(materialsSourceLine(view)).toContain("살림·요리·꿀팁");
  });

  it("오류일 때는 출처를 말하지 않는다", () => {
    expect(materialsSourceLine(toMaterialsView(502, { error: "실패" }))).toBeNull();
  });
});

// 화면은 상수 배열 하나 때문에 서버 전용 모듈(zod·fetch 를 끌고 온다)을 import 하면 안 된다.
// 그래서 목록을 여기 따로 두되, **서버와 어긋나면 여기서 깨지게** 잠근다.
describe("화면용 목록 — 서버와 어긋나면 안 된다", () => {
  it("유튜브 카테고리가 서버의 LIFESTYLE_CATEGORIES 와 id·이름까지 같다", async () => {
    const { LIFESTYLE_CATEGORIES } = await import("@/lib/youtube-trending");

    expect(FINDER_CATEGORIES).toEqual(LIFESTYLE_CATEGORIES.map((c) => ({ id: c.id, name: c.displayName })));
  });

  it("쇼핑 분야가 서버의 SHOPPING_CATEGORIES 와 같다", async () => {
    const { SHOPPING_CATEGORIES } = await import("@/lib/naver-shopping");

    expect(FINDER_SHOPPING_CATEGORIES).toEqual(SHOPPING_CATEGORIES.map((c) => ({ id: c.id, name: c.name })));
  });

  it("두 목록의 이름은 전부 한국어다", () => {
    for (const c of [...FINDER_CATEGORIES, ...FINDER_SHOPPING_CATEGORIES]) {
      expect(c.name).not.toMatch(/[A-Za-z]/);
    }
  });
});

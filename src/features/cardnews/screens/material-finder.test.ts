import { describe, it, expect } from "vitest";
import {
  FINDER_CATEGORIES,
  FINDER_SHOPPING_CATEGORIES,
  FINDER_MODES,
  RANK_LENSES,
  buildMaterialsQuery,
  buildTopicsQuery,
  lensAvailability,
  materialsSourceLine,
  toMaterialsView,
} from "./material-finder";

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

  it("네이버가 있으면 셋 다 열린다", () => {
    for (const lens of ["search-trend", "shopping", "claude"] as const) {
      expect(lensAvailability(lens, true).enabled).toBe(true);
    }
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

import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { CardnewsSpec, InfographicSpec, INFO_FORMATS, infoSpecFor, itemFieldMaxes, itemRangeOf, itemTexts } from "@/lib/schema";

/**
 * 정보전달은 틀이 하나뿐이었다 — 스키마가 `items[{keyword,desc}]` 만 허용해, 비교("A vs B")나
 * 수치("1도에 7%")도 전부 설명 안에 뭉개졌다. 담는 정보의 모양이 다르면 형식도 달라야 한다.
 *
 * **배열 이름은 다섯 형식 모두 `items` 로 같다** — reducer 의 추가·삭제·정렬이 형식과 무관하게
 * 돌게 하려는 것이다. 이름을 형식마다 다르게 두면 그 네 동작을 형식 수만큼 복제해야 한다.
 */
const common = { type: "informationsend" as const, title: "여름 전기세", subtitle: "부제", tip: "팁" };

function items<T>(one: T, n: number): T[] {
  return Array.from({ length: n }, () => one);
}

describe("형식 다섯", () => {
  it("id 가 다섯이고 이름·설명이 채워져 있다", () => {
    expect(INFO_FORMATS.map((f) => f.id)).toEqual(["list", "compare", "steps", "stat", "check"]);
    for (const f of INFO_FORMATS) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.note.length).toBeGreaterThan(0);
    }
  });

  it("형식마다 항목 수 범위가 있다", () => {
    expect(itemRangeOf("list")).toEqual({ min: 3, max: 6 });
    expect(itemRangeOf("compare")).toEqual({ min: 3, max: 5 });
    expect(itemRangeOf("steps")).toEqual({ min: 3, max: 5 });
    expect(itemRangeOf("stat")).toEqual({ min: 2, max: 3 });
    expect(itemRangeOf("check")).toEqual({ min: 4, max: 8 });
  });
});

describe("InfographicSpec — 형식별 통과", () => {
  const list = { ...common, format: "list", items: items({ keyword: "온도", desc: "26도" }, 3) };
  const compare = {
    ...common,
    format: "compare",
    columns: { left: "에어컨", right: "선풍기" },
    items: items({ label: "전기세", left: "높음", right: "낮음" }, 3),
  };
  const steps = { ...common, format: "steps", items: items({ keyword: "전원 끄기", desc: "코드를 뽑아요" }, 3) };
  const stat = { ...common, format: "stat", items: items({ value: "7%", label: "1도만 올려도" }, 2) };
  const check = { ...common, format: "check", items: items({ text: "필터 청소했나요" }, 4) };

  it("다섯 형식이 모두 통과한다", () => {
    for (const spec of [list, compare, steps, stat, check]) {
      expect(InfographicSpec.safeParse(spec).success).toBe(true);
    }
  });

  it("모르는 형식은 거절한다", () => {
    expect(InfographicSpec.safeParse({ ...list, format: "이상한값" }).success).toBe(false);
  });

  it("format 이 없으면 거절한다 — 판별자다", () => {
    const { format: _drop, ...noFormat } = list;
    expect(InfographicSpec.safeParse(noFormat).success).toBe(false);
  });

  it("항목 수 하한·상한을 지킨다", () => {
    expect(InfographicSpec.safeParse({ ...list, items: items({ keyword: "온도", desc: "26도" }, 2) }).success).toBe(false);
    expect(InfographicSpec.safeParse({ ...list, items: items({ keyword: "온도", desc: "26도" }, 7) }).success).toBe(false);
    expect(InfographicSpec.safeParse({ ...stat, items: items({ value: "7%", label: "라벨" }, 4) }).success).toBe(false);
    expect(InfographicSpec.safeParse({ ...check, items: items({ text: "하나" }, 3) }).success).toBe(false);
  });

  it("형식이 요구하는 칸이 빠지면 거절한다", () => {
    const { columns: _drop, ...noColumns } = compare;
    expect(InfographicSpec.safeParse(noColumns).success).toBe(false);
    expect(InfographicSpec.safeParse({ ...stat, items: [{ value: "7%" }, { value: "2주" }] }).success).toBe(false);
  });

  it("다른 형식의 항목 모양을 섞으면 거절한다", () => {
    expect(InfographicSpec.safeParse({ ...list, items: items({ text: "하나" }, 3) }).success).toBe(false);
  });
});

/**
 * 형식마다 항목의 칸 이름이 다르다(`keyword/desc` · `label/left/right` · `value/label` · `text`).
 * 점검과 캡션은 그 이름을 알 필요가 없다 — **글만** 필요하다. 그래서 한 번에 읽는다.
 */
describe("itemTexts — 항목이 담은 글", () => {
  it("형식마다 칸 순서대로 읽는다", () => {
    expect(itemTexts({ keyword: "온도", desc: "26도" })).toEqual(["온도", "26도"]);
    expect(itemTexts({ label: "전기세", left: "높음", right: "낮음" })).toEqual(["전기세", "높음", "낮음"]);
    expect(itemTexts({ value: "7%", label: "1도만 올려도" })).toEqual(["7%", "1도만 올려도"]);
    expect(itemTexts({ text: "필터 청소" })).toEqual(["필터 청소"]);
  });

  it("첫 글이 그 항목의 대표다 — 캡션 재료로 쓴다", () => {
    expect(itemTexts({ keyword: "온도", desc: "26도" })[0]).toBe("온도");
    expect(itemTexts({ value: "7%", label: "라벨" })[0]).toBe("7%");
  });
});

describe("itemFieldMaxes — 칸마다 허용 길이", () => {
  it("itemTexts 와 **같은 순서·같은 개수**다 — 어긋나면 엉뚱한 칸을 잰다", () => {
    const samples = {
      list: { keyword: "온도", desc: "26도" },
      compare: { label: "전기세", left: "높음", right: "낮음" },
      steps: { keyword: "전원", desc: "코드를 뽑아요" },
      stat: { value: "7%", label: "라벨" },
      check: { text: "필터 청소" },
    } as const;
    for (const f of INFO_FORMATS) {
      expect(itemFieldMaxes(f.id).length).toBe(itemTexts(samples[f.id]).length);
    }
  });

  it("스키마가 실제로 거절하는 길이와 같다", () => {
    const [keywordMax, descMax] = itemFieldMaxes("list");
    const base = { type: "informationsend" as const, format: "list" as const, title: "제목" };
    const make = (kw: number, d: number) => ({
      ...base,
      items: Array.from({ length: 3 }, () => ({ keyword: "가".repeat(kw), desc: "나".repeat(d) })),
    });
    expect(InfographicSpec.safeParse(make(keywordMax, descMax)).success).toBe(true);
    expect(InfographicSpec.safeParse(make(keywordMax + 1, descMax)).success).toBe(false);
    expect(InfographicSpec.safeParse(make(keywordMax, descMax + 1)).success).toBe(false);
  });
});

/**
 * Claude CLI 는 스키마를 **도구의 input_schema** 로 넘기고, Anthropic API 는 그 최상위에
 * `type` 을 요구한다. union 은 `anyOf` 로 변환돼 `type` 이 없어 **400 으로 거절당한다**
 * (2026-08-05 실제로 그랬다: `tools.0.custom.input_schema.type: Field required`).
 *
 * 사용자가 형식을 골랐으므로 **그 형식의 스키마만** 넘기면 된다.
 */
describe("infoSpecFor — 형식 하나짜리 스키마", () => {
  it("다섯 형식 모두 최상위가 object 다 — 그래야 도구 스키마로 넘길 수 있다", () => {
    for (const f of INFO_FORMATS) {
      const js = z.toJSONSchema(infoSpecFor(f.id)) as { type?: string; anyOf?: unknown };
      expect(js.type).toBe("object");
      expect(js.anyOf).toBeUndefined();
    }
  });

  it("그 형식만 통과시킨다 — 다른 형식을 주면 거절한다", () => {
    const stat = {
      type: "informationsend" as const,
      format: "stat" as const,
      title: "제목",
      items: [
        { value: "7%", label: "라벨" },
        { value: "2주", label: "라벨" },
      ],
    };
    expect(infoSpecFor("stat").safeParse(stat).success).toBe(true);
    expect(infoSpecFor("list").safeParse(stat).success).toBe(false);
  });

  it("union 과 같은 것을 통과시킨다 — 두 자가 어긋나면 안 된다", () => {
    const list = {
      type: "informationsend" as const,
      format: "list" as const,
      title: "제목",
      items: [
        { keyword: "가", desc: "나" },
        { keyword: "다", desc: "라" },
        { keyword: "마", desc: "바" },
      ],
    };
    expect(infoSpecFor("list").safeParse(list).success).toBe(InfographicSpec.safeParse(list).success);
  });
});

/**
 * 사진 수만큼 카드를 만든다(2026-08-09). 예전 하한은 5장이라 사진 3장짜리 결과가 검증에서
 * 튕겼다. hook·cta 두 장은 있어야 시퀀스가 성립하므로 그 아래로는 못 내린다.
 */
describe("카드뉴스 장수 범위", () => {
  // 역할마다 요구하는 칸이 다르다 — cta 는 body 가 아니라 action 이다.
  function card(role: "hook" | "problem" | "cta") {
    if (role === "hook") return { role, heading: "제목" };
    if (role === "cta") return { role, heading: "제목", action: "저장하세요" };
    return { role, heading: "제목", body: "본문" };
  }
  function spec(cards: unknown[]) {
    return { type: "cardnews", keyword: "수원 갈비", cards };
  }

  it("두 장(hook·cta)이면 통과한다", () => {
    expect(CardnewsSpec.safeParse(spec([card("hook"), card("cta")])).success).toBe(true);
  });

  it("한 장이면 거절한다 — hook 과 cta 가 동시에 될 수 없다", () => {
    expect(CardnewsSpec.safeParse(spec([card("hook")])).success).toBe(false);
  });

  it("여섯 장까지 통과한다", () => {
    const middle = Array.from({ length: 4 }, () => card("problem"));
    expect(CardnewsSpec.safeParse(spec([card("hook"), ...middle, card("cta")])).success).toBe(true);
  });

  it("첫 카드가 hook 이 아니면 장수와 무관하게 거절한다", () => {
    expect(CardnewsSpec.safeParse(spec([card("problem"), card("cta")])).success).toBe(false);
  });
});

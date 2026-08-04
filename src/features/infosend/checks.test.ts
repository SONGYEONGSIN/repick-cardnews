import { describe, it, expect } from "vitest";
import { InfographicSpec } from "@/lib/schema";
import { infoChecks, TITLE_MAX, SUBTITLE_MAX, ITEM_KEYWORD_MAX, ITEM_DESC_MAX, TIP_MAX } from "./checks";
import { infoReducer, initialInfoState, ITEMS_MIN, ITEMS_MAX, type InfoState } from "./reducer";
import type { Photo } from "@/lib/photos";

const spec = {
  type: "informationsend" as const,
  format: "list" as const,
  title: "에어컨 전기세",
  subtitle: "오늘 바로 되는 것만",
  items: [
    { keyword: "온도", desc: "24~26도" },
    { keyword: "필터", desc: "2주마다" },
    { keyword: "선풍기", desc: "함께 켜기" },
  ],
  tip: "외출 30분 전에 꺼요",
};

function withSpec(over: Partial<typeof spec> = {}): InfoState {
  return infoReducer(initialInfoState, { type: "SET_SPEC", spec: { ...spec, ...over } });
}

function texts(state: InfoState): string[] {
  return infoChecks(state).map((c) => c.text);
}

/**
 * 손으로 베낀 상한은 스키마와 어긋나는 순간 거짓 경고가 된다 — 화면은 "넘었다"는데 서버는
 * 받아 주거나, 그 반대가 된다. 이 저장소는 그렇게 드리프트를 잡아 왔다(`MAX_STEPS`,
 * `HEADING_MAX`). 여기서 스키마 자체에 물어본다.
 */
describe("상한이 스키마와 같다", () => {
  /** zod 스키마가 실제로 거절하기 시작하는 길이를 재서 상한을 알아낸다. */
  function acceptsLength(build: (filler: string) => unknown, length: number): boolean {
    return InfographicSpec.safeParse(build("가".repeat(length))).success;
  }

  it("제목 상한", () => {
    expect(acceptsLength((t) => ({ ...spec, title: t }), TITLE_MAX)).toBe(true);
    expect(acceptsLength((t) => ({ ...spec, title: t }), TITLE_MAX + 1)).toBe(false);
  });

  it("부제 상한", () => {
    expect(acceptsLength((t) => ({ ...spec, subtitle: t }), SUBTITLE_MAX)).toBe(true);
    expect(acceptsLength((t) => ({ ...spec, subtitle: t }), SUBTITLE_MAX + 1)).toBe(false);
  });

  it("항목 키워드 상한", () => {
    const build = (t: string) => ({ ...spec, items: [{ keyword: t, desc: "설명" }, ...spec.items.slice(1)] });
    expect(acceptsLength(build, ITEM_KEYWORD_MAX)).toBe(true);
    expect(acceptsLength(build, ITEM_KEYWORD_MAX + 1)).toBe(false);
  });

  it("항목 설명 상한", () => {
    const build = (t: string) => ({ ...spec, items: [{ keyword: "키워드", desc: t }, ...spec.items.slice(1)] });
    expect(acceptsLength(build, ITEM_DESC_MAX)).toBe(true);
    expect(acceptsLength(build, ITEM_DESC_MAX + 1)).toBe(false);
  });

  it("팁 상한", () => {
    expect(acceptsLength((t) => ({ ...spec, tip: t }), TIP_MAX)).toBe(true);
    expect(acceptsLength((t) => ({ ...spec, tip: t }), TIP_MAX + 1)).toBe(false);
  });

  it("항목 수 상한·하한", () => {
    const items = (n: number) => Array.from({ length: n }, () => ({ keyword: "키", desc: "설명" }));
    expect(InfographicSpec.safeParse({ ...spec, items: items(ITEMS_MIN) }).success).toBe(true);
    expect(InfographicSpec.safeParse({ ...spec, items: items(ITEMS_MIN - 1) }).success).toBe(false);
    expect(InfographicSpec.safeParse({ ...spec, items: items(ITEMS_MAX) }).success).toBe(true);
    expect(InfographicSpec.safeParse({ ...spec, items: items(ITEMS_MAX + 1) }).success).toBe(false);
  });
});

describe("infoChecks", () => {
  it("카피가 아직 없으면 점검할 게 없다 — 만들기 전에 고칠 거리를 말하지 않는다", () => {
    expect(infoChecks(initialInfoState)).toEqual([]);
  });

  it("다 되면 내보낼 수 있다고 말한다", () => {
    expect(infoChecks(withSpec())).toEqual([{ tone: "ok", text: "다 됐어요. 내보낼 수 있어요." }]);
  });

  it("제목이 비면 짚는다", () => {
    expect(texts(withSpec({ title: "   " }))).toContain("제목이 비어 있어요");
  });

  it("내용이 빈 항목을 센다", () => {
    const state = withSpec({
      items: [
        { keyword: "", desc: "설명" },
        { keyword: "필터", desc: "  " },
        { keyword: "선풍기", desc: "함께 켜기" },
      ],
    });
    expect(texts(state)).toContain("내용이 빈 항목 2개");
  });

  it("글자 수를 넘긴 곳을 센다 — 제목·부제·항목·팁 어디든", () => {
    const state = withSpec({
      title: "가".repeat(TITLE_MAX + 1),
      tip: "나".repeat(TIP_MAX + 1),
      items: [
        { keyword: "다".repeat(ITEM_KEYWORD_MAX + 1), desc: "설명" },
        { keyword: "필터", desc: "라".repeat(ITEM_DESC_MAX + 1) },
        { keyword: "선풍기", desc: "함께 켜기" },
      ],
    });
    expect(texts(state)).toContain("글자 수를 넘긴 곳 4군데");
  });

  it("항목이 모자라면 몇 개부터인지 말한다", () => {
    const state = withSpec({ items: [{ keyword: "온도", desc: "24~26도" }] });
    expect(texts(state)).toContain(`항목이 1개예요 — ${ITEMS_MIN}개부터 채워 주세요`);
  });

  // 사진은 **선택**이다(2026-08-04). 없다고 경고하면 아무 문제 없는 상태가 결함으로 읽힌다.
  it("사진이 없어도 경고하지 않는다", () => {
    expect(infoChecks(withSpec())).toEqual([{ tone: "ok", text: "다 됐어요. 내보낼 수 있어요." }]);
  });

  it("사진을 올린 상태여도 판정이 달라지지 않는다", () => {
    const photo: Photo = {
      id: "p1",
      name: "a.png",
      dataUrl: "data:image/png;base64,AA",
      thumbUrl: "data:image/png;base64,AA",
      width: 800,
      height: 1000,
      bytes: 2,
    };
    const withPhoto = infoReducer(withSpec(), { type: "ADD_PHOTOS", photos: [photo] });
    expect(infoChecks(withPhoto)).toEqual([{ tone: "ok", text: "다 됐어요. 내보낼 수 있어요." }]);
  });
});

/**
 * 점검도 형식마다 다르다 — 비교형은 **세 칸이 다 차야** 하고, 형식마다 항목 수 하한이 다르다.
 * 목록형 기준 하나로 재면 비교형에서 절반만 채워도 "다 됐어요" 가 나온다.
 */
describe("형식별 점검", () => {
  const base = { type: "informationsend" as const, title: "제목", subtitle: "부제", tip: "팁" };
  const seed = (spec: object) => infoReducer(initialInfoState, { type: "SET_SPEC", spec: spec as never });

  it("비교형은 한 칸만 비어도 짚는다", () => {
    const s = seed({
      ...base,
      format: "compare",
      columns: { left: "A", right: "B" },
      items: [
        { label: "기준", left: "왼", right: "" },
        { label: "기준2", left: "왼", right: "오" },
        { label: "기준3", left: "왼", right: "오" },
      ],
    });
    expect(infoChecks(s).some((c) => c.text.includes("빈 항목"))).toBe(true);
  });

  it("숫자형은 두 개면 충분하다 — 목록형 하한(3)으로 재지 않는다", () => {
    const s = seed({
      ...base,
      format: "stat",
      items: [
        { value: "7%", label: "설명" },
        { value: "2주", label: "설명" },
      ],
    });
    expect(infoChecks(s)).toEqual([{ tone: "ok", text: "다 됐어요. 내보낼 수 있어요." }]);
  });

  it("체크리스트는 넷부터다 — 셋이면 짚는다", () => {
    const s = seed({ ...base, format: "check", items: [{ text: "하나" }, { text: "둘" }, { text: "셋" }] });
    expect(infoChecks(s).some((c) => c.text.includes("4개부터"))).toBe(true);
  });

  it("형식마다 글자 수 상한이 다르다 — 숫자 값은 8자다", () => {
    const s = seed({
      ...base,
      format: "stat",
      items: [
        { value: "가".repeat(9), label: "설명" },
        { value: "2주", label: "설명" },
      ],
    });
    expect(infoChecks(s).some((c) => c.text.includes("글자 수"))).toBe(true);
  });
});

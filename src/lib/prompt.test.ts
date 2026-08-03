import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserContent } from "@/lib/prompt";

const vault = { brandVoice: "해요체 기본", copyFormulas: "hook→problem→evidence→solution→cta" };

describe("buildSystemPrompt", () => {
  it("볼트 텍스트를 프롬프트에 주입한다", () => {
    const p = buildSystemPrompt("cardnews", vault, false);
    expect(p).toContain("해요체 기본");
    expect(p).toContain("hook→problem→evidence→solution→cta");
  });
  it("유형별 출력 규칙을 포함한다", () => {
    expect(buildSystemPrompt("informationsend", vault, false)).toContain("informationsend");
    expect(buildSystemPrompt("cardnews", vault, false)).toContain("cardnews");
  });
  it("정보전달은 항목을 3~4개로 요청한다", () => {
    expect(buildSystemPrompt("informationsend", vault, false)).toContain("items 3~4개");
  });
});

describe("buildUserContent", () => {
  const P1 = "data:image/jpeg;base64,AAA";
  const P2 = "data:image/png;base64,BBB";

  it("사진이 없으면 텍스트 블록 하나만 만든다", () => {
    const blocks = buildUserContent("에어컨 전기세", []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
  });

  it("사진을 먼저 순서대로 넣고 텍스트를 마지막에 넣는다", () => {
    const blocks = buildUserContent("에어컨 전기세", [P1, P2]);
    expect(blocks.map((b) => b.type)).toEqual(["image", "image", "text"]);
  });

  it("이미지 블록에 media type과 base64를 갈라 담는다", () => {
    const [first] = buildUserContent("k", [P1]);
    expect(first).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "AAA" },
    });
  });

  it("사진이 있으면 텍스트에 장수와 순서를 알린다", () => {
    const blocks = buildUserContent("에어컨 전기세", [P1, P2]);
    const text = blocks[blocks.length - 1];
    if (text.type !== "text") throw new Error("마지막은 텍스트 블록이어야 합니다");
    expect(text.text).toContain("2장");
    expect(text.text).toContain("에어컨 전기세");
  });

  it("지원하지 않는 이미지 형식이면 던진다", () => {
    expect(() => buildUserContent("k", ["data:image/svg+xml;base64,AAA"])).toThrow(
      "지원하지 않는 이미지 형식입니다",
    );
  });
});

describe("buildSystemPrompt 사진 규칙", () => {
  const vault = { brandVoice: "보이스", copyFormulas: "공식" };

  it("사진이 없으면 사진 규칙을 넣지 않는다", () => {
    expect(buildSystemPrompt("cardnews", vault, false)).not.toContain("사진");
  });
  it("카드뉴스는 N번째 사진이 N번째 카드라고 알린다", () => {
    expect(buildSystemPrompt("cardnews", vault, true)).toContain("N번째 사진");
  });
  it("정보전달은 대표 이미지 규칙을 쓴다", () => {
    expect(buildSystemPrompt("informationsend", vault, true)).toContain("대표 이미지");
  });
  it("사진이 있으면 없는 것을 지어내지 말라고 공통으로 못박는다", () => {
    expect(buildSystemPrompt("cardnews", vault, true)).toContain("보이지 않는 것");
    expect(buildSystemPrompt("informationsend", vault, true)).toContain("보이지 않는 것");
  });
});

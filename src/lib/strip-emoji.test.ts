import { describe, it, expect } from "vitest";
import { stripEmoji, stripEmojiDeep } from "@/lib/strip-emoji";

/**
 * 카피는 Claude 가 쓴다. 시키지 않아도 이모지를 얹어 오는데(실제로 그랬다, 2026-08-04:
 * `여름 전기세 줄이는 4가지 방법 💸`, `✅ TIP ✅`), 카드에서는 제목을 한 줄 더 밀어내 띠를
 * 키우고 팁 앞에 군더더기를 남긴다. 생성 단계에서 걷어낸다.
 */
describe("stripEmoji", () => {
  it("문장 끝 이모지를 뗀다", () => {
    expect(stripEmoji("여름 전기세 줄이는 4가지 방법 💸")).toBe("여름 전기세 줄이는 4가지 방법");
  });

  it("앞뒤로 감싼 이모지를 뗀다", () => {
    expect(stripEmoji("✅ TIP ✅ 검침일 기준으로 확인해요")).toBe("TIP 검침일 기준으로 확인해요");
  });

  it("이모지를 떼며 생긴 이중 공백을 하나로 줄인다", () => {
    expect(stripEmoji("에어컨 🌬️ 26도 유지")).toBe("에어컨 26도 유지");
  });

  it("국기·변형 선택자·영문자 이모지 조합도 뗀다", () => {
    expect(stripEmoji("여름🇰🇷 정리 ❤️ 끝")).toBe("여름 정리 끝");
  });

  // 카드 글에 실제로 쓰이는 기호까지 지우면 안 된다 — 온도·퍼센트가 사라지면 뜻이 바뀐다.
  it("한글·숫자·일반 기호는 건드리지 않는다", () => {
    expect(stripEmoji("에어컨 26°C 유지 · 60%만 채우기 (권장)")).toBe("에어컨 26°C 유지 · 60%만 채우기 (권장)");
    expect(stripEmoji("A/S 문의 → 1588-0000")).toBe("A/S 문의 → 1588-0000");
  });

  it("이모지뿐인 글은 빈 문자열이 된다", () => {
    expect(stripEmoji("💸💸")).toBe("");
  });
});

describe("stripEmojiDeep — 스펙 전체를 훑는다", () => {
  it("중첩된 문자열까지 모두 지운다", () => {
    const spec = {
      type: "informationsend",
      title: "여름 전기세 💸",
      items: [{ keyword: "에어컨 🌬️", desc: "26도로 맞춰요 ✅" }],
      tip: "✅ TIP ✅ 미리 확인해요",
    };
    expect(stripEmojiDeep(spec)).toEqual({
      type: "informationsend",
      title: "여름 전기세",
      items: [{ keyword: "에어컨", desc: "26도로 맞춰요" }],
      tip: "TIP 미리 확인해요",
    });
  });

  it("문자열이 아닌 값은 그대로 둔다", () => {
    expect(stripEmojiDeep({ n: 5, ok: true, none: null })).toEqual({ n: 5, ok: true, none: null });
  });
});

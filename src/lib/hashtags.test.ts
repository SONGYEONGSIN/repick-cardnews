import { describe, it, expect } from "vitest";
import { MAX_HASHTAGS, parseHashtags, validateHashtagCount, combineCaptionWithHashtags } from "@/lib/hashtags";

describe("parseHashtags", () => {
  it("빈 문자열은 0개로 파싱한다", () => {
    expect(parseHashtags("")).toEqual([]);
    expect(parseHashtags("   ")).toEqual([]);
  });

  it("공백·쉼표로 구분된 태그를 쪼갠다", () => {
    expect(parseHashtags("다이어트 헬스,운동")).toEqual(["다이어트", "헬스", "운동"]);
  });

  it("# 을 붙이든 안 붙이든 같은 값으로 정리한다", () => {
    expect(parseHashtags("#다이어트 헬스")).toEqual(["다이어트", "헬스"]);
  });

  it("중복 태그는 처음 나온 것만 남긴다", () => {
    expect(parseHashtags("다이어트 #다이어트 헬스")).toEqual(["다이어트", "헬스"]);
  });

  it("5개는 그대로 5개로 파싱된다", () => {
    expect(parseHashtags("가 나 다 라 마")).toHaveLength(5);
  });

  it("6개를 넣어도 파싱 자체는 6개를 그대로 돌려준다 (개수 제한은 validateHashtagCount 몫)", () => {
    expect(parseHashtags("가 나 다 라 마 바")).toHaveLength(6);
  });
});

describe("validateHashtagCount", () => {
  it("0개는 통과한다", () => {
    expect(validateHashtagCount([])).toEqual({ ok: true });
  });

  it(`${MAX_HASHTAGS}개는 통과한다`, () => {
    const tags = Array.from({ length: MAX_HASHTAGS }, (_, i) => `태그${i}`);
    expect(validateHashtagCount(tags)).toEqual({ ok: true });
  });

  it(`${MAX_HASHTAGS + 1}개는 한국어 사유와 함께 막는다`, () => {
    const tags = Array.from({ length: MAX_HASHTAGS + 1 }, (_, i) => `태그${i}`);
    const result = validateHashtagCount(tags);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/[가-힣]/);
      expect(result.message).toContain(String(MAX_HASHTAGS));
    }
  });
});

describe("combineCaptionWithHashtags", () => {
  it("해시태그가 없으면 캡션만 돌려준다", () => {
    expect(combineCaptionWithHashtags("오늘의 카드뉴스", [])).toBe("오늘의 카드뉴스");
  });

  it("캡션 뒤에 빈 줄을 두고 #태그를 나열한다", () => {
    expect(combineCaptionWithHashtags("오늘의 카드뉴스", ["다이어트", "헬스"])).toBe(
      "오늘의 카드뉴스\n\n#다이어트 #헬스"
    );
  });

  it("캡션이 비어 있으면 태그 줄만 돌려준다", () => {
    expect(combineCaptionWithHashtags("", ["다이어트"])).toBe("#다이어트");
  });
});

import { describe, it, expect } from "vitest";
import { MAX_HASHTAGS } from "@/lib/hashtags";
import { defaultCaption, defaultHashtags } from "./caption-draft";

describe("defaultCaption — 카드에서 뽑아 채워 둔다", () => {
  const headings = ["이 윤기, 사 먹는 맛 아니에요", "대부분 이 코팅에서 실패해요", "저장하고 오늘 저녁에 도전"];

  it("첫 헤드라인이 첫 줄이다 — 후크가 캡션의 첫인상이다", () => {
    expect(defaultCaption("수원 갈비", headings).split("\n")[0]).toBe(headings[0]);
  });

  it("나머지 헤드라인을 순서대로 담는다", () => {
    const caption = defaultCaption("수원 갈비", headings);

    expect(caption).toContain(headings[1]);
    expect(caption).toContain(headings[2]);
  });

  it("빈 헤드라인은 건너뛴다 — 빈 줄만 늘리지 않는다", () => {
    const caption = defaultCaption("수원 갈비", ["제목", "   ", "", "마무리"]);

    expect(caption).toBe("제목\n\n· 마무리");
  });

  it("헤드라인이 하나면 그 한 줄뿐이다", () => {
    expect(defaultCaption("수원 갈비", ["제목"])).toBe("제목");
  });

  it("헤드라인이 없으면 주제를 쓴다 — 빈 캡션을 주지 않는다", () => {
    expect(defaultCaption("수원 갈비", [])).toBe("수원 갈비");
    expect(defaultCaption("수원 갈비", ["  ", ""])).toBe("수원 갈비");
  });

  it("주제도 헤드라인도 없으면 빈 문자열이다", () => {
    expect(defaultCaption("", [])).toBe("");
  });

  it("인스타 캡션 상한(2200자)을 넘기지 않는다", () => {
    const many = Array.from({ length: 200 }, (_, i) => `${i}`.repeat(40));

    expect(defaultCaption("주제", many).length).toBeLessThanOrEqual(2200);
  });
});

describe("defaultHashtags — 주제에서 뽑는다", () => {
  it("주제를 붙여 쓴 태그를 먼저 넣는다", () => {
    expect(defaultHashtags("수원 갈비")[0]).toBe("수원갈비");
  });

  it("주제의 낱말도 태그로 넣는다", () => {
    expect(defaultHashtags("수원 갈비")).toContain("수원");
    expect(defaultHashtags("수원 갈비")).toContain("갈비");
  });

  it("한 글자 낱말은 버린다 — 태그로 쓸모가 없다", () => {
    expect(defaultHashtags("이 갈비")).not.toContain("이");
  });

  it("상한을 넘지 않는다", () => {
    const tags = defaultHashtags("가나 다라 마바 사아 자차 카타 파하");

    expect(tags.length).toBeLessThanOrEqual(MAX_HASHTAGS);
  });

  it("같은 태그를 두 번 넣지 않는다", () => {
    const tags = defaultHashtags("갈비");

    expect(new Set(tags).size).toBe(tags.length);
  });

  it("주제가 없으면 빈 배열이다 — 아무 태그나 지어내지 않는다", () => {
    expect(defaultHashtags("")).toEqual([]);
    expect(defaultHashtags("   ")).toEqual([]);
  });

  it("`#` 을 붙이지 않는다 — 저장은 이름만 하고 붙이는 건 합칠 때 한다", () => {
    for (const tag of defaultHashtags("수원 갈비")) {
      expect(tag).not.toContain("#");
    }
  });
});

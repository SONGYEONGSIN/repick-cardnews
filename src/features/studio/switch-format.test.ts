import { describe, it, expect } from "vitest";
import { KEYWORD_MAX, switchHref, keywordFromParam } from "./switch-format";

/**
 * 형태 전환(`/` ↔ `/info`)은 **라우트 이동**이라, 넘어간 화면이 상태를 새로 만든다. 그래서
 * 주소에 주제를 실어 보내고 받는 쪽이 그 값으로 시작한다 — 안 그러면 형태를 바꿀 때마다
 * 쓰던 주제가 사라진다(실제로 그랬다, 2026-08-04).
 */
describe("switchHref — 주제를 실어 보낸다", () => {
  it("주제가 있으면 주소에 붙인다", () => {
    expect(switchHref("/info", "여름 전기세")).toBe("/info?keyword=%EC%97%AC%EB%A6%84+%EC%A0%84%EA%B8%B0%EC%84%B8");
  });

  it("주제가 비면 그냥 그 경로다 — 빈 값을 실어 보내지 않는다", () => {
    expect(switchHref("/info", "")).toBe("/info");
    expect(switchHref("/", "   ")).toBe("/");
  });

  it("앞뒤 공백은 떼고 보낸다", () => {
    expect(switchHref("/", "  에어컨  ")).toBe("/?keyword=%EC%97%90%EC%96%B4%EC%BB%A8");
  });

  it("물음표·앰퍼샌드가 들어가도 주소가 깨지지 않는다", () => {
    const href = switchHref("/info", "전기세 아끼는 법?&정리");
    expect(new URLSearchParams(href.slice(href.indexOf("?"))).get("keyword")).toBe("전기세 아끼는 법?&정리");
  });
});

describe("keywordFromParam — 받는 쪽이 읽는다", () => {
  it("값을 그대로 읽는다", () => {
    expect(keywordFromParam("여름 전기세")).toBe("여름 전기세");
  });

  it("없으면 빈 문자열이다", () => {
    expect(keywordFromParam(undefined)).toBe("");
  });

  it("같은 이름이 여러 번 오면 첫 값만 쓴다", () => {
    expect(keywordFromParam(["첫째", "둘째"])).toBe("첫째");
  });

  it("앞뒤 공백을 떼고, 입력칸 상한까지만 받는다 — 주소로 더 긴 값을 밀어 넣지 못한다", () => {
    expect(keywordFromParam("  에어컨  ")).toBe("에어컨");
    expect(keywordFromParam("가".repeat(KEYWORD_MAX + 10))).toHaveLength(KEYWORD_MAX);
  });

  it("줄바꿈은 지운다 — 한 줄 입력칸이다", () => {
    expect(keywordFromParam("여름\n전기세")).toBe("여름 전기세");
  });
});

import { describe, it, expect } from "vitest";
import { parseBody } from "@/app/api/generate/route";

describe("parseBody", () => {
  it("유효한 입력을 파싱한다", () => {
    expect(parseBody({ keyword: "에어컨 전기세", type: "cardnews" })).toEqual({ keyword: "에어컨 전기세", type: "cardnews" });
  });
  it("빈 키워드를 거부한다", () => {
    expect(() => parseBody({ keyword: "  ", type: "cardnews" })).toThrow();
  });
  it("잘못된 type을 거부한다", () => {
    expect(() => parseBody({ keyword: "x", type: "banner" })).toThrow();
  });
});

import { describe, it, expect } from "vitest";
import { parseBody } from "@/app/api/generate/route";

describe("parseBody", () => {
  it("유효한 입력을 파싱한다", () => {
    expect(parseBody({ keyword: "에어컨 전기세", type: "cardnews" })).toEqual({
      keyword: "에어컨 전기세",
      type: "cardnews",
      photos: [],
    });
  });
  it("빈 키워드를 거부한다", () => {
    expect(() => parseBody({ keyword: "  ", type: "cardnews" })).toThrow();
  });
  it("잘못된 type을 거부한다", () => {
    expect(() => parseBody({ keyword: "x", type: "banner" })).toThrow();
  });
});

describe("parseBody photos", () => {
  const base = { keyword: "에어컨", type: "cardnews" as const };

  it("photos가 없으면 빈 배열로 채운다", () => {
    expect(parseBody(base).photos).toEqual([]);
  });
  it("dataURL 배열을 받는다", () => {
    const photos = ["data:image/jpeg;base64,AAA"];
    expect(parseBody({ ...base, photos }).photos).toEqual(photos);
  });
  it("6장을 넘으면 거부한다", () => {
    const photos = Array.from({ length: 7 }, () => "data:image/jpeg;base64,AAA");
    expect(() => parseBody({ ...base, photos })).toThrow();
  });
  it("dataURL이 아니면 거부한다", () => {
    expect(() => parseBody({ ...base, photos: ["https://example.com/a.jpg"] })).toThrow();
  });
  it("Anthropic이 지원하지 않는 이미지 형식이면 거부한다", () => {
    expect(() => parseBody({ ...base, photos: ["data:image/svg+xml;base64,AAA"] })).toThrow();
  });
});

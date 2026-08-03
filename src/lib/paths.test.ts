import { describe, it, expect } from "vitest";
import { slugify, outputDir, outputFile } from "@/lib/paths";

describe("slugify", () => {
  it("공백을 하이픈으로, 특수문자를 제거한다", () => {
    expect(slugify("에어컨 전기세!!  절약")).toBe("에어컨-전기세-절약");
  });
  it("영문은 소문자화한다", () => {
    expect(slugify("Mont Bell")).toBe("mont-bell");
  });
});

describe("outputDir / outputFile", () => {
  it("유형/슬러그-날짜 디렉터리를 만든다", () => {
    expect(outputDir("cardnews", "에어컨 전기세", "0720")).toBe("cardnews/에어컨-전기세-0720");
  });
  it("인덱스로 png 경로를 만든다", () => {
    expect(outputFile("cardnews/에어컨-전기세-0720", 1)).toBe("cardnews/에어컨-전기세-0720/1.png");
  });
});

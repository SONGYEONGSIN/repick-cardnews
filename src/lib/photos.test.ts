import { describe, it, expect } from "vitest";
import { parseDataUrl, isFourFive, downscaleSize, compareFileNames, THUMB_MAX } from "@/lib/photos";

describe("parseDataUrl", () => {
  it("media type과 base64 본문을 분리한다", () => {
    expect(parseDataUrl("data:image/jpeg;base64,AAAB")).toEqual({ mediaType: "image/jpeg", base64: "AAAB" });
  });
  it("png도 분리한다", () => {
    expect(parseDataUrl("data:image/png;base64,QUJD")).toEqual({ mediaType: "image/png", base64: "QUJD" });
  });
  it("dataURL 형식이 아니면 던진다", () => {
    expect(() => parseDataUrl("https://example.com/a.jpg")).toThrow();
  });
});

describe("isFourFive", () => {
  it("1080x1350은 4:5다", () => {
    expect(isFourFive(1080, 1350)).toBe(true);
  });
  it("2160x2700도 4:5다", () => {
    expect(isFourFive(2160, 2700)).toBe(true);
  });
  it("정사각형은 4:5가 아니다", () => {
    expect(isFourFive(1000, 1000)).toBe(false);
  });
  it("가로 사진은 4:5가 아니다", () => {
    expect(isFourFive(1600, 900)).toBe(false);
  });
  it("허용 오차 안이면 4:5로 본다", () => {
    expect(isFourFive(1080, 1340)).toBe(true);
  });
});

describe("downscaleSize", () => {
  it("최장변이 max 이하면 그대로 둔다", () => {
    expect(downscaleSize(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });
  it("세로가 길면 세로를 max에 맞춘다", () => {
    expect(downscaleSize(1080, 1350, 1024)).toEqual({ width: 819, height: 1024 });
  });
  it("가로가 길면 가로를 max에 맞춘다", () => {
    expect(downscaleSize(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
  });
  it("THUMB_MAX는 1024다", () => {
    expect(THUMB_MAX).toBe(1024);
  });
});

describe("compareFileNames", () => {
  it("숫자를 사전순이 아니라 수의 크기로 비교한다", () => {
    const sorted = ["10.jpg", "2.jpg", "1.jpg"].sort(compareFileNames);
    expect(sorted).toEqual(["1.jpg", "2.jpg", "10.jpg"]);
  });
  it("접두사가 있어도 숫자 순으로 정렬한다", () => {
    const sorted = ["img-12.png", "img-3.png"].sort(compareFileNames);
    expect(sorted).toEqual(["img-3.png", "img-12.png"]);
  });
});

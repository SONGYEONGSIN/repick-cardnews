import { describe, expect, it } from "vitest";
import { isLikelyImage, shouldPickFolder, skippedNotice } from "./photo-intake";

describe("isLikelyImage", () => {
  it("브라우저가 이미지라고 말하면 받는다", () => {
    expect(isLikelyImage({ name: "무엇이든", type: "image/jpeg" })).toBe(true);
    expect(isLikelyImage({ name: "무엇이든", type: "image/heic" })).toBe(true);
  });

  // 아이폰 기본 형식이다. 확장자만 보고 거르면 폰에서 올린 사진이 조용히 사라진다 —
  // 실제로 5장을 올렸는데 4장만 들어갔다(2026-08-09).
  it("heic·heif 를 받는다", () => {
    expect(isLikelyImage({ name: "IMG_0001.HEIC", type: "" })).toBe(true);
    expect(isLikelyImage({ name: "IMG_0002.heif", type: "" })).toBe(true);
  });

  it("예전부터 받던 형식도 그대로 받는다", () => {
    for (const name of ["a.jpg", "b.JPEG", "c.png", "d.webp"]) {
      expect(isLikelyImage({ name, type: "" }), name).toBe(true);
    }
  });

  it("이미지가 아니면 거른다", () => {
    expect(isLikelyImage({ name: "메모.txt", type: "text/plain" })).toBe(false);
    expect(isLikelyImage({ name: "영상.mp4", type: "video/mp4" })).toBe(false);
    expect(isLikelyImage({ name: "확장자없음", type: "" })).toBe(false);
  });
});

describe("skippedNotice", () => {
  it("빠진 게 없으면 아무 말도 하지 않는다", () => {
    expect(skippedNotice(5, [])).toBeNull();
  });

  // 조용히 버리는 것이 이 버그의 본체였다. 몇 장이 왜 빠졌는지 반드시 말한다.
  it("몇 장 중 몇 장인지와 이유를 말한다", () => {
    const msg = skippedNotice(4, [{ name: "IMG_0001.HEIC", reason: "unreadable" }]);
    expect(msg).toContain("5장 중 4장");
    expect(msg).toContain("IMG_0001.HEIC");
    expect(msg).toMatch(/[가-힣]/);
  });

  it("이미지가 아닌 파일은 그렇게 말한다", () => {
    const msg = skippedNotice(2, [{ name: "메모.txt", reason: "not-image" }]);
    expect(msg).toContain("메모.txt");
    expect(msg).toContain("이미지");
  });

  it("여러 개면 이름을 셋까지만 대고 나머지는 개수로 말한다", () => {
    const msg = skippedNotice(1, [
      { name: "a.heic", reason: "unreadable" },
      { name: "b.heic", reason: "unreadable" },
      { name: "c.heic", reason: "unreadable" },
      { name: "d.heic", reason: "unreadable" },
    ]);
    expect(msg).toContain("a.heic");
    expect(msg).toContain("c.heic");
    expect(msg).not.toContain("d.heic");
    expect(msg).toContain("1개");
  });

  it("영문 원문이 새어 나오지 않는다", () => {
    const msg = skippedNotice(0, [{ name: "사진.heic", reason: "unreadable" }]);
    expect(msg?.replace(/사진\.heic/g, "")).not.toMatch(/[A-Za-z]{4,}/);
  });
});

/**
 * 폰에서 "폴더 선택" 을 누르면 **앨범이 아니라 파일 관리자**가 떴다(사장님 보고, 2026-08-09).
 * `webkitdirectory`(폴더 통째 선택) 때문이다 — 데스크톱에서는 이 저장소의 핵심 동작이지만,
 * 폰에는 그런 식의 사진 폴더가 없어서 문서 앱으로 새어 나간다.
 */
describe("shouldPickFolder", () => {
  it("마우스가 있는 기기에서는 폴더를 고른다 — 이 도구의 원래 방식", () => {
    expect(shouldPickFolder({ coarsePointer: false, supportsDirectory: true })).toBe(true);
  });

  it("손가락으로 쓰는 기기에서는 앨범을 연다", () => {
    expect(shouldPickFolder({ coarsePointer: true, supportsDirectory: true })).toBe(false);
  });

  it("브라우저가 폴더 선택을 모르면 앨범을 연다", () => {
    expect(shouldPickFolder({ coarsePointer: false, supportsDirectory: false })).toBe(false);
  });
});

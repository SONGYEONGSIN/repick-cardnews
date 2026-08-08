import { describe, expect, it } from "vitest";
import { imagePath, metaPath, orderImageUrls, parseShareMeta, sharePrefix } from "./share-blob";

describe("경로", () => {
  it("토큰 아래에 번호를 붙인다", () => {
    expect(imagePath("abc", 0)).toBe("share/abc/1.png");
    expect(imagePath("abc", 9)).toBe("share/abc/10.png");
  });

  it("메타와 접두사는 같은 토큰 폴더를 가리킨다", () => {
    expect(metaPath("abc")).toBe("share/abc/meta.json");
    expect(sharePrefix("abc")).toBe("share/abc/");
  });

  // 접두사에 슬래시가 없으면 `share/abc` 가 `share/abcdef` 까지 걸어온다.
  it("접두사는 슬래시로 끝난다 — 이름이 겹치는 다른 토큰을 끌어오지 않게", () => {
    expect(sharePrefix("abc").endsWith("/")).toBe(true);
  });
});

describe("orderImageUrls", () => {
  // 목록 API 가 어떤 순서로 주는지는 보장되지 않는다. 카드 순서가 뒤집히면 카드뉴스가
  // 뒤죽박죽 올라간다 — 되돌릴 수 없는 실수다.
  it("파일 이름의 번호순으로 세운다", () => {
    const urls = orderImageUrls([
      { pathname: "share/t/10.png", url: "u10" },
      { pathname: "share/t/2.png", url: "u2" },
      { pathname: "share/t/1.png", url: "u1" },
    ]);
    expect(urls).toEqual(["u1", "u2", "u10"]);
  });

  it("문자열 정렬이 아니라 숫자 정렬이다", () => {
    const urls = orderImageUrls([
      { pathname: "share/t/2.png", url: "u2" },
      { pathname: "share/t/10.png", url: "u10" },
    ]);
    expect(urls).toEqual(["u2", "u10"]);
  });

  it("png 가 아닌 것은 뺀다 — meta.json 이 섞이면 인스타에 JSON 을 올리게 된다", () => {
    const urls = orderImageUrls([
      { pathname: "share/t/meta.json", url: "meta" },
      { pathname: "share/t/1.png", url: "u1" },
    ]);
    expect(urls).toEqual(["u1"]);
  });

  it("빈 목록은 빈 배열", () => {
    expect(orderImageUrls([])).toEqual([]);
  });
});

describe("parseShareMeta", () => {
  it("모양이 맞으면 값을 돌려준다", () => {
    expect(parseShareMeta({ keyword: "여름", issuedAt: 1700 })).toEqual({ keyword: "여름", issuedAt: 1700 });
  });

  it("모양이 아니면 null — 저장소가 깨졌을 때 화면이 터지지 않게", () => {
    expect(parseShareMeta(null)).toBeNull();
    expect(parseShareMeta("문자열")).toBeNull();
    expect(parseShareMeta({ keyword: "여름" })).toBeNull();
    expect(parseShareMeta({ issuedAt: 1700 })).toBeNull();
    expect(parseShareMeta({ keyword: 1, issuedAt: 1700 })).toBeNull();
    expect(parseShareMeta({ keyword: "여름", issuedAt: "1700" })).toBeNull();
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  COUPANG_SEASONAL_CATEGORIES,
  buildCoupangAuth,
  coupangBestUrl,
  fetchCoupangBestSellers,
  friendlyCoupangError,
  parseCoupangBest,
} from "@/lib/coupang-best";

/**
 * 쿠팡은 **"사람들이 지금 무엇을 사는가"** 를 준다 — 유튜브(보는 것)·네이버(찾는 것)와 다른
 * 축이다. 실측(2026-08-05): 주방용품 1~5위를 물안경·물총·비치볼이 먹었다. 영상 급상승으로는
 * 안 잡히는 신호다.
 *
 * **상품명을 주제로 쓰지 않는다.** 그 목록을 증거로 Claude 가 주제를 뽑는다.
 */
describe("COUPANG_SEASONAL_CATEGORIES", () => {
  it("계절이 드러나는 카테고리만 담는다", () => {
    expect(COUPANG_SEASONAL_CATEGORIES.length).toBeGreaterThan(0);
    for (const c of COUPANG_SEASONAL_CATEGORIES) {
      expect(c.id).toMatch(/^\d+$/);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  // 실측(2026-08-05): 생활용품(키친타월·건전지)·반려(배변패드)·출산유아(물티슈)는 1년 내내
  // 같은 소모품이 1위라 계절 신호가 없다. 넣으면 잡음만 는다.
  it("소모품만 나오는 카테고리는 뺀다", () => {
    const ids = COUPANG_SEASONAL_CATEGORIES.map((c) => c.id);
    expect(ids).not.toContain("1013");
    expect(ids).not.toContain("1022");
    expect(ids).not.toContain("1011");
  });
});

describe("buildCoupangAuth — CEA 서명", () => {
  const at = new Date("2026-08-05T14:30:00Z");

  it("서명한 시각을 yyMMddTHHmmssZ 로 넣는다", () => {
    const header = buildCoupangAuth("GET", "/p", "", { accessKey: "AK", secretKey: "SK" }, at);
    expect(header).toContain("signed-date=260805T143000Z");
  });

  it("액세스 키는 담고 시크릿은 담지 않는다", () => {
    const header = buildCoupangAuth("GET", "/p", "", { accessKey: "AK", secretKey: "SECRET-VALUE" }, at);
    expect(header).toContain("access-key=AK");
    expect(header).not.toContain("SECRET-VALUE");
  });

  it("경로나 질의가 다르면 서명도 다르다 — 그래야 위조가 안 된다", () => {
    const a = buildCoupangAuth("GET", "/p", "limit=1", { accessKey: "AK", secretKey: "SK" }, at);
    const b = buildCoupangAuth("GET", "/p", "limit=2", { accessKey: "AK", secretKey: "SK" }, at);
    expect(a).not.toBe(b);
  });
});

describe("parseCoupangBest", () => {
  const body = {
    rCode: "0",
    data: [
      { productName: "[로켓배송] 휴대용 선풍기", categoryName: "가전디지털", rank: 1 },
      { productName: "스노클링 물안경", categoryName: "주방용품", rank: 2 },
      { productName: "", categoryName: "주방용품", rank: 3 },
    ],
  };

  it("상품명과 카테고리를 뽑는다", () => {
    expect(parseCoupangBest(body, "가전디지털")).toEqual([
      { name: "휴대용 선풍기", category: "가전디지털" },
      { name: "스노클링 물안경", category: "주방용품" },
    ]);
  });

  it("대괄호 표기를 뗀다 — [로켓배송] 은 상품이 아니라 배송 방식이다", () => {
    expect(parseCoupangBest(body, "x")[0].name).not.toContain("[");
  });

  it("이름이 빈 항목은 버린다", () => {
    expect(parseCoupangBest(body, "x")).toHaveLength(2);
  });

  it("모양이 다르면 빈 배열이다 — 화면이 깨지느니 아무것도 안 준다", () => {
    expect(parseCoupangBest({ data: "이상한값" }, "x")).toEqual([]);
    expect(parseCoupangBest(null, "x")).toEqual([]);
  });
});

describe("fetchCoupangBestSellers", () => {
  const keys = { accessKey: "AK", secretKey: "SK" };
  const ok = (names: string[]) =>
    ({ ok: true, json: async () => ({ data: names.map((n, i) => ({ productName: n, categoryName: "c", rank: i + 1 })) }) }) as Response;

  it("카테고리마다 한 번씩 부르고 합쳐 준다", async () => {
    const fetchImpl = vi.fn(async () => ok(["가", "나"]));
    const items = await fetchCoupangBestSellers(keys, 2, fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledTimes(COUPANG_SEASONAL_CATEGORIES.length);
    expect(items.length).toBe(COUPANG_SEASONAL_CATEGORIES.length * 2);
  });

  // 한 카테고리가 죽어도 나머지로 주제를 뽑을 수 있다 — 전부 버리면 아무것도 못 준다.
  it("일부 카테고리가 실패해도 나머지를 돌려준다", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) throw new Error("네트워크");
      return ok(["가"]);
    });
    const items = await fetchCoupangBestSellers(keys, 1, fetchImpl as unknown as typeof fetch);
    expect(items.length).toBe(COUPANG_SEASONAL_CATEGORIES.length - 1);
  });

  it("전부 실패하면 던진다 — 빈 목록으로 주제를 뽑게 두지 않는다", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("네트워크");
    });
    await expect(fetchCoupangBestSellers(keys, 1, fetchImpl as unknown as typeof fetch)).rejects.toThrow();
  });
});

describe("friendlyCoupangError", () => {
  it("한국어로 바꾸고 키를 담지 않는다", () => {
    const msg = friendlyCoupangError(new Error("401 Unauthorized AK=SECRET"));
    expect(/[가-힣]/.test(msg)).toBe(true);
    expect(msg).not.toContain("SECRET");
  });
});

describe("coupangBestUrl", () => {
  it("카테고리 id 와 개수를 담는다", () => {
    const url = coupangBestUrl("1016", 5);
    expect(url).toContain("/bestcategories/1016");
    expect(url).toContain("limit=5");
  });
});

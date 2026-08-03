import { describe, it, expect, vi } from "vitest";
import { NAVER_AGES_30S_40S } from "./naver-datalab";
import {
  MAX_SHOPPING_KEYWORDS_PER_REQUEST,
  SHOPPING_AGES_30S_40S,
  SHOPPING_CATEGORIES,
  friendlyNaverShoppingError,
  rankKeywordsByNaverShopping,
} from "./naver-shopping";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const auth = { clientId: "client-id", clientSecret: "client-secret" };

describe("실측으로 확정한 상수", () => {
  it("쇼핑 연령 코드는 10년 단위이며 데이터랩(5세 단위)과 다르다", () => {
    expect(SHOPPING_AGES_30S_40S).toEqual(["30", "40"]);
    expect(SHOPPING_AGES_30S_40S).not.toEqual(NAVER_AGES_30S_40S);
  });

  it("한 요청에 키워드 5개까지다", () => {
    expect(MAX_SHOPPING_KEYWORDS_PER_REQUEST).toBe(5);
  });

  it("분야 이름은 전부 한국어다 — 화면에 그대로 나간다", () => {
    expect(SHOPPING_CATEGORIES.length).toBeGreaterThan(0);
    for (const category of SHOPPING_CATEGORIES) {
      expect(category.name).not.toMatch(/[A-Za-z]/);
      expect(category.id).toMatch(/^5000000\d$/);
    }
  });

  it("30~40대 맘이 쓸 분야를 담고 있다", () => {
    const ids = SHOPPING_CATEGORIES.map((c) => c.id);
    expect(ids).toContain("50000005"); // 출산·육아
    expect(ids).toContain("50000006"); // 식품
    expect(ids).toContain("50000008"); // 생활·건강
  });
});

describe("rankKeywordsByNaverShopping", () => {
  it("API HUB 쇼핑 경로를 게이트웨이 헤더로 부르고 분야·성별·연령을 싣는다", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://naverapihub.apigw.ntruss.com/shopping/v1/category/keywords");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers["X-NCP-APIGW-API-KEY-ID"]).toBe("client-id");
      expect(headers["X-NCP-APIGW-API-KEY"]).toBe("client-secret");
      const body = JSON.parse(String(init?.body));
      expect(body.category).toBe("50000005");
      expect(body.gender).toBe("f");
      expect(body.ages).toEqual(["30", "40"]);
      return jsonResponse(200, {
        results: [{ title: "기저귀", keyword: ["기저귀"], data: [{ period: "2026-07-01", ratio: 40 }] }],
      });
    });

    await rankKeywordsByNaverShopping(["기저귀"], "50000005", auth, mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("5개 넘는 키워드는 나눠 부르고 점수 내림차순으로 합친다", async () => {
    const ratios: Record<string, number> = { k1: 10, k2: 90, k3: 20, k4: 30, k5: 40, k6: 50 };
    const mockFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return jsonResponse(200, {
        results: body.keyword.map((g: { name: string }) => ({
          title: g.name,
          keyword: [g.name],
          data: [{ period: "2026-07-01", ratio: ratios[g.name] }],
        })),
      });
    });

    const ranked = await rankKeywordsByNaverShopping(
      ["k1", "k2", "k3", "k4", "k5", "k6"],
      "50000005",
      auth,
      mockFetch as unknown as typeof fetch,
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(ranked.map((r) => r.keyword)).toEqual(["k2", "k6", "k5", "k4", "k3", "k1"]);
  });

  it("데이터가 없는 키워드는 점수 0으로 남는다 — 사라지지 않는다", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse(200, { results: [{ title: "감자전", keyword: ["감자전"], data: [] }] }),
    );

    const ranked = await rankKeywordsByNaverShopping(["감자전"], "50000006", auth, mockFetch as unknown as typeof fetch);

    expect(ranked).toEqual([{ keyword: "감자전", score: 0 }]);
  });
});

describe("friendlyNaverShoppingError — 언제나 한국어", () => {
  it("영문 원문이나 키 값을 노출하지 않는다", () => {
    const message = friendlyNaverShoppingError(new Error("NID AUTH Result Invalid (1000)"));

    expect(message).not.toContain("NID");
    expect(/[가-힣]/.test(message)).toBe(true);
  });
});

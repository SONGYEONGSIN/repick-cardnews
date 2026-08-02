import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildRecentPeriod,
  chunkKeywordsIntoRequests,
  averageRatio,
  rankKeywordsByNaverDatalab,
  friendlyNaverDatalabError,
  NaverDatalabApiError,
  NAVER_AGES_30S_40S,
  NAVER_GENDER_FEMALE,
  MAX_GROUPS_PER_REQUEST,
} from "@/lib/naver-datalab";

describe("buildRecentPeriod", () => {
  it("기준 시각으로부터 최근 30일을 date 단위로 만든다", () => {
    const now = new Date("2026-08-02T00:00:00.000Z");
    expect(buildRecentPeriod(now)).toEqual({
      startDate: "2026-07-03",
      endDate: "2026-08-02",
      timeUnit: "date",
    });
  });
});

describe("chunkKeywordsIntoRequests", () => {
  const period = { startDate: "2026-07-03", endDate: "2026-08-02", timeUnit: "date" as const };

  it("한 요청에 그룹을 최대 5개까지만 담아 나눈다", () => {
    const keywords = Array.from({ length: 12 }, (_, i) => `키워드${i + 1}`);
    const requests = chunkKeywordsIntoRequests(keywords, period);

    expect(requests).toHaveLength(3);
    expect(requests[0].keywordGroups).toHaveLength(5);
    expect(requests[1].keywordGroups).toHaveLength(5);
    expect(requests[2].keywordGroups).toHaveLength(2);
  });

  it("키워드 각각을 자기 자신만 담은 독립 그룹으로 만든다", () => {
    const requests = chunkKeywordsIntoRequests(["다이어트", "육아"], period);
    expect(requests[0].keywordGroups).toEqual([
      { groupName: "다이어트", keywords: ["다이어트"] },
      { groupName: "육아", keywords: ["육아"] },
    ]);
  });

  it("30~40대 여성 기준(ages·gender)과 기간을 그대로 싣는다", () => {
    const requests = chunkKeywordsIntoRequests(["다이어트"], period);
    expect(requests[0]).toMatchObject({
      startDate: period.startDate,
      endDate: period.endDate,
      timeUnit: "date",
      ages: [...NAVER_AGES_30S_40S],
      gender: NAVER_GENDER_FEMALE,
    });
  });

  it("MAX_GROUPS_PER_REQUEST 는 공식 문서상 5다", () => {
    expect(MAX_GROUPS_PER_REQUEST).toBe(5);
  });
});

describe("averageRatio", () => {
  it("데이터 포인트들의 평균을 낸다", () => {
    expect(
      averageRatio([
        { period: "2026-07-01", ratio: 10 },
        { period: "2026-07-02", ratio: 20 },
        { period: "2026-07-03", ratio: 30 },
      ]),
    ).toBe(20);
  });

  it("빈 배열이면 0이다", () => {
    expect(averageRatio([])).toBe(0);
  });
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("rankKeywordsByNaverDatalab", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("헤더에 클라이언트 ID·시크릿을 싣고 POST 로 호출한다", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://openapi.naver.com/v1/datalab/search");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers["X-Naver-Client-Id"]).toBe("client-id");
      expect(headers["X-Naver-Client-Secret"]).toBe("client-secret");
      expect(headers["Content-Type"]).toBe("application/json");
      return jsonResponse(200, {
        results: [{ title: "다이어트", keywords: ["다이어트"], data: [{ period: "2026-07-01", ratio: 50 }] }],
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    await rankKeywordsByNaverDatalab(
      ["다이어트"],
      { clientId: "client-id", clientSecret: "client-secret" },
      new Date("2026-08-02T00:00:00.000Z"),
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("5개 넘는 키워드는 여러 요청으로 나눠 순차 호출하고 점수 내림차순으로 합친다", async () => {
    const calls: string[][] = [];
    const mockFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body: { keywordGroups: { groupName: string }[] } = JSON.parse(String(init?.body));
      const names = body.keywordGroups.map((g) => g.groupName);
      calls.push(names);
      const results = names.map((name, i) => ({
        title: name,
        keywords: [name],
        data: [{ period: "2026-07-01", ratio: (calls.length - 1) * 10 + i }],
      }));
      return jsonResponse(200, { results });
    });
    vi.stubGlobal("fetch", mockFetch);

    const keywords = Array.from({ length: 6 }, (_, i) => `키워드${i + 1}`);
    const ranked = await rankKeywordsByNaverDatalab(
      keywords,
      { clientId: "id", clientSecret: "secret" },
      new Date("2026-08-02T00:00:00.000Z"),
    );

    expect(calls).toHaveLength(2);
    expect(ranked).toHaveLength(6);
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i + 1].score);
    }
  });

  it("HTTP 실패면 NaverDatalabApiError로 감싸 던진다", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(400, { errorMessage: "잘못된 요청입니다." }));
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      rankKeywordsByNaverDatalab(["다이어트"], { clientId: "id", clientSecret: "secret" }, new Date()),
    ).rejects.toBeInstanceOf(NaverDatalabApiError);
  });

  it("응답 형태가 예상과 다르면 NaverDatalabApiError로 실패한다", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(200, { unexpected: true }));
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      rankKeywordsByNaverDatalab(["다이어트"], { clientId: "id", clientSecret: "secret" }, new Date()),
    ).rejects.toBeInstanceOf(NaverDatalabApiError);
  });
});

describe("friendlyNaverDatalabError", () => {
  it("NaverDatalabApiError는 클라이언트 ID·시크릿 확인 안내를 한국어로 준다", () => {
    const msg = friendlyNaverDatalabError(new NaverDatalabApiError("HTTP 400", { errorMessage: "Invalid" }));
    expect(msg).toContain("네이버");
    expect(msg).not.toContain("Invalid");
  });

  it("그 밖의 값(네트워크 실패)은 네트워크 문구로 안내한다", () => {
    const msg = friendlyNaverDatalabError(new TypeError("fetch failed"));
    expect(msg).toContain("네트워크");
    expect(msg).not.toContain("fetch failed");
  });
});

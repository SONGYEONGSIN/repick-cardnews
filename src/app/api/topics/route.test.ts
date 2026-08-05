import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/topics/route";
import { runClaudeCli } from "@/lib/claude-cli";

vi.mock("@/lib/claude-cli", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/claude-cli")>();
  return { ...actual, runClaudeCli: vi.fn() };
});

const ENV_KEYS = ["YOUTUBE_API_KEY", "NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"] as const;
function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function makeRequest(host: string, query = ""): Request {
  const url = query ? `http://x/api/topics?${query}` : "http://x/api/topics";
  return new Request(url, { method: "GET", headers: { host } });
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** 카테고리별로 호출되는 유튜브 응답 — 카테고리마다 후보 1개씩, 항상 성공한다. */
function stubYoutubeSuccess() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const categoryId = url.searchParams.get("videoCategoryId");
    return jsonResponse(200, {
      items: [{ id: `video-${categoryId}`, snippet: { title: `제목-${categoryId}`, channelTitle: "채널", categoryId } }],
    });
  });
}

beforeEach(() => {
  clearEnv();
  vi.unstubAllGlobals();
  vi.mocked(runClaudeCli).mockReset();
});
afterEach(() => {
  clearEnv();
  vi.unstubAllGlobals();
});

describe("GET /api/topics 로컬 전용 가드", () => {
  it("집 네트워크 IP로 온 요청은 403으로 막고 한국어로 안내한다", async () => {
    const res = await GET(makeRequest("10.0.0.7:3500"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("컴퓨터");
  });
});

describe("GET /api/topics 설정 판정 — 유튜브 키 필수·네이버 선택", () => {
  it("유튜브 키가 없으면 400과 유튜브 키가 없다는 한국어 안내를 준다(네이버 값이 있어도)", async () => {
    process.env.NAVER_CLIENT_ID = "id";
    process.env.NAVER_CLIENT_SECRET = "secret";

    const res = await GET(makeRequest("localhost:3500"));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("유튜브 API 키");
    expect(data.error).not.toContain("네이버");
  });
});

describe("GET /api/topics 데이터랩 없음 — Claude 순위로 정렬", () => {
  it("네이버 설정이 없으면 데이터랩을 부르지 않고 Claude rank 순으로 정렬해 돌려준다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    const mockFetch = stubYoutubeSuccess();
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      topics: [
        { keyword: "육아팁", reason: "이유1", rank: 2 },
        { keyword: "제철요리", reason: "이유2", rank: 1 },
      ],
    });

    const res = await GET(makeRequest("localhost:3500"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rankedBy).toBe("claude-no-naver-config");
    expect(data.topics).toEqual([
      { keyword: "제철요리", reason: "이유2" },
      { keyword: "육아팁", reason: "이유1" },
    ]);
    // 카테고리 수만큼만 유튜브를 불렀다 — 네이버 호출은 없었다.
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("결과가 상한(10개)보다 적으면 부족하다는 사실을 message로 알린다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    vi.stubGlobal("fetch", stubYoutubeSuccess());
    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      topics: [{ keyword: "육아팁", reason: "이유1", rank: 1 }],
    });

    const res = await GET(makeRequest("localhost:3500"));
    const data = await res.json();

    expect(data.topics).toHaveLength(1);
    expect(typeof data.message).toBe("string");
    expect(data.message).toContain("1");
  });

  it("결과가 10개 이상이면 message가 없다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    vi.stubGlobal("fetch", stubYoutubeSuccess());
    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      topics: Array.from({ length: 10 }, (_, i) => ({ keyword: `키워드${i + 1}`, reason: `이유${i + 1}`, rank: i + 1 })),
    });

    const res = await GET(makeRequest("localhost:3500"));
    const data = await res.json();

    expect(data.topics).toHaveLength(10);
    expect(data.message).toBeUndefined();
  });

  it("Claude가 10개 넘게 고르면 rank 상위 10개로 줄이고 message는 없다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    vi.stubGlobal("fetch", stubYoutubeSuccess());
    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      topics: Array.from({ length: 12 }, (_, i) => ({
        keyword: `키워드${i + 1}`,
        reason: `이유${i + 1}`,
        rank: 12 - i,
      })),
    });

    const res = await GET(makeRequest("localhost:3500"));
    const data = await res.json();

    expect(data.topics).toHaveLength(10);
    expect(data.topics[0].keyword).toBe("키워드12");
    expect(data.message).toBeUndefined();
  });

  // 정렬할 게 없으면 순위 근거도 없다. 그런데도 "설정이 없어 Claude 순서"라고 말하면,
  // 네이버가 멀쩡히 설정된 사람에게 거짓을 말하게 된다.
  it("빈 topics 면 순위 근거(note·rankedBy)를 말하지 않는다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    process.env.NAVER_CLIENT_ID = "naver-id";
    process.env.NAVER_CLIENT_SECRET = "naver-secret";
    vi.stubGlobal("fetch", stubYoutubeSuccess());
    vi.mocked(runClaudeCli).mockResolvedValueOnce({ topics: [] });

    const data = await (await GET(makeRequest("localhost:3500"))).json();

    expect(data.topics).toEqual([]);
    expect(data.note).toBeUndefined();
    expect(data.rankedBy).toBeUndefined();
    // 후보를 어디서 찾아봤는지는 여전히 밝힌다 — 빈손인 이유를 알아야 한다.
    expect(data.sourceCategories.length).toBeGreaterThan(0);
  });

  it("빈 topics 면 200과 '오늘은 없다'는 한국어 message를 함께 준다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    vi.stubGlobal("fetch", stubYoutubeSuccess());
    vi.mocked(runClaudeCli).mockResolvedValueOnce({ topics: [] });

    const res = await GET(makeRequest("localhost:3500"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.topics).toEqual([]);
    expect(data.message).toContain("오늘");
  });
});

describe("GET /api/topics 데이터랩 있음 — 검색 비중으로 정렬", () => {
  function stubYoutubeAndNaver(naverRatioByKeyword: Record<string, number>) {
    return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("googleapis.com")) {
        const categoryId = new URL(url).searchParams.get("videoCategoryId");
        return jsonResponse(200, {
          items: [{ id: `video-${categoryId}`, snippet: { title: `제목-${categoryId}`, channelTitle: "채널", categoryId } }],
        });
      }
      if (url.includes("naverapihub.apigw.ntruss.com")) {
        const body: { keywordGroups: { groupName: string }[] } = JSON.parse(String(init?.body));
        const results = body.keywordGroups.map((g) => ({
          title: g.groupName,
          keywords: [g.groupName],
          data: [{ period: "2026-07-01", ratio: naverRatioByKeyword[g.groupName] ?? 0 }],
        }));
        return jsonResponse(200, { results });
      }
      throw new Error(`unexpected url: ${url}`);
    });
  }

  it("네이버 설정이 있으면 데이터랩을 불러 상대 검색 비중 순으로 다시 정렬한다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    process.env.NAVER_CLIENT_ID = "naver-id";
    process.env.NAVER_CLIENT_SECRET = "naver-secret";
    vi.stubGlobal("fetch", stubYoutubeAndNaver({ 제철요리: 10, 육아팁: 90 }));

    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      topics: [
        { keyword: "제철요리", reason: "이유1", rank: 1 },
        { keyword: "육아팁", reason: "이유2", rank: 2 },
      ],
    });

    const res = await GET(makeRequest("localhost:3500"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rankedBy).toBe("naver-datalab");
    // 데이터랩에는 검색어트렌드와 쇼핑인사이트가 있다 — 어느 쪽인지 밝혀야 한다.
    expect(data.note).toContain("검색어트렌드");
    // Claude rank 로는 제철요리가 먼저지만, 데이터랩 점수는 육아팁이 더 높다 — 데이터랩이 이겨야 한다.
    expect(data.topics.map((t: { keyword: string }) => t.keyword)).toEqual(["육아팁", "제철요리"]);
  });

  it("네이버 호출이 실패해도(설정은 있음) 전체를 502로 죽이지 않고 Claude 순위로 폴백한다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    process.env.NAVER_CLIENT_ID = "naver-id";
    process.env.NAVER_CLIENT_SECRET = "naver-secret";

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("googleapis.com")) {
        const categoryId = new URL(url).searchParams.get("videoCategoryId");
        return jsonResponse(200, {
          items: [{ id: `video-${categoryId}`, snippet: { title: `제목-${categoryId}`, channelTitle: "채널", categoryId } }],
        });
      }
      // 데이터랩 자격 증명 인증 실패(실측 401 NID AUTH) 재현.
      return jsonResponse(401, { errorCode: "024", errorMessage: "NID AUTH Result Invalid (1000)" });
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      topics: [
        { keyword: "육아팁", reason: "이유1", rank: 2 },
        { keyword: "제철요리", reason: "이유2", rank: 1 },
      ],
    });

    const res = await GET(makeRequest("localhost:3500"));

    // Claude 가 이미 만든 결과를 버리지 않는다 — 200 + 폴백 순위로 그대로 돌려준다.
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rankedBy).toBe("claude-naver-unavailable");
    expect(data.topics).toEqual([
      { keyword: "제철요리", reason: "이유2" },
      { keyword: "육아팁", reason: "이유1" },
    ]);
    // "설정이 없어서"가 아니라 "연결하지 못해서"임을 구분해서 알린다. 원문·키 값은 담기지 않는다.
    expect(data.note).toContain("연결하지 못");
    expect(data.note).not.toContain("024");
    expect(data.note).not.toContain("naver-secret");
  });
});

describe("GET /api/topics 유튜브 카테고리 일부 실패 — 부분 실패를 견딘다", () => {
  it("카테고리 하나가 실패해도 나머지로 계속 진행하고, 건너뛴 카테고리를 응답에 감추지 않는다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const categoryId = url.searchParams.get("videoCategoryId");
      if (categoryId === "22") {
        return jsonResponse(404, { error: { code: 404, message: "notFound" } });
      }
      return jsonResponse(200, {
        items: [{ id: `video-${categoryId}`, snippet: { title: `제목-${categoryId}`, channelTitle: "채널", categoryId } }],
      });
    });
    vi.stubGlobal("fetch", mockFetch);
    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      topics: [{ keyword: "키워드", reason: "이유", rank: 1 }],
    });

    const res = await GET(makeRequest("localhost:3500"));

    expect(res.status).toBe(200);
    const data = await res.json();
    // 화면에 그대로 나가는 이름이라 한국어여야 한다 — 영문 카테고리명이 새어 나가면 안 된다.
    expect(data.skippedCategories).toEqual(["일상·브이로그"]);
    // 실패한 것만 빼고, 실제로 쓴 카테고리도 밝힌다.
    expect(data.sourceCategories).toEqual(["살림·요리·꿀팁", "생활기술·가전"]);
  });

  it("전부 성공하면 sourceCategories에 쓴 카테고리 이름이 한국어로 전부 담긴다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    vi.stubGlobal("fetch", stubYoutubeSuccess());
    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      topics: [{ keyword: "키워드", reason: "이유", rank: 1 }],
    });

    const data = await (await GET(makeRequest("localhost:3500"))).json();

    expect(data.sourceCategories).toEqual(["살림·요리·꿀팁", "일상·브이로그", "생활기술·가전"]);
  });

  it("카테고리를 하나도 못 건너뛰면(전부 성공) skippedCategories 필드가 없다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    vi.stubGlobal("fetch", stubYoutubeSuccess());
    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      topics: [{ keyword: "키워드", reason: "이유", rank: 1 }],
    });

    const res = await GET(makeRequest("localhost:3500"));
    const data = await res.json();

    expect(data.skippedCategories).toBeUndefined();
  });
});

describe("GET /api/topics 실패 처리", () => {
  it("유튜브 호출이 실패하면 502와 유튜브 관련 한국어 오류를 준다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(403, { error: { code: 403, message: "x", errors: [{ reason: "quotaExceeded" }] } }),
      ),
    );

    const res = await GET(makeRequest("localhost:3500"));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain("유튜브");
  });

  it("Claude 추리기가 실패하면 502와 한국어 오류를 준다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    vi.stubGlobal("fetch", stubYoutubeSuccess());
    vi.mocked(runClaudeCli).mockRejectedValueOnce(new Error("claude 실패"));

    const res = await GET(makeRequest("localhost:3500"));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });
});

describe("GET /api/topics — 순위 렌즈 선택", () => {
  it("lens=claude 면 네이버 설정이 있어도 부르지 않는다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    process.env.NAVER_CLIENT_ID = "naver-id";
    process.env.NAVER_CLIENT_SECRET = "naver-secret";
    const mockFetch = stubYoutubeSuccess();
    vi.stubGlobal("fetch", mockFetch);
    vi.mocked(runClaudeCli).mockResolvedValueOnce({ topics: [{ keyword: "키워드", reason: "이유", rank: 1 }] });

    const data = await (await GET(makeRequest("localhost:3500", "lens=claude"))).json();

    expect(data.rankedBy).toBe("claude-lens-chosen");
    const naverCalls = mockFetch.mock.calls.filter((c) => String(c[0]).includes("ntruss.com"));
    expect(naverCalls).toHaveLength(0);
  });

  it("lens=shopping 이면 쇼핑 경로를 고른 분야로 부른다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    process.env.NAVER_CLIENT_ID = "naver-id";
    process.env.NAVER_CLIENT_SECRET = "naver-secret";
    let shoppingBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/shopping/v1/category/keywords")) {
          shoppingBody = JSON.parse(String(init?.body));
          return jsonResponse(200, {
            results: [{ title: "키워드", keyword: ["키워드"], data: [{ period: "2026-07-01", ratio: 50 }] }],
          });
        }
        return jsonResponse(200, {
          items: [{ id: "v1", snippet: { title: "제목", channelTitle: "채널", categoryId: "26" } }],
        });
      }),
    );
    vi.mocked(runClaudeCli).mockResolvedValueOnce({ topics: [{ keyword: "키워드", reason: "이유", rank: 1 }] });

    const data = await (
      await GET(makeRequest("localhost:3500", "lens=shopping&shoppingCategory=50000005"))
    ).json();

    expect(data.rankedBy).toBe("naver-shopping");
    expect(shoppingBody).not.toBeNull();
    expect(shoppingBody!.category).toBe("50000005");
    expect(data.note).toContain("쇼핑인사이트");
  });

  it("lens=shopping 인데 분야가 없으면 400 과 한국어 안내를 준다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";

    const res = await GET(makeRequest("localhost:3500", "lens=shopping"));

    expect(res.status).toBe(400);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
  });

  it("모르는 분야 id 도 400 이다 — 그대로 네이버에 넘기지 않는다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";

    const res = await GET(makeRequest("localhost:3500", "lens=shopping&shoppingCategory=99"));

    expect(res.status).toBe(400);
  });

  it("쇼핑인사이트가 실패해도 502 로 죽지 않고 Claude 순위로 폴백한다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    process.env.NAVER_CLIENT_ID = "naver-id";
    process.env.NAVER_CLIENT_SECRET = "naver-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input).includes("/shopping/")) return jsonResponse(401, { errorCode: "024" });
        return jsonResponse(200, {
          items: [{ id: "v1", snippet: { title: "제목", channelTitle: "채널", categoryId: "26" } }],
        });
      }),
    );
    vi.mocked(runClaudeCli).mockResolvedValueOnce({ topics: [{ keyword: "키워드", reason: "이유", rank: 1 }] });

    const res = await GET(makeRequest("localhost:3500", "lens=shopping&shoppingCategory=50000005"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rankedBy).toBe("claude-shopping-unavailable");
    expect(data.topics).toHaveLength(1);
  });
});

/**
 * 후보 출처가 둘이 됐다: 유튜브(보는 것)와 쿠팡(사는 것). 순위를 매기는 단계(네이버)는
 * 그대로 공유한다 — 출처가 바뀌었다고 자가 달라지면 두 결과를 비교할 수 없다.
 */
describe("GET source=selling", () => {
  it("쿠팡 설정이 없으면 그 모드만 막고 이유를 한국어로 말한다", async () => {
    delete process.env.COUPANG_ACCESS_KEY;
    delete process.env.COUPANG_SECRET_KEY;

    const res = await GET(new Request("http://localhost:3500/api/topics?source=selling", { headers: { host: "localhost:3500" } }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(/[가-힣]/.test(body.error)).toBe(true);
    expect(body.error).toContain("COUPANG_ACCESS_KEY");
  });

  it("모르는 출처는 400 이다 — 100초를 쓰기 전에 막는다", async () => {
    const res = await GET(new Request("http://localhost:3500/api/topics?source=이상한값", { headers: { host: "localhost:3500" } }));
    expect(res.status).toBe(400);
  });
});

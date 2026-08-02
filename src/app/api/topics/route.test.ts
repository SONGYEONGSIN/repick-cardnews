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

function makeRequest(host: string): Request {
  return new Request("http://x/api/topics", { method: "GET", headers: { host } });
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
    expect(data.rankedBy).toBe("claude");
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
      if (url.includes("openapi.naver.com")) {
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
    // Claude rank 로는 제철요리가 먼저지만, 데이터랩 점수는 육아팁이 더 높다 — 데이터랩이 이겨야 한다.
    expect(data.topics.map((t: { keyword: string }) => t.keyword)).toEqual(["육아팁", "제철요리"]);
  });

  it("네이버 호출이 실패하면(설정은 있음) 조용히 건너뛰지 않고 502로 알린다", async () => {
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
      return jsonResponse(400, { errorMessage: "bad request" });
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(runClaudeCli).mockResolvedValueOnce({ topics: [{ keyword: "키워드", reason: "이유", rank: 1 }] });

    const res = await GET(makeRequest("localhost:3500"));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain("네이버");
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
    expect(data.skippedYoutubeCategories).toEqual(["People & Blogs"]);
  });

  it("카테고리를 하나도 못 건너뛰면(전부 성공) skippedYoutubeCategories 필드가 없다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    vi.stubGlobal("fetch", stubYoutubeSuccess());
    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      topics: [{ keyword: "키워드", reason: "이유", rank: 1 }],
    });

    const res = await GET(makeRequest("localhost:3500"));
    const data = await res.json();

    expect(data.skippedYoutubeCategories).toBeUndefined();
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

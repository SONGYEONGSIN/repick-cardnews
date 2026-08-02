import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildYoutubeTrendingUrl,
  fetchYoutubeTrendingByCategory,
  fetchYoutubeTrendingCandidates,
  combineCategoryResults,
  friendlyYoutubeError,
  parseCategoryIds,
  YoutubeApiError,
  AllCategoriesFailedError,
  YOUTUBE_MAX_RESULTS,
  LIFESTYLE_CATEGORIES,
  type YoutubeCandidate,
  type CategoryFetchResult,
} from "@/lib/youtube-trending";

describe("buildYoutubeTrendingUrl", () => {
  it("공식 문서의 mostPopular 차트·한국 리전·카테고리 필터·최대 50개로 요청 URL을 만든다", () => {
    const url = buildYoutubeTrendingUrl("test-key", "26");
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe("https://www.googleapis.com/youtube/v3/videos");
    expect(parsed.searchParams.get("part")).toBe("snippet");
    expect(parsed.searchParams.get("chart")).toBe("mostPopular");
    expect(parsed.searchParams.get("regionCode")).toBe("KR");
    expect(parsed.searchParams.get("videoCategoryId")).toBe("26");
    expect(parsed.searchParams.get("maxResults")).toBe(String(YOUTUBE_MAX_RESULTS));
    expect(parsed.searchParams.get("key")).toBe("test-key");
  });

  it("공식 문서상 1회 요청 최대치는 50이다", () => {
    expect(YOUTUBE_MAX_RESULTS).toBe(50);
  });
});

describe("LIFESTYLE_CATEGORIES", () => {
  it("실제 videos.list(chart=mostPopular, regionCode=KR) 호출로 지원 확인된 카테고리만 담는다(2026-08-02 실측)", () => {
    expect(LIFESTYLE_CATEGORIES).toEqual([
      { id: "26", label: "Howto & Style", displayName: "살림·요리·꿀팁" },
      { id: "22", label: "People & Blogs", displayName: "일상·브이로그" },
      { id: "28", label: "Science & Technology", displayName: "생활기술·가전" },
    ]);
  });

  it("Education(27)은 실측 결과(notFound) 목록에 없다 — 한국에서 mostPopular 미지원", () => {
    expect(LIFESTYLE_CATEGORIES.some((c) => c.id === "27")).toBe(false);
  });

  // 화면이 출처를 밝힐 때 쓰는 이름이라 영어가 새어 나가면 안 된다.
  it("사용자에게 보일 이름은 전부 한국어다 — 영문자가 없다", () => {
    for (const category of LIFESTYLE_CATEGORIES) {
      expect(category.displayName).not.toMatch(/[A-Za-z]/);
    }
  });
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("fetchYoutubeTrendingByCategory", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("응답의 title·channelTitle·categoryId를 후보로 뽑는다", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse(200, {
        items: [
          { id: "abc123", snippet: { title: "제목1", channelTitle: "채널1", categoryId: "26" } },
          { id: "def456", snippet: { title: "제목2", channelTitle: "채널2", categoryId: "26" } },
        ],
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const candidates: YoutubeCandidate[] = await fetchYoutubeTrendingByCategory("test-key", "26");

    expect(candidates).toEqual([
      { videoId: "abc123", title: "제목1", channelTitle: "채널1", categoryId: "26" },
      { videoId: "def456", title: "제목2", channelTitle: "채널2", categoryId: "26" },
    ]);
  });

  it("HTTP 실패면 YoutubeApiError로 감싸 던진다", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse(403, { error: { code: 403, message: "quota exceeded", errors: [{ reason: "quotaExceeded" }] } }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchYoutubeTrendingByCategory("test-key", "26")).rejects.toBeInstanceOf(YoutubeApiError);
  });

  it("응답 형태가 예상과 다르면(items 없음) YoutubeApiError로 실패한다", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(200, { unexpected: true }));
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchYoutubeTrendingByCategory("test-key", "26")).rejects.toBeInstanceOf(YoutubeApiError);
  });
});

const categoryA = { id: "26", label: "Howto & Style", displayName: "살림·요리·꿀팁" };
const categoryB = { id: "22", label: "People & Blogs", displayName: "일상·브이로그" };
const categoryC = { id: "28", label: "Science & Technology", displayName: "생활기술·가전" };

function candidate(id: string): YoutubeCandidate {
  return { videoId: id, title: `제목-${id}`, channelTitle: "채널", categoryId: "26" };
}

describe("combineCategoryResults — 순수 함수(부분 실패 허용)", () => {
  it("전부 성공하면 합쳐진 후보를 돌려주고 skippedCategories는 비어 있다", () => {
    const results: CategoryFetchResult[] = [
      { status: "fulfilled", category: categoryA, candidates: [candidate("a1")] },
      { status: "fulfilled", category: categoryB, candidates: [candidate("b1")] },
    ];

    const combined = combineCategoryResults(results);

    expect(combined.candidates.map((c) => c.videoId)).toEqual(["a1", "b1"]);
    expect(combined.skippedCategories).toEqual([]);
    // 화면이 "어디서 가져왔는지"를 밝히려면 실제로 쓴 카테고리를 알아야 한다.
    expect(combined.usedCategories).toEqual([categoryA, categoryB]);
  });

  it("일부가 실패하면 usedCategories에는 성공한 카테고리만 남는다", () => {
    const results: CategoryFetchResult[] = [
      { status: "fulfilled", category: categoryA, candidates: [candidate("a1")] },
      { status: "rejected", category: categoryB, error: new YoutubeApiError("HTTP 404", {}) },
    ];

    expect(combineCategoryResults(results).usedCategories).toEqual([categoryA]);
  });

  it("일부만 실패하면 성공한 카테고리 결과만 합치고, 실패한 카테고리는 skippedCategories에 담는다", () => {
    const results: CategoryFetchResult[] = [
      { status: "fulfilled", category: categoryA, candidates: [candidate("a1")] },
      { status: "rejected", category: categoryB, error: new YoutubeApiError("HTTP 404", { error: { code: 404 } }) },
      { status: "fulfilled", category: categoryC, candidates: [candidate("c1")] },
    ];

    const combined = combineCategoryResults(results);

    expect(combined.candidates.map((c) => c.videoId)).toEqual(["a1", "c1"]);
    expect(combined.skippedCategories).toEqual([categoryB]);
  });

  it("전부 실패하면 AllCategoriesFailedError를 던진다", () => {
    const results: CategoryFetchResult[] = [
      { status: "rejected", category: categoryA, error: new Error("x") },
      { status: "rejected", category: categoryB, error: new Error("y") },
    ];

    expect(() => combineCategoryResults(results)).toThrow(AllCategoriesFailedError);
  });

  it("videoId가 카테고리 경계를 넘어 겹쳐도 한 번만 남긴다", () => {
    const results: CategoryFetchResult[] = [
      { status: "fulfilled", category: categoryA, candidates: [candidate("same")] },
      { status: "fulfilled", category: categoryB, candidates: [candidate("same")] },
    ];

    expect(combineCategoryResults(results).candidates).toHaveLength(1);
  });
});

describe("fetchYoutubeTrendingCandidates", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("카테고리마다 한 번씩 호출해 합친 후보를 돌려준다(모두 성공)", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const categoryId = url.searchParams.get("videoCategoryId");
      return jsonResponse(200, {
        items: [{ id: `video-${categoryId}`, snippet: { title: `제목-${categoryId}`, channelTitle: "채널", categoryId } }],
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchYoutubeTrendingCandidates("test-key");

    expect(mockFetch).toHaveBeenCalledTimes(LIFESTYLE_CATEGORIES.length);
    expect(result.candidates).toHaveLength(LIFESTYLE_CATEGORIES.length);
    expect(result.skippedCategories).toEqual([]);
  });

  it("카테고리 하나가 실패해도 나머지 결과로 계속 간다(부분 실패를 견딘다)", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.searchParams.get("videoCategoryId") === "22") {
        return jsonResponse(404, { error: { code: 404, message: "notFound" } });
      }
      return jsonResponse(200, {
        items: [{ id: `video-${url.searchParams.get("videoCategoryId")}`, snippet: { title: "제목", channelTitle: "채널", categoryId: "26" } }],
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchYoutubeTrendingCandidates("test-key");

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.skippedCategories).toEqual([
      { id: "22", label: "People & Blogs", displayName: "일상·브이로그" },
    ]);
  });

  it("카테고리가 전부 실패하면 AllCategoriesFailedError로 실패한다", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(404, { error: { code: 404, message: "notFound" } }));
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchYoutubeTrendingCandidates("test-key")).rejects.toBeInstanceOf(AllCategoriesFailedError);
  });
});

describe("parseCategoryIds — 요청한 카테고리만 고른다", () => {
  it("쉼표로 구분된 id 를 알려진 카테고리로 바꾼다", () => {
    expect(parseCategoryIds("26,28").map((c) => c.id)).toEqual(["26", "28"]);
  });

  it("목록에 없는 id 는 조용히 버린다 — 지원 확인된 카테고리만 부른다", () => {
    expect(parseCategoryIds("26,27,99").map((c) => c.id)).toEqual(["26"]);
  });

  it("빈 값이면 전체를 쓴다", () => {
    expect(parseCategoryIds(null)).toEqual(LIFESTYLE_CATEGORIES);
    expect(parseCategoryIds("")).toEqual(LIFESTYLE_CATEGORIES);
  });

  it("전부 모르는 id 면 전체로 되돌린다 — 빈손으로 부르지 않는다", () => {
    expect(parseCategoryIds("99,100")).toEqual(LIFESTYLE_CATEGORIES);
  });

  it("공백과 중복을 정리한다", () => {
    expect(parseCategoryIds(" 26 , 26 ,22 ").map((c) => c.id)).toEqual(["26", "22"]);
  });
});

describe("fetchYoutubeTrendingCandidates — 카테고리 선택", () => {
  it("건네준 카테고리만 부른다", async () => {
    const called: string[] = [];
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      called.push(new URL(String(input)).searchParams.get("videoCategoryId") ?? "");
      return { ok: true, status: 200, json: async () => ({ items: [] }) };
    });

    await fetchYoutubeTrendingCandidates("key", [LIFESTYLE_CATEGORIES[0]], mockFetch as unknown as typeof fetch);

    expect(called).toEqual(["26"]);
  });
});

describe("friendlyYoutubeError", () => {
  it("quotaExceeded 사유는 하루 사용량을 다 썼다고 한국어로 안내한다", () => {
    const msg = friendlyYoutubeError(
      new YoutubeApiError("HTTP 403", { error: { code: 403, message: "x", errors: [{ reason: "quotaExceeded" }] } }),
    );
    expect(msg).toContain("사용량");
    expect(msg).not.toContain("quotaExceeded");
  });

  it("API 키가 올바르지 않으면 키 확인 안내를 준다", () => {
    const msg = friendlyYoutubeError(
      new YoutubeApiError("HTTP 400", { error: { code: 400, message: "API key not valid" } }),
    );
    expect(msg).toContain("키");
    expect(msg).toContain("YOUTUBE_API_KEY");
  });

  it("그 밖의 실패는 일반 문구로 안내한다", () => {
    const msg = friendlyYoutubeError(new YoutubeApiError("HTTP 500", { error: { code: 500, message: "boom" } }));
    expect(msg).not.toContain("boom");
    expect(msg).toContain("유튜브");
  });

  it("AllCategoriesFailedError(카테고리 전부 실패)도 유튜브 관련 한국어 안내를 준다", () => {
    const msg = friendlyYoutubeError(new AllCategoriesFailedError([new Error("a"), new Error("b")]));
    expect(msg).toContain("유튜브");
  });

  it("YoutubeApiError가 아닌 값(네트워크 실패)은 네트워크 문구로 안내한다", () => {
    const msg = friendlyYoutubeError(new TypeError("fetch failed"));
    expect(msg).toContain("네트워크");
    expect(msg).not.toContain("fetch failed");
  });
});

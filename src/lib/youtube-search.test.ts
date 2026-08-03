import { describe, it, expect, vi } from "vitest";
import { YoutubeApiError } from "./youtube-trending";
import {
  YOUTUBE_SEARCH_DAILY_LIMIT,
  YOUTUBE_SEARCH_UNIT_COST,
  buildYoutubeSearchUrl,
  fetchYoutubeSearchMaterials,
  friendlyYoutubeSearchError,
} from "./youtube-search";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("buildYoutubeSearchUrl", () => {
  it("search.list 를 한국·영상 한정으로 부른다", () => {
    const url = new URL(buildYoutubeSearchUrl("key", "에어컨 전기세"));

    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/youtube/v3/search");
    expect(url.searchParams.get("part")).toBe("snippet");
    expect(url.searchParams.get("type")).toBe("video");
    expect(url.searchParams.get("regionCode")).toBe("KR");
    expect(url.searchParams.get("q")).toBe("에어컨 전기세");
    expect(url.searchParams.get("key")).toBe("key");
  });
});

describe("호출 비용", () => {
  it("search.list 는 호출당 100유닛이라 하루 100회다", () => {
    expect(YOUTUBE_SEARCH_UNIT_COST).toBe(100);
    expect(YOUTUBE_SEARCH_DAILY_LIMIT).toBe(10_000 / YOUTUBE_SEARCH_UNIT_COST);
  });
});

describe("fetchYoutubeSearchMaterials", () => {
  it("영상 제목과 채널명을 뽑아 온다", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse(200, {
        items: [
          { id: { videoId: "v1" }, snippet: { title: "제목1", channelTitle: "채널1" } },
          { id: { videoId: "v2" }, snippet: { title: "제목2", channelTitle: "채널2" } },
        ],
      }),
    );

    const items = await fetchYoutubeSearchMaterials("key", "질문", mockFetch as unknown as typeof fetch);

    expect(items).toEqual([
      { videoId: "v1", title: "제목1", channelTitle: "채널1" },
      { videoId: "v2", title: "제목2", channelTitle: "채널2" },
    ]);
  });

  it("영상이 아닌 결과(채널·재생목록)는 videoId 가 없어 걸러진다", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse(200, {
        items: [
          { id: { channelId: "c1" }, snippet: { title: "채널", channelTitle: "채널" } },
          { id: { videoId: "v1" }, snippet: { title: "제목1", channelTitle: "채널1" } },
        ],
      }),
    );

    const items = await fetchYoutubeSearchMaterials("key", "질문", mockFetch as unknown as typeof fetch);

    expect(items.map((i) => i.videoId)).toEqual(["v1"]);
  });

  it("HTTP 실패는 YoutubeApiError 로 감싸 던진다", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(403, { error: { errors: [{ reason: "quotaExceeded" }] } }));

    await expect(
      fetchYoutubeSearchMaterials("key", "질문", mockFetch as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(YoutubeApiError);
  });
});

describe("friendlyYoutubeSearchError — 언제나 한국어", () => {
  it("하루 한도 초과는 검색이 100유닛이라는 사실까지 알려 준다", () => {
    const message = friendlyYoutubeSearchError(
      new YoutubeApiError("HTTP 403", { error: { errors: [{ reason: "quotaExceeded" }] } }),
    );

    expect(message).toContain("100번");
    expect(/[가-힣]/.test(message)).toBe(true);
  });

  it("모르는 실패도 영문을 노출하지 않는다", () => {
    const message = friendlyYoutubeSearchError(new Error("Failed to fetch"));

    expect(message).not.toContain("fetch");
    expect(/[가-힣]/.test(message)).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

function makeRequest(host: string, query: string) {
  return new Request(`http://${host}/api/materials?${query}`, { headers: { host } });
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const OLD_ENV = { ...process.env };

beforeEach(() => {
  process.env.YOUTUBE_API_KEY = "yt-key";
});
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/materials — 로컬 전용", () => {
  it("다른 기기에서 부르면 403 과 한국어 안내를 준다", async () => {
    const res = await GET(makeRequest("192.168.0.5:3500", "mode=trending"));

    expect(res.status).toBe(403);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
  });
});

describe("GET /api/materials — 급상승", () => {
  it("요청한 카테고리만 부르고 영상 제목을 그대로 돌려준다", async () => {
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const id = new URL(String(input)).searchParams.get("videoCategoryId") ?? "";
        asked.push(id);
        return jsonResponse(200, {
          items: [{ id: `v-${id}`, snippet: { title: `제목-${id}`, channelTitle: "채널", categoryId: id } }],
        });
      }),
    );

    const res = await GET(makeRequest("localhost:3500", "mode=trending&categories=26"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(asked).toEqual(["26"]);
    expect(data.mode).toBe("trending");
    expect(data.items).toEqual([{ videoId: "v-26", title: "제목-26", channelTitle: "채널" }]);
    expect(data.youtubeCategories).toEqual(["살림·요리·꿀팁"]);
  });

  it("카테고리 하나가 실패해도 나머지로 진행하고 건너뛴 것을 한국어로 밝힌다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const id = new URL(String(input)).searchParams.get("videoCategoryId") ?? "";
        if (id === "22") return jsonResponse(404, { error: { errors: [{ reason: "notFound" }] } });
        return jsonResponse(200, {
          items: [{ id: `v-${id}`, snippet: { title: `제목-${id}`, channelTitle: "채널", categoryId: id } }],
        });
      }),
    );

    const data = await (await GET(makeRequest("localhost:3500", "mode=trending"))).json();

    expect(data.skippedYoutubeCategories).toEqual(["일상·브이로그"]);
    expect(data.items.length).toBeGreaterThan(0);
  });
});

describe("GET /api/materials — 키워드 검색", () => {
  it("검색어를 유튜브에 그대로 넘기고 결과를 돌려준다", async () => {
    let seen = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        seen = new URL(String(input)).searchParams.get("q") ?? "";
        return jsonResponse(200, {
          items: [{ id: { videoId: "v1" }, snippet: { title: "제목1", channelTitle: "채널1" } }],
        });
      }),
    );

    const data = await (await GET(makeRequest("localhost:3500", "mode=search&q=%EC%A0%84%EA%B8%B0%EC%84%B8"))).json();

    expect(seen).toBe("전기세");
    expect(data.mode).toBe("search");
    expect(data.query).toBe("전기세");
    expect(data.items).toEqual([{ videoId: "v1", title: "제목1", channelTitle: "채널1" }]);
  });

  it("검색어가 비면 400 과 한국어 안내를 준다 — 100유닛을 헛되이 쓰지 않는다", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await GET(makeRequest("localhost:3500", "mode=search&q=%20"));

    expect(res.status).toBe(400);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("하루 한도를 넘기면 한국어로 상한을 알려 준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(403, { error: { errors: [{ reason: "quotaExceeded" }] } })));

    const res = await GET(makeRequest("localhost:3500", "mode=search&q=%EC%A0%84%EA%B8%B0%EC%84%B8"));

    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("100번");
  });
});

describe("GET /api/materials — 잘못된 요청", () => {
  it("모르는 mode 는 400 과 한국어 안내를 준다", async () => {
    const res = await GET(makeRequest("localhost:3500", "mode=nope"));

    expect(res.status).toBe(400);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
  });

  it("유튜브 키가 없으면 400 과 무엇이 없는지 한국어로 알려 준다", async () => {
    delete process.env.YOUTUBE_API_KEY;

    const res = await GET(makeRequest("localhost:3500", "mode=trending"));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("유튜브");
  });
});

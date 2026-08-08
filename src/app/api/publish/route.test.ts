import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { POST } from "@/app/api/publish/route";
import { saveShare } from "@/lib/share-blob";
import { readPublishProgress } from "@/lib/publish-progress-store";
import { readQueue, scheduleRoot } from "@/lib/schedule-queue";

// Blob 은 네트워크다 — 이 테스트는 node 환경에서 돌고 바깥을 타면 안 된다. 토큰별로 넣은
// 만큼의 주소를 돌려주는 최소 흉내만 낸다. share-blob 자신의 판단은 `share-blob.test.ts`.
const blobs = new Map<string, { urls: string[]; keyword: string; issuedAt: number }>();
vi.mock("@/lib/share-blob", () => ({
  saveShare: vi.fn(async (token: string, images: Buffer[], meta: { keyword: string; issuedAt: number }) => {
    const urls = images.map((_, i) => `https://blob.example/share/${token}/${i + 1}.png`);
    blobs.set(token, { urls, ...meta });
    return urls;
  }),
  loadShare: vi.fn(async (token: string) => blobs.get(token) ?? null),
  deleteShare: vi.fn(async (token: string) => {
    blobs.delete(token);
  }),
}));

/**
 * 로그인 판정은 미들웨어(`src/middleware.ts`)가 하고 그 로직은 `@/lib/auth.test.ts` 가
 * 덮는다. 여기서는 이 라우트 자신의 검증과 게시 흐름만 본다 — 인스타그램 설정을 모두 비워
 * 어디서 막히는지(설정 없음 400)를 결정론적으로 만든다.
 */
const ENV_KEYS = ["PUBLIC_BASE_URL", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"] as const;
function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}
afterEach(clearEnv);

function makeRequest(host: string, body: unknown): Request {
  return new Request("http://x/api/publish", {
    method: "POST",
    headers: { host, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Graph API 3단계 호출을 전부 즉시 성공시키는 공용 mock — 게시 성공 경로 테스트에 쓴다. */
function stubSuccessfulGraphApi() {
  const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body instanceof URLSearchParams ? init.body.toString() : String(init?.body ?? "");
    const jsonResponse = (status: number, data: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    });

    if (method === "POST" && url.endsWith("/media") && body.includes("is_carousel_item")) {
      return jsonResponse(200, { id: "item" });
    }
    if (method === "GET" && url.includes("status_code")) {
      return jsonResponse(200, { status_code: "FINISHED" });
    }
    if (method === "POST" && url.endsWith("/media") && body.includes("media_type=CAROUSEL")) {
      return jsonResponse(200, { id: "carousel-1" });
    }
    if (method === "POST" && url.endsWith("/media_publish")) {
      return jsonResponse(200, { id: "media-1" });
    }
    throw new Error(`unexpected call: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", mockFetch);
}

function setFullEnv() {
  process.env.PUBLIC_BASE_URL = "https://example.ngrok-free.app";
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "17841400000000000";
  process.env.INSTAGRAM_ACCESS_TOKEN = "long-lived-secret-token";
}

describe("POST /api/publish 진행 상황 기록·정리", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
  });

  it("게시가 끝나면(성공) 진행 상황 기록을 남기지 않는다", async () => {
    setFullEnv();
    stubSuccessfulGraphApi();
    const token = randomUUID();
    await saveShare(token, [Buffer.from("a"), Buffer.from("b")], { keyword: "테스트", issuedAt: Date.now() });

    const res = await POST(makeRequest("localhost:3500", { token, caption: "" }));

    expect(res.status).toBe(200);
    expect(readPublishProgress(token, Date.now())).toBeNull();
  });

  it("게시가 끝나면(실패) 진행 상황 기록을 남기지 않는다", async () => {
    setFullEnv();
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Invalid parameter", code: 100 } }),
    }));
    vi.stubGlobal("fetch", mockFetch);
    const token = randomUUID();
    await saveShare(token, [Buffer.from("a"), Buffer.from("b")], { keyword: "테스트", issuedAt: Date.now() });

    const res = await POST(makeRequest("localhost:3500", { token, caption: "" }));

    expect(res.status).toBe(502);
    expect(readPublishProgress(token, Date.now())).toBeNull();
  });

  it("게시가 도는 동안(onProgress 콜백) 진행 상황을 그 토큰에 기록한다", async () => {
    setFullEnv();
    let sawPreparingDuringRun = false;
    const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body instanceof URLSearchParams ? init.body.toString() : String(init?.body ?? "");
      const jsonResponse = (status: number, data: unknown) => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => data,
      });

      if (method === "POST" && url.endsWith("/media") && body.includes("is_carousel_item")) {
        // 아이템 컨테이너 생성 시점 = onProgress가 이미 "preparing"을 기록해 둔 뒤여야 한다.
        if (readPublishProgress(token, Date.now())?.stage === "preparing") sawPreparingDuringRun = true;
        return jsonResponse(200, { id: "item" });
      }
      if (method === "GET" && url.includes("status_code")) {
        return jsonResponse(200, { status_code: "FINISHED" });
      }
      if (method === "POST" && url.endsWith("/media") && body.includes("media_type=CAROUSEL")) {
        return jsonResponse(200, { id: "carousel-1" });
      }
      if (method === "POST" && url.endsWith("/media_publish")) {
        return jsonResponse(200, { id: "media-1" });
      }
      throw new Error(`unexpected call: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);
    const token = randomUUID();
    await saveShare(token, [Buffer.from("a"), Buffer.from("b")], { keyword: "테스트", issuedAt: Date.now() });

    await POST(makeRequest("localhost:3500", { token, caption: "" }));

    expect(sawPreparingDuringRun).toBe(true);
  });
});

describe("POST /api/publish 설정 검증", () => {
  it("인스타그램 설정이 없으면 400 과 무엇이 없는지 알려 준다", async () => {
    clearEnv();
    const res = await POST(makeRequest("localhost:3500", { token: randomUUID(), caption: "" }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("설정");
  });
});

describe("POST /api/publish 해시태그 검증·결합", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
  });

  it("해시태그가 5개를 넘으면 400과 한국어 사유로 거절한다", async () => {
    setFullEnv();
    const token = randomUUID();
    await saveShare(token, [Buffer.from("a"), Buffer.from("b")], { keyword: "테스트", issuedAt: Date.now() });

    const res = await POST(
      makeRequest("localhost:3500", {
        token,
        caption: "",
        hashtags: ["가", "나", "다", "라", "마", "바"],
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/[가-힣]/);
    expect(data.error).toContain("5");
  });

  it("해시태그가 5개면 통과해 캡션 뒤에 합쳐 인스타그램으로 보낸다", async () => {
    setFullEnv();
    let carouselCaption: string | null = null;
    const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body instanceof URLSearchParams ? init.body.toString() : String(init?.body ?? "");
      const jsonResponse = (status: number, data: unknown) => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => data,
      });

      if (method === "POST" && url.endsWith("/media") && body.includes("is_carousel_item")) {
        return jsonResponse(200, { id: "item" });
      }
      if (method === "GET" && url.includes("status_code")) {
        return jsonResponse(200, { status_code: "FINISHED" });
      }
      if (method === "POST" && url.endsWith("/media") && body.includes("media_type=CAROUSEL")) {
        carouselCaption = new URLSearchParams(body).get("caption");
        return jsonResponse(200, { id: "carousel-1" });
      }
      if (method === "POST" && url.endsWith("/media_publish")) {
        return jsonResponse(200, { id: "media-1" });
      }
      throw new Error(`unexpected call: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);
    const token = randomUUID();
    await saveShare(token, [Buffer.from("a"), Buffer.from("b")], { keyword: "테스트", issuedAt: Date.now() });

    const res = await POST(
      makeRequest("localhost:3500", { token, caption: "오늘의 카드뉴스", hashtags: ["다이어트", "헬스"] })
    );

    expect(res.status).toBe(200);
    expect(carouselCaption).toBe("오늘의 카드뉴스\n\n#다이어트 #헬스");
  });
});

/**
 * 정보전달은 한 장이다. 예전엔 이 라우트가 2장 미만을 무조건 거절했다 — 캐러셀만 알았기 때문이다.
 * 이제 장수에 따라 갈린다(`publishKindFor`). 여기서 잡는 것: 한 장이 실제로 올라가는가,
 * 그리고 그 요청에 캐러셀 표식이 섞이지 않는가.
 */
describe("POST /api/publish 장수에 따른 갈림", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
  });

  /** 단일 게시(컨테이너 하나 → 게시)를 성공시키고, 오간 요청 본문을 모아 준다. */
  function stubSingleImageGraphApi() {
    const bodies: string[] = [];
    const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body instanceof URLSearchParams ? init.body.toString() : String(init?.body ?? "");
      if (method === "POST") bodies.push(body);
      const jsonResponse = (status: number, data: unknown) => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => data,
      });
      if (method === "POST" && url.endsWith("/media")) return jsonResponse(200, { id: "container-1" });
      if (method === "GET" && url.includes("status_code")) return jsonResponse(200, { status_code: "FINISHED" });
      if (method === "POST" && url.endsWith("/media_publish")) return jsonResponse(200, { id: "media-solo" });
      throw new Error(`unexpected call: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);
    return bodies;
  }

  it("한 장이면 단일 게시로 올린다 — 캐러셀 표식을 보내지 않는다", async () => {
    setFullEnv();
    const bodies = stubSingleImageGraphApi();
    const token = randomUUID();
    await saveShare(token, [Buffer.from("a")], { keyword: "여름 전기세", issuedAt: Date.now() });

    const res = await POST(makeRequest("localhost:3500", { token, caption: "한 장" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mediaId: "media-solo" });
    expect(bodies.some((b) => b.includes("is_carousel_item"))).toBe(false);
    expect(bodies.some((b) => b.includes("media_type=CAROUSEL"))).toBe(false);
  });

  it("한 장이어도 캡션과 해시태그를 합쳐 보낸다", async () => {
    setFullEnv();
    const bodies = stubSingleImageGraphApi();
    const token = randomUUID();
    await saveShare(token, [Buffer.from("a")], { keyword: "여름 전기세", issuedAt: Date.now() });

    await POST(makeRequest("localhost:3500", { token, caption: "본문", hashtags: ["살림"] }));

    const container = bodies.find((b) => b.includes("image_url"));
    expect(container).toBeDefined();
    expect(decodeURIComponent(container ?? "")).toContain("본문");
    expect(decodeURIComponent(container ?? "")).toContain("#살림");
  });

  it("한 장도 아니면(0장) 한국어로 거절한다", async () => {
    setFullEnv();
    const token = randomUUID();
    await saveShare(token, [], { keyword: "빈 것", issuedAt: Date.now() });

    const res = await POST(makeRequest("localhost:3500", { token, caption: "" }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(/[가-힣]/.test(body.error)).toBe(true);
  });
});

/**
 * 손으로 올린 것은 **아무 데도 기록이 안 남았다** — 예약은 목록에 남는데 즉시 업로드는
 * 흔적이 없어 "올라갔나?" 를 인스타에 가서 봐야 했다. 예약과 **같은 장부**에 남긴다.
 */
describe("POST 업로드 기록", () => {
  // 실제 예약 큐를 건드리지 않는다 — 테스트가 사용자의 기록을 읽거나 더럽히면 안 된다.
  let logRoot: string;
  beforeEach(() => {
    logRoot = mkdtempSync(path.join(tmpdir(), "pub-log-"));
    process.env.REPICK_SCHEDULE_ROOT = logRoot;
  });
  afterEach(() => {
    rmSync(logRoot, { recursive: true, force: true });
    delete process.env.REPICK_SCHEDULE_ROOT;
  });
  it("성공하면 장부에 published 로 남는다", async () => {
    setFullEnv();
    stubSuccessfulGraphApi();
    const token = randomUUID();
    await saveShare(token, [Buffer.from("a"), Buffer.from("b")], { keyword: "수원 갈비", issuedAt: Date.now() });

    const res = await POST(makeRequest("localhost:3500", { token, caption: "본문", hashtags: ["살림"] }));

    expect(res.status).toBe(200);
    const rows = readQueue(scheduleRoot());
    const last = rows[rows.length - 1];
    expect(last.status).toBe("published");
    expect(last.keyword).toBe("수원 갈비");
    expect(last.imageCount).toBe(2);
  });

  it("실패하면 남기지 않는다 — 안 올라간 것을 올렸다고 적지 않는다", async () => {
    setFullEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "Invalid" } }) })),
    );
    const before = readQueue(scheduleRoot()).length;
    const token = randomUUID();
    await saveShare(token, [Buffer.from("a"), Buffer.from("b")], { keyword: "실패분", issuedAt: Date.now() });

    await POST(makeRequest("localhost:3500", { token, caption: "", hashtags: [] }));

    expect(readQueue(scheduleRoot()).length).toBe(before);
  });
});

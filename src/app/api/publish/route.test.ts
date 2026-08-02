import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { POST } from "@/app/api/publish/route";
import { saveShare } from "@/lib/share-store";
import { readPublishProgress } from "@/lib/publish-progress-store";

/**
 * `isLocalHost()` 자체 판정 로직은 `@/lib/local-guard.test.ts`가 촘촘히 덮는다 — 여기서는
 * 이 라우트가 그 판정을 실제로 앞단에 붙였는지만 확인한다. 인스타그램 설정을 모두 비워
 * 로컬 요청이 가드를 통과한 뒤 어디서 막히는지(설정 없음 400)를 결정론적으로 만든다.
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
    saveShare(token, { images: [Buffer.from("a"), Buffer.from("b")], keyword: "테스트", issuedAt: Date.now() });

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
    saveShare(token, { images: [Buffer.from("a"), Buffer.from("b")], keyword: "테스트", issuedAt: Date.now() });

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
    saveShare(token, { images: [Buffer.from("a"), Buffer.from("b")], keyword: "테스트", issuedAt: Date.now() });

    await POST(makeRequest("localhost:3500", { token, caption: "" }));

    expect(sawPreparingDuringRun).toBe(true);
  });
});

describe("POST /api/publish 로컬 전용 가드", () => {
  it("집 네트워크 IP로 온 요청은 403으로 막고 한국어로 안내한다", async () => {
    clearEnv();
    const res = await POST(makeRequest("10.0.0.7:3500", { token: randomUUID(), caption: "" }));

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("컴퓨터");
  });

  it("localhost로 온 요청은 가드를 통과해 기존 검증(설정 없음 400)으로 넘어간다", async () => {
    clearEnv();
    const res = await POST(makeRequest("localhost:3500", { token: randomUUID(), caption: "" }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("설정");
  });
});

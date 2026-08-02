import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildCarouselImageUrls,
  friendlyPublishError,
  friendlyVerifyError,
  publishCarousel,
  verifyInstagramConnection,
  InstagramApiError,
  InstagramTimeoutError,
  InstagramAccountMismatchError,
  CAROUSEL_MIN_ITEMS,
  CAROUSEL_MAX_ITEMS,
  type InstagramConfig,
} from "@/lib/instagram";

const config: InstagramConfig = {
  publicBaseUrl: "https://example.ngrok-free.app",
  businessAccountId: "17841400000000000",
  accessToken: "long-lived-secret-token",
  graphHost: "graph.instagram.com",
};

describe("buildCarouselImageUrls", () => {
  it("공유 토큰 경로로 장수만큼 공개 이미지 주소를 만든다", () => {
    const urls = buildCarouselImageUrls("https://example.ngrok-free.app", "tok-123", 3);
    expect(urls).toEqual([
      "https://example.ngrok-free.app/s/tok-123/1.png",
      "https://example.ngrok-free.app/s/tok-123/2.png",
      "https://example.ngrok-free.app/s/tok-123/3.png",
    ]);
  });

  it("base URL 끝에 슬래시가 있어도 중복되지 않는다", () => {
    const urls = buildCarouselImageUrls("https://example.ngrok-free.app/", "tok-123", 1);
    expect(urls).toEqual(["https://example.ngrok-free.app/s/tok-123/1.png"]);
  });
});

describe("friendlyPublishError", () => {
  it("시간 초과는 오래 걸렸다는 한국어 안내를 준다", () => {
    const msg = friendlyPublishError(new InstagramTimeoutError("poll timeout"));
    expect(msg).toContain("오래");
  });

  it("코드 190(OAuthException)은 연결이 끊어졌다고 안내한다", () => {
    const msg = friendlyPublishError(
      new InstagramApiError("HTTP 400", {
        error: { message: "Error validating access token: Session has expired", type: "OAuthException", code: 190 },
      }),
    );
    expect(msg).toContain("연결");
    expect(msg).not.toContain("OAuthException");
    expect(msg).not.toContain("access token");
  });

  it("이미지 주소를 못 가져오면 이미지 주소 문제로 안내한다", () => {
    const msg = friendlyPublishError(
      new InstagramApiError("HTTP 400", {
        error: {
          message: "The image referenced by the image_url does not exist or could not be downloaded",
          code: 9007,
        },
      }),
    );
    expect(msg).toContain("이미지");
    expect(msg).not.toContain("downloaded");
  });

  it("하루 게시 한도를 넘기면 한도 초과로 안내한다", () => {
    const msg = friendlyPublishError(
      new InstagramApiError("HTTP 400", {
        error: {
          message: "The account has reached its publishing limit. Please try again in 24 hours.",
          code: 4,
        },
      }),
    );
    expect(msg).toContain("한도");
    expect(msg).toContain("100");
    expect(msg).not.toContain("publishing limit");
  });

  it("그 밖의 실패는 원문을 감추고 일반 문구를 준다", () => {
    const msg = friendlyPublishError(
      new InstagramApiError("HTTP 500", { error: { message: "Some unexpected internal thing happened", code: 1 } }),
    );
    expect(msg).toBe("인스타그램 게시에 실패했어요. 잠시 후 다시 시도해 주세요.");
  });

  it("Graph API 오류 형태가 아닌 값도 안전하게 처리한다", () => {
    expect(friendlyPublishError(new Error("network down"))).toContain("실패");
    expect(friendlyPublishError("이상한 값")).toContain("실패");
  });
});

describe("publishCarousel", () => {
  const noWaitSleep = () => Promise.resolve();

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  /** `fetch` 의 `RequestInit.body` — 구현은 항상 `URLSearchParams` 를 넘긴다. 문자열로 바꿔 비교한다. */
  function bodyToString(body: RequestInit["body"]): string {
    if (body === undefined || body === null) return "";
    if (typeof body === "string") return body;
    if (body instanceof URLSearchParams) return body.toString();
    throw new Error("예상 못한 body 타입");
  }

  it("아이템 컨테이너 → 캐러셀 컨테이너 → 게시 세 단계를 순서대로 호출해 미디어 id를 돌려준다", async () => {
    const calls: { method: string; url: string; body: string }[] = [];
    const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = bodyToString(init?.body);
      calls.push({ method, url, body });

      if (method === "POST" && url.endsWith("/media") && body?.includes("is_carousel_item=true")) {
        const n = calls.filter((c) => c.url.endsWith("/media") && c.body?.includes("is_carousel_item")).length;
        return jsonResponse(200, { id: `item-${n}` });
      }
      if (method === "GET" && url.includes("status_code")) {
        return jsonResponse(200, { status_code: "FINISHED" });
      }
      if (method === "POST" && url.endsWith("/media") && body?.includes("media_type=CAROUSEL")) {
        return jsonResponse(200, { id: "carousel-1" });
      }
      if (method === "POST" && url.endsWith("/media_publish")) {
        return jsonResponse(200, { id: "media-1" });
      }
      throw new Error(`unexpected call: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const mediaId = await publishCarousel(
      { config, imageUrls: ["https://x/1.png", "https://x/2.png"], caption: "안녕" },
      noWaitSleep,
    );

    expect(mediaId).toBe("media-1");
    const carouselCall = calls.find((c) => c.body?.includes("media_type=CAROUSEL"));
    expect(carouselCall?.body).toContain("children=item-1%2Citem-2");
    expect(calls.some((c) => c.url.endsWith("/media_publish") && c.body?.includes("creation_id=carousel-1"))).toBe(
      true,
    );
  });

  it("컨테이너가 대기 상태(IN_PROGRESS)면 준비될 때까지 기다렸다 넘어간다", async () => {
    let statusCalls = 0;
    const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = bodyToString(init?.body);
      if (method === "POST" && url.endsWith("/media") && body.includes("is_carousel_item")) {
        return jsonResponse(200, { id: "item-1" });
      }
      if (method === "GET" && url.includes("status_code")) {
        statusCalls += 1;
        return jsonResponse(200, { status_code: statusCalls < 2 ? "IN_PROGRESS" : "FINISHED" });
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

    const mediaId = await publishCarousel({ config, imageUrls: ["https://x/1.png"], caption: "" }, noWaitSleep);
    expect(mediaId).toBe("media-1");
    expect(statusCalls).toBeGreaterThanOrEqual(2);
  });

  it("상한 시간을 넘도록 준비되지 않으면 무한정 기다리지 않고 시간 초과로 실패한다", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "POST" && url.endsWith("/media")) {
        return jsonResponse(200, { id: "item-1" });
      }
      if (method === "GET" && url.includes("status_code")) {
        return jsonResponse(200, { status_code: "IN_PROGRESS" });
      }
      throw new Error(`unexpected call: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      publishCarousel({ config, imageUrls: ["https://x/1.png"], caption: "" }, noWaitSleep),
    ).rejects.toBeInstanceOf(InstagramTimeoutError);
  });

  it("Graph API가 실패 응답을 주면 InstagramApiError로 감싸 던진다", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse(400, { error: { message: "Invalid parameter", type: "OAuthException", code: 100 } }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      publishCarousel({ config, imageUrls: ["https://x/1.png"], caption: "" }, noWaitSleep),
    ).rejects.toBeInstanceOf(InstagramApiError);
  });

  it("응답 형태가 예상과 다르면(id 없음) InstagramApiError로 실패한다", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(200, { unexpected: true }));
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      publishCarousel({ config, imageUrls: ["https://x/1.png"], caption: "" }, noWaitSleep),
    ).rejects.toBeInstanceOf(InstagramApiError);
  });
});

describe("carousel 상한 상수", () => {
  it("최소 2장, 최대 10장이다", () => {
    expect(CAROUSEL_MIN_ITEMS).toBe(2);
    expect(CAROUSEL_MAX_ITEMS).toBe(10);
  });
});

describe("verifyInstagramConnection", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  it("Graph API의 /me 에 access_token을 실어 계정 정보(user_id·username)를 조회한다", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      expect(url).toContain("/me?fields=user_id,username");
      expect(url).toContain(`access_token=${config.accessToken}`);
      return jsonResponse(200, { user_id: config.businessAccountId, username: "repick_official" });
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await verifyInstagramConnection(config);

    expect(result).toEqual({ username: "repick_official" });
  });

  it("토큰이 가리키는 계정 id가 설정된 계정 id와 다르면 계정 불일치 오류를 던진다", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(200, { user_id: "different-id", username: "other_account" }));
    vi.stubGlobal("fetch", mockFetch);

    await expect(verifyInstagramConnection(config)).rejects.toBeInstanceOf(InstagramAccountMismatchError);
  });

  it("Graph API가 실패 응답을 주면 InstagramApiError로 감싸 던진다", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse(400, {
        error: { message: "Error validating access token: Session has expired", type: "OAuthException", code: 190 },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(verifyInstagramConnection(config)).rejects.toBeInstanceOf(InstagramApiError);
  });
});

describe("friendlyVerifyError", () => {
  it("계정 불일치는 실제 연결된 계정 이름과 함께 한국어로 안내한다", () => {
    const msg = friendlyVerifyError(new InstagramAccountMismatchError("other_account"));
    expect(msg).toContain("other_account");
    expect(msg).toContain("계정");
  });

  it("코드 190(OAuthException)은 연결이 끊어졌다고 안내한다", () => {
    const msg = friendlyVerifyError(
      new InstagramApiError("HTTP 400", {
        error: { message: "Error validating access token: Session has expired", type: "OAuthException", code: 190 },
      }),
    );
    expect(msg).toContain("연결");
    expect(msg).not.toContain("access token");
  });

  it("그 밖의 Graph API 실패는 일반 문구로 안내한다", () => {
    const msg = friendlyVerifyError(
      new InstagramApiError("HTTP 400", { error: { message: "Unsupported get request", code: 100 } }),
    );
    expect(msg).toContain("확인하지 못했");
  });

  it("Graph API 오류 형태가 아닌 값(네트워크 실패 등)은 네트워크 문구로 안내한다", () => {
    const msg = friendlyVerifyError(new TypeError("fetch failed"));
    expect(msg).toContain("네트워크");
    expect(msg).not.toContain("fetch failed");
  });

  it("토큰 값은 어떤 안내 문구에도 담기지 않는다", () => {
    const msg = friendlyVerifyError(
      new InstagramApiError("HTTP 400", { error: { message: config.accessToken, code: 1 } }),
    );
    expect(msg).not.toContain(config.accessToken);
  });
});

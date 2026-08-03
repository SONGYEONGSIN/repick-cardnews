import { describe, it, expect, vi } from "vitest";
import { parseBody, POST } from "@/app/api/generate/route";
import { runClaudeCli, NoStructuredOutput, CliTimeout } from "@/lib/claude-cli";
import { SCHEMA_MISMATCH, friendlyGenerateError } from "@/lib/api-errors";

vi.mock("@/lib/claude-cli", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/claude-cli")>();
  return { ...actual, runClaudeCli: vi.fn() };
});

describe("parseBody", () => {
  it("유효한 입력을 파싱한다", () => {
    expect(parseBody({ keyword: "에어컨 전기세", type: "cardnews" })).toEqual({
      keyword: "에어컨 전기세",
      type: "cardnews",
      photos: [],
    });
  });
  it("빈 키워드를 거부한다", () => {
    expect(() => parseBody({ keyword: "  ", type: "cardnews" })).toThrow();
  });
  it("잘못된 type을 거부한다", () => {
    expect(() => parseBody({ keyword: "x", type: "banner" })).toThrow();
  });
});

describe("parseBody photos", () => {
  const base = { keyword: "에어컨", type: "cardnews" as const };

  it("photos가 없으면 빈 배열로 채운다", () => {
    expect(parseBody(base).photos).toEqual([]);
  });
  it("dataURL 배열을 받는다", () => {
    const photos = ["data:image/jpeg;base64,AAA"];
    expect(parseBody({ ...base, photos }).photos).toEqual(photos);
  });
  it("6장을 넘으면 거부한다", () => {
    const photos = Array.from({ length: 7 }, () => "data:image/jpeg;base64,AAA");
    expect(() => parseBody({ ...base, photos })).toThrow();
  });
  it("dataURL이 아니면 거부한다", () => {
    expect(() => parseBody({ ...base, photos: ["https://example.com/a.jpg"] })).toThrow();
  });
  it("Anthropic이 지원하지 않는 이미지 형식이면 거부한다", () => {
    expect(() => parseBody({ ...base, photos: ["data:image/svg+xml;base64,AAA"] })).toThrow();
  });
});

describe("POST 생성 실패 처리", () => {
  function makeRequest(): Request {
    return new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ keyword: "에어컨 전기세", type: "cardnews" }),
    });
  }

  it("모양은 맞지만 첫 카드가 hook이 아니면 502와 스키마 불일치 오류를 돌려준다", async () => {
    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      type: "cardnews",
      keyword: "에어컨 전기세",
      cards: [
        { role: "problem", heading: "h1", body: "b1" },
        { role: "problem", heading: "h2", body: "b2" },
        { role: "evidence", heading: "h3", body: "b3" },
        { role: "solution", heading: "h4", body: "b4" },
        { role: "cta", heading: "h5", action: "a5" },
      ],
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: SCHEMA_MISMATCH });
  });

  it("NoStructuredOutput 이면 502와 스키마 불일치 오류를 돌려준다", async () => {
    vi.mocked(runClaudeCli).mockRejectedValueOnce(new NoStructuredOutput("structured_output 없음"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: SCHEMA_MISMATCH });
  });

  it("CliTimeout 이면 500과 타임아웃 안내 오류를 돌려준다", async () => {
    const timeoutError = new CliTimeout("제한 시간 초과");
    vi.mocked(runClaudeCli).mockRejectedValueOnce(timeoutError);

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: friendlyGenerateError(timeoutError) });
  });
});

describe("POST 생성 성공 처리", () => {
  function makeRequest(body: unknown): Request {
    return new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  // route.ts:41 의 스키마 선택(informationsend → InfographicSpec, 그 외 → CardnewsSpec)이
  // 뒤바뀌면 여기 두 테스트가 모두 502(SCHEMA_MISMATCH)로 떨어져 잡아낸다.

  it("cardnews 요청은 CardnewsSpec 을 200으로 돌려준다", async () => {
    const spec = {
      type: "cardnews",
      keyword: "에어컨 전기세",
      cards: [
        { role: "hook", heading: "h1" },
        { role: "problem", heading: "h2", body: "b2" },
        { role: "evidence", heading: "h3", body: "b3" },
        { role: "solution", heading: "h4", body: "b4" },
        { role: "cta", heading: "h5", action: "a5" },
      ],
    };
    vi.mocked(runClaudeCli).mockResolvedValueOnce(spec);

    const res = await POST(makeRequest({ keyword: "에어컨 전기세", type: "cardnews" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ spec });
  });

  it("informationsend 요청은 InfographicSpec 을 200으로 돌려준다", async () => {
    const spec = {
      type: "informationsend",
      title: "에어컨 전기세 아끼는 법",
      items: [
        { keyword: "설정온도", desc: "26도로 맞추세요" },
        { keyword: "필터청소", desc: "2주에 한 번 청소하세요" },
        { keyword: "제습모드", desc: "습도가 높을 땐 제습모드를 쓰세요" },
      ],
    };
    vi.mocked(runClaudeCli).mockResolvedValueOnce(spec);

    const res = await POST(makeRequest({ keyword: "에어컨 전기세", type: "informationsend" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ spec });
  });
});

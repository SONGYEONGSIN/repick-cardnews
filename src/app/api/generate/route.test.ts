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

/**
 * Claude 는 시키지 않아도 이모지를 얹어 온다(2026-08-04 실사용에서 확인). 카드에서는 제목을
 * 한 줄 더 밀어내 띠를 키우고 팁 앞에 군더더기를 남긴다 — 여기서 걷어낸다.
 */
describe("POST 이모지 제거", () => {
  function infoRequest(): Request {
    return new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ keyword: "여름 전기세", type: "informationsend" }),
    });
  }

  it("응답 스펙에 이모지가 남지 않는다", async () => {
    vi.mocked(runClaudeCli).mockResolvedValueOnce({
      type: "informationsend",
      title: "여름 전기세 줄이는 4가지 방법 \u{1F4B8}",
      subtitle: "작은 습관만 바꿔도 \u{2728}",
      items: [
        { keyword: "에어컨 26도 \u{1F32C}\u{FE0F}", desc: "너무 낮추지 말고 26도로 맞춰요." },
        { keyword: "필터 청소", desc: "2주에 한 번이면 충분해요." },
        { keyword: "대기전력", desc: "멀티탭 스위치를 꺼요." },
      ],
      tip: "\u{2705} TIP \u{2705} 검침일 기준으로 확인해요.",
    });

    const res = await POST(infoRequest());

    expect(res.status).toBe(200);
    const { spec } = (await res.json()) as { spec: { title: string; subtitle: string; tip: string; items: { keyword: string }[] } };
    expect(spec.title).toBe("여름 전기세 줄이는 4가지 방법");
    expect(spec.subtitle).toBe("작은 습관만 바꿔도");
    expect(spec.tip).toBe("TIP 검침일 기준으로 확인해요.");
    expect(spec.items[0].keyword).toBe("에어컨 26도");
    // 그림 문자 계열이 통째로 사라졌는지 응답 전체로 다시 확인한다.
    expect(/\p{Extended_Pictographic}/u.test(JSON.stringify(spec))).toBe(false);
  });
});

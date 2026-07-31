import { describe, it, expect } from "vitest";
import { friendlyGenerateError } from "@/lib/api-errors";

/** Anthropic SDK 의 APIError 는 status 필드를 갖는다. 그 모양만 흉내 낸다. */
function apiError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

describe("friendlyGenerateError", () => {
  it("429 는 잠시 후 다시 시도하라고 안내한다", () => {
    const msg = friendlyGenerateError(apiError(429, '429 {"type":"error","error":{"type":"rate_limit_error"}}'));
    expect(msg).toContain("잠시 후");
    expect(msg).not.toContain("rate_limit_error");
    expect(msg).not.toContain("{");
  });

  it("401 은 인증을 다시 확인하라고 안내한다", () => {
    const msg = friendlyGenerateError(apiError(401, "401 unauthorized"));
    expect(msg).toContain("인증");
    expect(msg).not.toContain("{");
  });

  it("529 등 과부하는 잠시 후 다시 시도하라고 안내한다", () => {
    expect(friendlyGenerateError(apiError(529, "overloaded"))).toContain("잠시 후");
  });

  it("500 대는 Claude 쪽 문제임을 알린다", () => {
    expect(friendlyGenerateError(apiError(503, "bad gateway"))).toContain("Claude");
  });

  it("status 가 없는 일반 오류는 메시지를 그대로 살린다", () => {
    expect(friendlyGenerateError(new Error("네트워크가 끊겼어요"))).toBe("네트워크가 끊겼어요");
  });

  it("Error 가 아닌 값도 안전하게 처리한다", () => {
    expect(friendlyGenerateError("이상한 값")).toContain("생성 중 오류");
  });

  it("어떤 입력에도 원시 JSON 을 그대로 내보내지 않는다", () => {
    const raw = '{"type":"error","error":{"type":"rate_limit_error","message":"Error"}}';
    expect(friendlyGenerateError(apiError(429, raw))).not.toContain('"type"');
  });
});

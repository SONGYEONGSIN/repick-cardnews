import { describe, it, expect } from "vitest";
import { friendlyGenerateError } from "@/lib/api-errors";
import { CliNotFound, CliFailed, CliTimeout, NoStructuredOutput } from "@/lib/claude-cli";

describe("friendlyGenerateError", () => {
  it("CLI 를 못 찾으면 설치를 확인하라고 안내한다", () => {
    const msg = friendlyGenerateError(new CliNotFound("claude 실행 파일 없음"));
    expect(msg).toContain("Claude Code CLI");
    expect(msg).toContain("설치");
  });

  it("사용량 한도는 한도임을 알린다", () => {
    const msg = friendlyGenerateError(new CliFailed("Claude usage limit reached. Try again later."));
    expect(msg).toContain("사용량 한도");
    expect(msg).not.toContain("usage limit");
  });

  it("rate limit 문구도 한도로 인식한다", () => {
    expect(friendlyGenerateError(new CliFailed("rate_limit_error"))).toContain("사용량 한도");
  });

  it("그 밖의 CLI 실패는 원문을 감추고 일반 문구를 준다", () => {
    const msg = friendlyGenerateError(new CliFailed("There's an issue with the selected model (foo)."));
    expect(msg).toBe("카피 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
  });

  it("타임아웃은 오래 걸렸음을 알린다", () => {
    expect(friendlyGenerateError(new CliTimeout("제한 시간 초과"))).toContain("오래 걸려");
  });

  it("스키마 불일치는 다시 시도하라고 안내한다", () => {
    expect(friendlyGenerateError(new NoStructuredOutput("없음"))).toContain("스키마");
  });

  it("그 밖의 Error 는 이미 한국어이므로 메시지를 살린다", () => {
    expect(friendlyGenerateError(new Error("지원하지 않는 이미지 형식입니다: image/svg+xml"))).toContain("이미지 형식");
  });

  it("Error 가 아닌 값도 안전하게 처리한다", () => {
    expect(friendlyGenerateError("이상한 값")).toContain("생성 중 오류");
  });

  it("CLI 실패 원문의 원시 JSON 을 그대로 내보내지 않는다", () => {
    const raw = '{"type":"error","error":{"type":"rate_limit_error","message":"Error"}}';
    expect(friendlyGenerateError(new CliFailed(raw))).not.toContain('"type"');
  });
});

import { describe, it, expect } from "vitest";
import { InstagramApiError, InstagramTimeoutError } from "@/lib/instagram";
import { publishFailureDetail } from "@/lib/publish-failure-log";

const TOKEN = "long-lived-secret-token-value";

describe("publishFailureDetail", () => {
  it("Graph API 응답 본문을 담는다 — 이걸 봐야 왜 거절됐는지 안다", () => {
    const detail = publishFailureDetail(
      new InstagramApiError("HTTP 400", { error: { message: "Invalid parameter", code: 100 } }),
      [TOKEN],
    );
    expect(detail).toContain("Invalid parameter");
    expect(detail).toContain("100");
  });

  it("토큰이 되비쳐도 지운다 — 로그에 비밀값을 남기지 않는다", () => {
    const detail = publishFailureDetail(
      new InstagramApiError("HTTP 400", { error: { message: `Error validating access token: ${TOKEN}` } }),
      [TOKEN],
    );
    expect(detail).not.toContain(TOKEN);
    expect(detail).toContain("***");
  });

  it("시간 초과도 알아본다", () => {
    expect(publishFailureDetail(new InstagramTimeoutError("poll timeout"), [TOKEN])).toContain("시간 초과");
  });

  it("모르는 값도 문자열로 남긴다 — 아무것도 안 남기는 것보다 낫다", () => {
    expect(publishFailureDetail("그냥 문자열", [TOKEN])).toContain("그냥 문자열");
  });

  it("너무 길면 자른다 — 콘솔을 뒤덮지 않는다", () => {
    const huge = new InstagramApiError("HTTP 400", { error: { message: "가".repeat(2000) } });
    expect(publishFailureDetail(huge, [TOKEN]).length).toBeLessThanOrEqual(500);
  });

  it("짧은 값은 가리지 않는다 — 흔한 글자를 지우면 로그가 걸레가 된다", () => {
    const detail = publishFailureDetail(new InstagramApiError("HTTP 400", { error: { message: "ok" } }), ["ok"]);
    expect(detail).toContain("ok");
  });
});

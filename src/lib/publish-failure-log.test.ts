import { describe, it, expect } from "vitest";
import { InstagramApiError, InstagramTimeoutError } from "@/lib/instagram";
import { publishContextLine, publishFailureDetail } from "@/lib/publish-failure-log";

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

/**
 * 어느 호출인지까지는 좁혔는데(`/media`), 손으로 올릴 때는 같은 함수가 성공했다. 그러면
 * 남은 차이는 **넘긴 값**뿐이다 — 이미지 주소와 캡션. 그 둘을 진단에 담되, 공유 토큰은
 * 가린다(그 주소를 아는 사람은 사진을 가져갈 수 있다).
 */
describe("publishContextLine", () => {
  const URL_WITH_TOKEN = "https://abc.trycloudflare.com/s/9f8e7d6c-1111-2222-3333-444455556666/1.png";

  it("주소의 토막을 가린다", () => {
    const line = publishContextLine({ imageUrl: URL_WITH_TOKEN, captionLength: 120, imageCount: 1 });
    expect(line).not.toContain("9f8e7d6c-1111-2222-3333-444455556666");
    expect(line).toContain("***");
  });

  it("호스트와 경로 모양은 남긴다 — 주소가 맞는지 봐야 한다", () => {
    const line = publishContextLine({ imageUrl: URL_WITH_TOKEN, captionLength: 120, imageCount: 1 });
    expect(line).toContain("abc.trycloudflare.com");
    expect(line).toContain("1.png");
  });

  it("캡션은 길이만 담는다 — 내용은 담지 않는다", () => {
    const line = publishContextLine({ imageUrl: URL_WITH_TOKEN, captionLength: 137, imageCount: 1 });
    expect(line).toContain("137");
  });

  it("장수도 담는다", () => {
    expect(publishContextLine({ imageUrl: URL_WITH_TOKEN, captionLength: 0, imageCount: 5 })).toContain("5장");
  });
});

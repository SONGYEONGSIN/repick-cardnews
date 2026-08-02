import { describe, it, expect } from "vitest";
import {
  readEnvValue,
  applyRefreshToEnvContent,
  parseStoredExpiresAt,
  decideAutoRefresh,
  daysRemaining,
  formatKoreanDate,
  classifyRefreshFailure,
  friendlyRefreshMessage,
  AUTO_REFRESH_THRESHOLD_DAYS,
} from "@/lib/instagram-token-refresh";

describe("readEnvValue", () => {
  it("주석 아닌 KEY=값 줄에서 값을 읽는다", () => {
    const content = "FOO=bar\nINSTAGRAM_ACCESS_TOKEN=abc123\nBAZ=qux\n";
    expect(readEnvValue(content, "INSTAGRAM_ACCESS_TOKEN")).toBe("abc123");
  });

  it("주석 처리된 줄(# KEY=)은 무시한다", () => {
    const content = "# INSTAGRAM_GRAPH_HOST=\nFOO=bar\n";
    expect(readEnvValue(content, "INSTAGRAM_GRAPH_HOST")).toBeUndefined();
  });

  it("키가 없으면 undefined", () => {
    expect(readEnvValue("FOO=bar\n", "INSTAGRAM_ACCESS_TOKEN")).toBeUndefined();
  });

  it("값이 빈 문자열이거나 공백만 있으면 undefined로 본다", () => {
    expect(readEnvValue("INSTAGRAM_ACCESS_TOKEN=\n", "INSTAGRAM_ACCESS_TOKEN")).toBeUndefined();
    expect(readEnvValue("INSTAGRAM_ACCESS_TOKEN=   \n", "INSTAGRAM_ACCESS_TOKEN")).toBeUndefined();
  });
});

describe("applyRefreshToEnvContent", () => {
  it("토큰 줄과 만료일 줄이 둘 다 있으면 값만 바꾸고 나머지는 그대로 둔다", () => {
    const content = [
      "# 주석은 그대로",
      "FOO=bar",
      "INSTAGRAM_ACCESS_TOKEN=old-token",
      "",
      "INSTAGRAM_TOKEN_EXPIRES_AT=2026-01-01T00:00:00.000Z",
      "BAZ=qux",
      "",
    ].join("\n");

    const result = applyRefreshToEnvContent(content, "new-token", "2026-10-03T04:00:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe(
      [
        "# 주석은 그대로",
        "FOO=bar",
        "INSTAGRAM_ACCESS_TOKEN=new-token",
        "",
        "INSTAGRAM_TOKEN_EXPIRES_AT=2026-10-03T04:00:00.000Z",
        "BAZ=qux",
        "",
      ].join("\n"),
    );
  });

  it("만료일 줄이 없으면(처음 자동 갱신) 파일 끝에 새로 추가하고, 트레일링 개행은 유지한다", () => {
    const content = ["FOO=bar", "INSTAGRAM_ACCESS_TOKEN=old-token", ""].join("\n");

    const result = applyRefreshToEnvContent(content, "new-token", "2026-10-03T04:00:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe(
      ["FOO=bar", "INSTAGRAM_ACCESS_TOKEN=new-token", "INSTAGRAM_TOKEN_EXPIRES_AT=2026-10-03T04:00:00.000Z", ""].join(
        "\n",
      ),
    );
  });

  it("트레일링 개행이 없는 파일도 만료일 줄을 끝에 그냥 덧붙인다", () => {
    const content = "FOO=bar\nINSTAGRAM_ACCESS_TOKEN=old-token";

    const result = applyRefreshToEnvContent(content, "new-token", "2026-10-03T04:00:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe(
      "FOO=bar\nINSTAGRAM_ACCESS_TOKEN=new-token\nINSTAGRAM_TOKEN_EXPIRES_AT=2026-10-03T04:00:00.000Z",
    );
  });

  it("토큰 줄이 없으면 아무것도 바꾸지 않고 실패를 알린다", () => {
    const content = "FOO=bar\nBAZ=qux\n";

    const result = applyRefreshToEnvContent(content, "new-token", "2026-10-03T04:00:00.000Z");

    expect(result).toEqual({ ok: false, reason: "token-line-missing" });
  });

  it("값에는 새 토큰 문자열이 그대로 들어가고 원래 토큰 값은 결과에 남지 않는다", () => {
    const content = "INSTAGRAM_ACCESS_TOKEN=old-secret-token\n";
    const result = applyRefreshToEnvContent(content, "new-secret-token", "2026-10-03T04:00:00.000Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).not.toContain("old-secret-token");
    expect(result.content).toContain("new-secret-token");
  });
});

describe("parseStoredExpiresAt", () => {
  it("올바른 ISO 문자열을 Date로 바꾼다", () => {
    const date = parseStoredExpiresAt("2026-10-03T04:00:00.000Z");
    expect(date?.toISOString()).toBe("2026-10-03T04:00:00.000Z");
  });

  it("없으면 undefined", () => {
    expect(parseStoredExpiresAt(undefined)).toBeUndefined();
  });

  it("파싱할 수 없는 값이면 undefined", () => {
    expect(parseStoredExpiresAt("이건-날짜가-아님")).toBeUndefined();
  });
});

describe("decideAutoRefresh", () => {
  const now = new Date("2026-08-02T00:00:00.000Z");
  const daysLater = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  it("기록이 없으면 한 번 시도한다", () => {
    expect(decideAutoRefresh(now, undefined)).toEqual({ attempt: true, reason: "no-record" });
  });

  it("이미 만료됐으면 시도하지 않는다", () => {
    expect(decideAutoRefresh(now, daysLater(-1))).toEqual({ attempt: false, reason: "already-expired" });
  });

  it("만료 시각이 지금과 같아도(0초 남음) 시도하지 않는다", () => {
    expect(decideAutoRefresh(now, now)).toEqual({ attempt: false, reason: "already-expired" });
  });

  it("남은 기간이 임계값보다 많이 남으면 시도하지 않는다", () => {
    expect(decideAutoRefresh(now, daysLater(45))).toEqual({ attempt: false, reason: "not-yet" });
  });

  it("남은 기간이 임계값 이하면 시도한다", () => {
    expect(decideAutoRefresh(now, daysLater(10))).toEqual({ attempt: true, reason: "expiring-soon" });
  });

  it(`경계값 — 정확히 ${AUTO_REFRESH_THRESHOLD_DAYS}일 남으면 시도한다`, () => {
    expect(decideAutoRefresh(now, daysLater(AUTO_REFRESH_THRESHOLD_DAYS))).toEqual({
      attempt: true,
      reason: "expiring-soon",
    });
  });

  it(`경계값 — ${AUTO_REFRESH_THRESHOLD_DAYS}일보다 조금이라도 더 남으면 시도하지 않는다`, () => {
    const justOver = new Date(daysLater(AUTO_REFRESH_THRESHOLD_DAYS).getTime() + 1);
    expect(decideAutoRefresh(now, justOver)).toEqual({ attempt: false, reason: "not-yet" });
  });
});

describe("daysRemaining", () => {
  it("남은 시간을 올림한 일수로 돌려준다", () => {
    const now = new Date("2026-08-02T00:00:00.000Z");
    const expiresAt = new Date(now.getTime() + 61.5 * 24 * 60 * 60 * 1000);
    expect(daysRemaining(now, expiresAt)).toBe(62);
  });

  it("음수가 되지 않는다(만료 후는 0)", () => {
    const now = new Date("2026-08-02T00:00:00.000Z");
    const past = new Date(now.getTime() - 1000);
    expect(daysRemaining(now, past)).toBe(0);
  });
});

describe("formatKoreanDate", () => {
  it("월/일만 한국어로 표기한다", () => {
    expect(formatKoreanDate(new Date("2026-10-03T04:00:00.000Z"))).toMatch(/월 \d+일/);
  });
});

describe("classifyRefreshFailure", () => {
  it("메시지에 24와 hour가 함께 있으면 too-soon", () => {
    const body = { error: { message: "You must wait at least 24 hours between token refreshes.", code: 4 } };
    expect(classifyRefreshFailure(body)).toBe("too-soon");
  });

  it("서브코드 463(세션 만료)이면 invalid-or-expired", () => {
    const body = { error: { message: "Session has expired", error_subcode: 463 } };
    expect(classifyRefreshFailure(body)).toBe("invalid-or-expired");
  });

  it("코드 190(OAuthException)이면 invalid-or-expired", () => {
    const body = { error: { message: "Invalid OAuth access token", code: 190 } };
    expect(classifyRefreshFailure(body)).toBe("invalid-or-expired");
  });

  it("둘 다 아니면 other", () => {
    const body = { error: { message: "Something unexpected happened", code: 999 } };
    expect(classifyRefreshFailure(body)).toBe("other");
  });

  it("에러 모양이 아니면 other", () => {
    expect(classifyRefreshFailure({ nope: true })).toBe("other");
    expect(classifyRefreshFailure(undefined)).toBe("other");
  });
});

describe("friendlyRefreshMessage", () => {
  it("too-soon은 정상 상황이라는 뉘앙스로 안내한다", () => {
    expect(friendlyRefreshMessage("too-soon")).toContain("정상");
  });

  it("invalid-or-expired는 대시보드 안내 문서를 가리킨다", () => {
    expect(friendlyRefreshMessage("invalid-or-expired")).toContain("instagram-setup.md");
  });

  it("모든 사유가 빈 문자열이 아닌 한국어 문장을 돌려준다", () => {
    const reasons = [
      "too-soon",
      "invalid-or-expired",
      "other",
      "network",
      "config-missing",
      "token-line-missing",
    ] as const;
    for (const reason of reasons) {
      const message = friendlyRefreshMessage(reason);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/^[a-zA-Z0-9\s.,]+$/);
    }
  });
});

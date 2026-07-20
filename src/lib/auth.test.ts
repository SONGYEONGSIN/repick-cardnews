import { describe, it, expect } from "vitest";
import { resolveAuthMode, oauthToken } from "@/lib/auth";

describe("resolveAuthMode", () => {
  it("ANTHROPIC_API_KEY가 있으면 api_key를 반환한다", () => {
    expect(resolveAuthMode({ ANTHROPIC_API_KEY: "sk-ant-xxx" })).toBe("api_key");
  });

  it("ANTHROPIC_AUTH_TOKEN만 있으면 oauth를 반환한다", () => {
    expect(resolveAuthMode({ ANTHROPIC_AUTH_TOKEN: "sk-ant-oat01-xxx" })).toBe("oauth");
  });

  it("CLAUDE_CODE_OAUTH_TOKEN만 있으면 oauth를 반환한다", () => {
    expect(resolveAuthMode({ CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-yyy" })).toBe("oauth");
  });

  it("아무 것도 없으면 none을 반환한다", () => {
    expect(resolveAuthMode({})).toBe("none");
  });

  it("ANTHROPIC_API_KEY가 토큰보다 우선한다", () => {
    expect(
      resolveAuthMode({
        ANTHROPIC_API_KEY: "sk-ant-xxx",
        ANTHROPIC_AUTH_TOKEN: "sk-ant-oat01-xxx",
      }),
    ).toBe("api_key");
  });
});

describe("oauthToken", () => {
  it("ANTHROPIC_AUTH_TOKEN을 반환한다", () => {
    expect(oauthToken({ ANTHROPIC_AUTH_TOKEN: "sk-ant-oat01-xxx" })).toBe("sk-ant-oat01-xxx");
  });

  it("ANTHROPIC_AUTH_TOKEN이 없으면 CLAUDE_CODE_OAUTH_TOKEN을 반환한다", () => {
    expect(oauthToken({ CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-yyy" })).toBe("sk-ant-oat01-yyy");
  });

  it("ANTHROPIC_AUTH_TOKEN이 CLAUDE_CODE_OAUTH_TOKEN보다 우선한다", () => {
    expect(
      oauthToken({
        ANTHROPIC_AUTH_TOKEN: "sk-ant-oat01-xxx",
        CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-yyy",
      }),
    ).toBe("sk-ant-oat01-xxx");
  });

  it("둘 다 없으면 undefined를 반환한다", () => {
    expect(oauthToken({})).toBeUndefined();
  });
});

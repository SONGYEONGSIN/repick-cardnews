import { describe, it, expect } from "vitest";
import { stripJsonSchemaMeta, buildStreamJsonLine, childEnv } from "@/lib/claude-cli";

describe("stripJsonSchemaMeta", () => {
  it("$schema 키를 제거한다", () => {
    const out = stripJsonSchemaMeta({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: { a: { type: "string" } },
    });
    expect(out).not.toHaveProperty("$schema");
    expect(out.type).toBe("object");
    expect(out.properties).toEqual({ a: { type: "string" } });
  });

  it("$schema 가 없어도 나머지를 그대로 돌려준다", () => {
    expect(stripJsonSchemaMeta({ type: "object" })).toEqual({ type: "object" });
  });

  it("원본을 수정하지 않는다", () => {
    const original = { $schema: "x", type: "object" };
    stripJsonSchemaMeta(original);
    expect(original.$schema).toBe("x");
  });
});

describe("buildStreamJsonLine", () => {
  it("user 메시지 한 줄을 개행으로 끝맺는다", () => {
    const line = buildStreamJsonLine([{ type: "text", text: "안녕" }]);
    expect(line.endsWith("\n")).toBe(true);
    expect(JSON.parse(line)).toEqual({
      type: "user",
      message: { role: "user", content: [{ type: "text", text: "안녕" }] },
    });
  });

  it("이미지 블록을 그대로 실어 보낸다", () => {
    const image = {
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/png" as const, data: "AAA" },
    };
    const parsed = JSON.parse(buildStreamJsonLine([image, { type: "text", text: "설명" }]));
    expect(parsed.message.content[0]).toEqual(image);
  });
});

describe("childEnv", () => {
  it("한도에 걸린 토큰이 자식에게 새지 않게 지운다", () => {
    const env = childEnv({ ANTHROPIC_AUTH_TOKEN: "t", ANTHROPIC_API_KEY: "k", PATH: "/usr/bin" });
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.PATH).toBe("/usr/bin");
  });

  it("원본 env 를 수정하지 않는다", () => {
    const parent = { ANTHROPIC_AUTH_TOKEN: "t" };
    childEnv(parent);
    expect(parent.ANTHROPIC_AUTH_TOKEN).toBe("t");
  });
});

import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import type { ContentBlock } from "@/lib/prompt";
import {
  stripJsonSchemaMeta,
  buildStreamJsonLine,
  childEnv,
  readStructuredOutput,
  runClaudeCli,
  CliFailed,
  NoStructuredOutput,
  CliNotFound,
  CliTimeout,
} from "@/lib/claude-cli";

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
    const env = childEnv({
      NODE_ENV: "test",
      ANTHROPIC_AUTH_TOKEN: "t",
      ANTHROPIC_API_KEY: "k",
      CLAUDE_CODE_OAUTH_TOKEN: "o",
      PATH: "/usr/bin",
    });
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
    expect(env.PATH).toBe("/usr/bin");
  });

  it("원본 env 를 수정하지 않는다", () => {
    const parent: NodeJS.ProcessEnv = { NODE_ENV: "test", ANTHROPIC_AUTH_TOKEN: "t" };
    childEnv(parent);
    expect(parent.ANTHROPIC_AUTH_TOKEN).toBe("t");
  });
});

/** CLI 가 실제로 뱉는 stream-json 이벤트 모양. */
function resultLine(fields: Record<string, unknown>): string {
  return `${JSON.stringify({ type: "result", ...fields })}\n`;
}

describe("readStructuredOutput", () => {
  const noise = `${JSON.stringify({ type: "system", subtype: "init" })}\n`;

  it("result 이벤트의 structured_output 을 돌려준다", () => {
    const stdout = noise + resultLine({ is_error: false, structured_output: { type: "cardnews" } });
    expect(readStructuredOutput(stdout)).toEqual({ type: "cardnews" });
  });

  it("is_error 면 CLI 가 준 사유를 담아 CliFailed 를 던진다", () => {
    const stdout = resultLine({ is_error: true, result: "usage limit reached" });
    expect(() => readStructuredOutput(stdout)).toThrow(CliFailed);
    expect(() => readStructuredOutput(stdout)).toThrow(/usage limit reached/);
  });

  it("subtype 이 success 라도 is_error 를 우선한다", () => {
    const stdout = resultLine({ is_error: true, subtype: "success", result: "model not found" });
    expect(() => readStructuredOutput(stdout)).toThrow(CliFailed);
    expect(() => readStructuredOutput(stdout)).toThrow(/model not found/);
  });

  it("structured_output 이 없으면 NoStructuredOutput 을 던진다", () => {
    expect(() => readStructuredOutput(resultLine({ is_error: false }))).toThrow(NoStructuredOutput);
    expect(() => readStructuredOutput(resultLine({ is_error: false }))).toThrow(/structured_output/);
  });

  it("result 이벤트가 아예 없으면 CliFailed 를 던진다", () => {
    expect(() => readStructuredOutput(noise)).toThrow(CliFailed);
    expect(() => readStructuredOutput(noise)).toThrow(/결과를 내지 않았습니다/);
  });

  it("깨진 JSON 줄은 건너뛰고 계속 읽는다", () => {
    const stdout = `깨진 줄\n${resultLine({ is_error: false, structured_output: { ok: true } })}`;
    expect(readStructuredOutput(stdout)).toEqual({ ok: true });
  });
});

/** 주어진 node 코드를 본문으로 갖는 실행 가능한 stub 을 만들고 경로를 돌려준다. */
async function stub(body: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "claude-stub-"));
  const file = path.join(dir, "fake-claude");
  await writeFile(file, `#!/usr/bin/env node\n${body}\n`);
  await chmod(file, 0o755);
  return file;
}

const base: { system: string; content: ContentBlock[]; jsonSchema: object; model: string; timeoutMs: number } = {
  system: "시스템",
  content: [{ type: "text", text: "키워드" }],
  jsonSchema: { $schema: "x", type: "object" },
  model: "claude-opus-4-8",
  timeoutMs: 5000,
};

describe("runClaudeCli", () => {
  it("stub 이 낸 structured_output 을 돌려준다", async () => {
    const command = await stub(
      `process.stdout.write(JSON.stringify({ type: "result", is_error: false, structured_output: { ok: 1 } }) + "\\n")`,
    );
    await expect(runClaudeCli({ ...base, command })).resolves.toEqual({ ok: 1 });
  });

  it("stdin 으로 stream-json 한 줄을 보낸다", async () => {
    const command = await stub(`
      let input = "";
      process.stdin.on("data", (c) => { input += c; });
      process.stdin.on("end", () => {
        process.stdout.write(JSON.stringify({ type: "result", is_error: false, structured_output: JSON.parse(input) }) + "\\n");
      });
    `);
    const out = await runClaudeCli({ ...base, command });
    expect(out).toEqual({ type: "user", message: { role: "user", content: base.content } });
  });

  it("한도에 걸린 토큰을 자식에게 물려주지 않는다", async () => {
    const command = await stub(`
      process.stdout.write(JSON.stringify({
        type: "result",
        is_error: false,
        structured_output: {
          token: process.env.ANTHROPIC_AUTH_TOKEN ?? null,
          key: process.env.ANTHROPIC_API_KEY ?? null,
          oauth: process.env.CLAUDE_CODE_OAUTH_TOKEN ?? null,
        },
      }) + "\\n");
    `);
    process.env.ANTHROPIC_AUTH_TOKEN = "leaked-token";
    process.env.ANTHROPIC_API_KEY = "leaked-key";
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "leaked-oauth";
    try {
      await expect(runClaudeCli({ ...base, command })).resolves.toEqual({ token: null, key: null, oauth: null });
    } finally {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    }
  });

  it("실행 파일이 없으면 CliNotFound 를 던진다", async () => {
    const promise = runClaudeCli({ ...base, command: "/nonexistent/fake-claude-binary" });
    await expect(promise).rejects.toThrow(CliNotFound);
    // 제네릭 TypeError("runClaudeCli is not a function")는 이 메시지를 만족할 수 없다 —
    // ENOENT 분기에서 실제로 준 메시지를 확인해 RED 를 vacuous pass 로부터 지킨다.
    await expect(promise).rejects.toThrow("claude 실행 파일 없음");
  });

  it("제한 시간을 넘기면 CliTimeout 을 던진다", async () => {
    const command = await stub(`setTimeout(() => {}, 60000)`);
    const promise = runClaudeCli({ ...base, command, timeoutMs: 200 });
    await expect(promise).rejects.toThrow(CliTimeout);
    // 제네릭 TypeError 는 이 메시지를 낼 수 없다 — 실제 타임아웃 분기의 메시지를 확인한다.
    await expect(promise).rejects.toThrow("제한 시간 초과");
  });

  it("여러 청크로 나뉘어 오는 긴 한글 stdout 을 깨지지 않게 이어붙인다", async () => {
    // 64KB 를 훌쩍 넘겨 stdout 'data' 이벤트가 여러 번 나뉘어 오게 만든다.
    // per-chunk toString() 이면 멀티바이트 한글 문자가 청크 경계에서 U+FFFD 로 깨진다.
    const koreanText = "리픽 카드뉴스 카피 테스트 문장입니다. 한글이 청크 경계에서 깨지면 안 됩니다. ".repeat(3000);
    const command = await stub(`
      const koreanText = "리픽 카드뉴스 카피 테스트 문장입니다. 한글이 청크 경계에서 깨지면 안 됩니다. ".repeat(3000);
      process.stdout.write(JSON.stringify({ type: "result", is_error: false, structured_output: { text: koreanText } }) + "\\n");
    `);
    const out = await runClaudeCli({ ...base, command });
    expect(out).toEqual({ text: koreanText });
    expect(JSON.stringify(out)).not.toContain("�");
  });

  it("자식이 stdin 을 읽지 않고 먼저 끝나도 EPIPE 로 프로세스를 죽이지 않는다", async () => {
    // 파이프 버퍼(64KB)를 훌쩍 넘는 stdin 을 자식이 전혀 읽지 않고 즉시 종료하면
    // stdin.end() 의 남은 쓰기가 EPIPE 로 실패한다. error 리스너가 없으면 Node 가
    // uncaughtException 으로 승격시켜 vitest 실행 자체가 죽는다 — 그것이 실패 신호다.
    const command = await stub(`process.exit(0);`);
    const bigContent: ContentBlock[] = [{ type: "text", text: "가".repeat(5_000_000) }];
    await expect(runClaudeCli({ ...base, content: bigContent, command })).rejects.toThrow(CliFailed);
  });
});

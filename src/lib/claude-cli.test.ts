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
  resolveClaudeCommand,
  runClaudeCli,
  CliFailed,
  NoStructuredOutput,
  CliNotFound,
  CliTimeout,
} from "@/lib/claude-cli";
import { friendlyGenerateError } from "@/lib/api-errors";

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

/**
 * Windows 에서는 `spawn("claude")` 가 실패한다 — npm 전역 bin 에 있는 것은 `claude`(bash
 * 스크립트)·`claude.cmd`·`claude.ps1` 뿐이고 Windows 가 실행할 수 있는 `.exe` 가 없다.
 * 그래서 실행 파일 위치를 `.env.local` 에서 받는다. macOS·Linux 는 그 값이 없으므로
 * 지금까지처럼 `claude` 를 그대로 쓴다 — **동작이 달라지지 않아야 한다.**
 */
describe("resolveClaudeCommand", () => {
  it("설정이 없으면 claude 를 쓴다 — macOS·Linux 의 지금 동작", () => {
    expect(resolveClaudeCommand(undefined)).toBe("claude");
  });

  it("경로가 설정돼 있으면 그것을 쓴다", () => {
    expect(resolveClaudeCommand("C:/n/claude.exe")).toBe("C:/n/claude.exe");
  });

  it("빈 값·공백만 있는 값은 없는 것으로 친다 — 주석 처리하다 남은 빈 칸에 걸리지 않게", () => {
    expect(resolveClaudeCommand("")).toBe("claude");
    expect(resolveClaudeCommand("   ")).toBe("claude");
  });

  it("경로 앞뒤 공백은 떼어 낸다 — 붙여 넣다 딸려 온 공백으로 실행이 깨지지 않게", () => {
    expect(resolveClaudeCommand("  /usr/local/bin/claude  ")).toBe("/usr/local/bin/claude");
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

/**
 * stub 을 쓰는 테스트는 **Windows 에서 건너뛴다.**
 *
 * stub 은 첫 줄의 셰방(`#!/usr/bin/env node`)으로 실행되는데, 그 줄을 읽어 주는 것은 POSIX
 * 커널이다. Windows 는 확장자로만 실행 파일을 판단하므로 확장자 없는 이 파일을 열지 못하고
 * `spawn` 이 ENOENT 로 죽는다 — 그러면 무엇을 검사하든 `CliNotFound` 만 돌아온다.
 *
 * `.cmd` 래퍼로 바꿔도 안 된다(측정함, 2026-08-05): Node 18.20+ 는 `shell: true` 없는
 * `.cmd` spawn 을 EINVAL 로 거부한다. 그렇다고 제품 코드에 `shell: true` 를 넣을 수는 없다 —
 * `--system-prompt` 로 사용자 문구가 그대로 들어가므로 셸 주입 통로가 된다.
 *
 * 그래서 이 동작의 커버리지는 macOS·Linux 가 진다. 나머지 순수 함수 테스트는 어디서든 돈다.
 */
const itWithStub = it.skipIf(process.platform === "win32");

const base: { system: string; content: ContentBlock[]; jsonSchema: object; model: string; timeoutMs: number } = {
  system: "시스템",
  content: [{ type: "text", text: "키워드" }],
  jsonSchema: { $schema: "x", type: "object" },
  model: "claude-opus-4-8",
  timeoutMs: 5000,
};

describe("runClaudeCli", () => {
  itWithStub("stub 이 낸 structured_output 을 돌려준다", async () => {
    const command = await stub(
      `process.stdout.write(JSON.stringify({ type: "result", is_error: false, structured_output: { ok: 1 } }) + "\\n")`,
    );
    await expect(runClaudeCli({ ...base, command })).resolves.toEqual({ ok: 1 });
  });

  itWithStub("stdin 으로 stream-json 한 줄을 보낸다", async () => {
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

  itWithStub("한도에 걸린 토큰을 자식에게 물려주지 않는다", async () => {
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

  itWithStub("제한 시간을 넘기면 CliTimeout 을 던진다", async () => {
    const command = await stub(`setTimeout(() => {}, 60000)`);
    const promise = runClaudeCli({ ...base, command, timeoutMs: 200 });
    await expect(promise).rejects.toThrow(CliTimeout);
    // 제네릭 TypeError 는 이 메시지를 낼 수 없다 — 실제 타임아웃 분기의 메시지를 확인한다.
    await expect(promise).rejects.toThrow("제한 시간 초과");
  });

  itWithStub("여러 청크로 나뉘어 오는 긴 한글 stdout 을 깨지지 않게 이어붙인다", async () => {
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

  itWithStub("자식이 stdin 을 읽지 않고 먼저 끝나도 EPIPE 로 프로세스를 죽이지 않는다", async () => {
    // 파이프 버퍼(64KB)를 훌쩍 넘는 stdin 을 자식이 전혀 읽지 않고 즉시 종료하면
    // stdin.end() 의 남은 쓰기가 EPIPE 로 실패한다. error 리스너가 없으면 Node 가
    // uncaughtException 으로 승격시켜 vitest 실행 자체가 죽는다 — 그것이 실패 신호다.
    const command = await stub(`process.exit(0);`);
    const bigContent: ContentBlock[] = [{ type: "text", text: "가".repeat(5_000_000) }];
    await expect(runClaudeCli({ ...base, content: bigContent, command })).rejects.toThrow(CliFailed);
  });

  itWithStub("stderr 에 잡음이 섞여도 is_error 의 사용량 한도 사유가 살아남는다", async () => {
    // CLI 가 usage limit 로 is_error 결과를 내면서 동시에 stderr 에 (deprecation
    // warning 같은) 잡음도 쓰는 경우. stderr 를 사유로 통째로 대체하면 그 사유가
    // 사라져 사용량 한도 판정이 깨진다.
    const command = await stub(`
      process.stderr.write("(node) update available: run npm i -g @anthropic-ai/claude-code\\n");
      process.stdout.write(JSON.stringify({
        type: "result",
        is_error: true,
        result: "Claude AI usage limit reached. Try again later.",
      }) + "\\n");
    `);

    const error: unknown = await runClaudeCli({ ...base, command }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliFailed);
    expect(friendlyGenerateError(error)).toContain("사용량 한도");
  });
});

/** 값이 문자열 배열인지 좁힌다 — 타입 단언 없이 argv 를 다루기 위함. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

describe("runClaudeCli 격리 인자", () => {
  itWithStub("격리 플래그와 $schema 를 뗀 스키마를 그대로 넘긴다", async () => {
    const command = await stub(
      `process.stdout.write(JSON.stringify({ type: "result", is_error: false, structured_output: process.argv.slice(2) }) + "\\n")`,
    );

    const out = await runClaudeCli({ ...base, command });
    if (!isStringArray(out)) throw new Error("argv 가 문자열 배열이 아닙니다");

    expect(out).toContain("--safe-mode");
    expect(out).toContain("--no-session-persistence");

    const toolsIndex = out.indexOf("--tools");
    expect(out[toolsIndex + 1]).toBe("");

    const modelIndex = out.indexOf("--model");
    expect(out[modelIndex + 1]).toBe(base.model);

    const schemaIndex = out.indexOf("--json-schema");
    const schema: unknown = JSON.parse(out[schemaIndex + 1]);
    expect(schema).not.toHaveProperty("$schema");
  });
});

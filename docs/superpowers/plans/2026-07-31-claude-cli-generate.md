# 카피 생성 경로를 `claude -p` 로 교체 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/api/generate` 가 Anthropic SDK 대신 로컬 `claude -p` 서브프로세스로 카피를 생성하게 하고, SDK 경로를 남기지 않는다.

**Architecture:** 새 모듈 `src/lib/claude-cli.ts` 가 CLI 호출을 전담한다 — stream-json 한 줄을 stdin 으로 보내고, stdout JSONL 에서 `type === "result"` 이벤트의 `structured_output` 을 꺼낸다. `route.ts` 는 프롬프트 조립과 zod 재검증만 맡는다. 프롬프트·스키마·응답 계약은 그대로다.

**Tech Stack:** Next.js 16 (App Router), TypeScript 5.7, zod 3.25 (`zod/v4` API), vitest 3, `node:child_process`

설계 근거: `docs/superpowers/specs/2026-07-31-claude-cli-generate-design.md`

## Global Constraints

- 모델은 `claude-opus-4-8` 로 고정한다. 이번 작업에서 모델을 바꾸지 않는다.
- 자식 프로세스 env 에서 `ANTHROPIC_AUTH_TOKEN` 과 `ANTHROPIC_API_KEY` 를 반드시 제거한다. 남기면 CLI 가 한도에 걸린 토큰을 다시 쓴다.
- `--json-schema` 로 넘기기 전에 `$schema` 키를 제거한다. 남기면 CLI 가 `no schema with key or ref "https://json-schema.org/draft/2020-12/schema"` 로 즉시 실패한다.
- CLI 는 영어로 실패 사유를 돌려준다. 사용자에게는 절대 원문·원시 JSON 을 그대로 내보내지 않는다.
- `any` 타입, `@ts-ignore`, `@ts-expect-error`, `eslint-disable` 주석 금지. 좁히기가 필요하면 `unknown` + 타입 가드를 쓴다.
- `console.log` 를 남기지 않는다.
- 객체를 직접 수정하지 않는다. 복사본을 만들어 바꾼다.
- 모든 태스크는 RED(실패하는 테스트) → GREEN(최소 구현) → 커밋 순서다. 테스트가 처음부터 통과하면 그 테스트는 무의미하므로 다시 쓴다.
- 커밋 메시지는 `feat:` / `fix:` / `refactor:` / `test:` / `chore:` / `docs:` 접두사 + 한국어, 제목 50자 이내.
- 파일은 400줄을 넘지 않게 유지한다.

**테스트 실행 명령:** `npx vitest run <파일경로>` (설정: `vitest.config.ts`, `include: ["src/**/*.test.ts"]`, 별칭 `@` → `./src`)

---

### Task 1: CLI 입력 조립 순수 함수

`claude-cli.ts` 의 부작용 없는 부분부터 만든다. 이 세 함수는 spawn 없이 전부 검증 가능하다.

**Files:**
- Create: `src/lib/claude-cli.ts`
- Test: `src/lib/claude-cli.test.ts`

**Interfaces:**
- Consumes: `ContentBlock` (기존 `src/lib/prompt.ts` 가 export)
- Produces:
  - `stripJsonSchemaMeta(schema: object): Record<string, unknown>`
  - `buildStreamJsonLine(content: ContentBlock[]): string`
  - `childEnv(parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/claude-cli.test.ts` 를 만들고 아래를 그대로 넣는다.

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/claude-cli.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/claude-cli"` (파일이 아직 없다)

- [ ] **Step 3: 최소 구현**

`src/lib/claude-cli.ts` 를 만들고 아래를 넣는다.

```ts
import type { ContentBlock } from "@/lib/prompt";

/**
 * zod 가 붙이는 `$schema` 키를 뗀다.
 *
 * CLI 의 `--json-schema` 검증기는 draft 2020-12 메타스키마를 모른다. 그대로 넘기면
 * `no schema with key or ref "https://json-schema.org/draft/2020-12/schema"` 로
 * 모델을 부르기도 전에 실패한다.
 */
export function stripJsonSchemaMeta(schema: object): Record<string, unknown> {
  const copy: Record<string, unknown> = Object.fromEntries(Object.entries(schema));
  delete copy.$schema;
  return copy;
}

/** `--input-format stream-json` 이 stdin 으로 받는 user 메시지 한 줄. */
export function buildStreamJsonLine(content: ContentBlock[]): string {
  return `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`;
}

/**
 * 자식 프로세스에 넘길 env.
 *
 * Next 서버는 `.env.local` 을 읽어 자기 `process.env` 에 넣는다. 그대로 물려주면
 * CLI 가 사용량 한도에 걸린 그 토큰을 다시 써서 이번 전환이 무의미해진다.
 */
export function childEnv(parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...parent };
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.ANTHROPIC_API_KEY;
  return env;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/claude-cli.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/claude-cli.ts src/lib/claude-cli.test.ts
git commit -m "feat: claude CLI 입력 조립 순수 함수 추가"
```

---

### Task 2: 결과 이벤트 파싱과 실패 타입

CLI stdout 은 JSONL 스트림이다. 마지막 `type === "result"` 이벤트만 의미가 있다.
실패 판정에 `subtype` 을 쓰지 않는다 — 실패해도 `"success"` 로 오는 것을 실측으로 확인했다.

**Files:**
- Modify: `src/lib/claude-cli.ts`
- Test: `src/lib/claude-cli.test.ts`

**Interfaces:**
- Consumes: Task 1 의 모듈
- Produces:
  - `class CliNotFound extends Error`
  - `class CliFailed extends Error`
  - `class NoStructuredOutput extends Error`
  - `class CliTimeout extends Error`
  - `readStructuredOutput(stdout: string): unknown`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/claude-cli.test.ts` 끝에 아래를 덧붙인다. `import` 줄은 파일 맨 위의 기존 import 에 합친다.

```ts
import { readStructuredOutput, CliFailed, NoStructuredOutput } from "@/lib/claude-cli";

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
  });

  it("structured_output 이 없으면 NoStructuredOutput 을 던진다", () => {
    expect(() => readStructuredOutput(resultLine({ is_error: false }))).toThrow(NoStructuredOutput);
  });

  it("result 이벤트가 아예 없으면 CliFailed 를 던진다", () => {
    expect(() => readStructuredOutput(noise)).toThrow(CliFailed);
  });

  it("깨진 JSON 줄은 건너뛰고 계속 읽는다", () => {
    const stdout = `깨진 줄\n${resultLine({ is_error: false, structured_output: { ok: true } })}`;
    expect(readStructuredOutput(stdout)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/claude-cli.test.ts`
Expected: FAIL — `readStructuredOutput is not a function` (아직 export 되지 않았다)

- [ ] **Step 3: 최소 구현**

`src/lib/claude-cli.ts` 에 아래를 덧붙인다.

```ts
/** `claude` 실행 파일을 찾지 못했다. */
export class CliNotFound extends Error {}
/** CLI 가 실패를 보고했거나 결과 이벤트를 내지 않았다. */
export class CliFailed extends Error {}
/** CLI 는 성공했지만 스키마에 맞는 출력이 없다. */
export class NoStructuredOutput extends Error {}
/** 제한 시간 안에 끝나지 않아 강제 종료했다. */
export class CliTimeout extends Error {}

type ResultEvent = { is_error?: boolean; result?: string; structured_output?: unknown };

function isResultEvent(value: unknown): value is ResultEvent & { type: "result" } {
  return typeof value === "object" && value !== null && "type" in value && value.type === "result";
}

/** stdout(JSONL)에서 result 이벤트를 찾아 structured_output 을 꺼낸다. */
export function readStructuredOutput(stdout: string): unknown {
  let found: ResultEvent | null = null;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event: unknown = JSON.parse(line);
      if (isResultEvent(event)) found = event;
    } catch {
      // 스트림 중간의 깨진 줄은 무시한다 — 뒤에 온전한 result 가 올 수 있다.
    }
  }

  if (!found) throw new CliFailed("CLI 가 결과를 내지 않았습니다");
  if (found.is_error) throw new CliFailed(found.result ?? "CLI 실행 실패");
  if (found.structured_output === undefined) throw new NoStructuredOutput("structured_output 없음");
  return found.structured_output;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/claude-cli.test.ts`
Expected: PASS — 13 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/claude-cli.ts src/lib/claude-cli.test.ts
git commit -m "feat: CLI 결과 이벤트 파싱과 실패 타입 추가"
```

---

### Task 3: spawn 래퍼

`runClaudeCli` 는 실제로 프로세스를 띄운다. 테스트는 **진짜 `claude` 를 부르지 않는다** — 대신 정해진 JSONL 을 찍고 끝나는 stub 스크립트를 `command` 로 주입한다. 할당량도 네트워크도 쓰지 않으면서 spawn·타임아웃·env 스크러빙을 전부 검증한다.

**Files:**
- Modify: `src/lib/claude-cli.ts`
- Test: `src/lib/claude-cli.test.ts`

**Interfaces:**
- Consumes: Task 1·2 의 `stripJsonSchemaMeta` / `buildStreamJsonLine` / `childEnv` / `readStructuredOutput` / 실패 타입
- Produces:
  ```ts
  runClaudeCli(args: {
    system: string;
    content: ContentBlock[];
    jsonSchema: object;
    model: string;
    timeoutMs: number;
    command?: string;   // 테스트용 주입. 기본값 "claude"
  }): Promise<unknown>
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/claude-cli.test.ts` 끝에 아래를 덧붙인다. `import` 줄은 파일 맨 위의 기존 import 에 합친다.

```ts
import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runClaudeCli, CliNotFound, CliTimeout } from "@/lib/claude-cli";

/** 주어진 node 코드를 본문으로 갖는 실행 가능한 stub 을 만들고 경로를 돌려준다. */
async function stub(body: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "claude-stub-"));
  const file = path.join(dir, "fake-claude");
  await writeFile(file, `#!/usr/bin/env node\n${body}\n`);
  await chmod(file, 0o755);
  return file;
}

const base = {
  system: "시스템",
  content: [{ type: "text" as const, text: "키워드" }],
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
        },
      }) + "\\n");
    `);
    process.env.ANTHROPIC_AUTH_TOKEN = "leaked-token";
    process.env.ANTHROPIC_API_KEY = "leaked-key";
    try {
      await expect(runClaudeCli({ ...base, command })).resolves.toEqual({ token: null, key: null });
    } finally {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("실행 파일이 없으면 CliNotFound 를 던진다", async () => {
    await expect(runClaudeCli({ ...base, command: "/nonexistent/fake-claude-binary" })).rejects.toThrow(CliNotFound);
  });

  it("제한 시간을 넘기면 CliTimeout 을 던진다", async () => {
    const command = await stub(`setTimeout(() => {}, 60000)`);
    await expect(runClaudeCli({ ...base, command, timeoutMs: 200 })).rejects.toThrow(CliTimeout);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/claude-cli.test.ts`
Expected: FAIL — `runClaudeCli is not a function`

- [ ] **Step 3: 최소 구현**

`src/lib/claude-cli.ts` 상단에 `import { spawn } from "node:child_process";` 를 추가하고, 파일 끝에 아래를 넣는다.

```ts
/**
 * `claude -p` 를 한 번 돌려 스키마에 맞는 JSON 을 받는다.
 *
 * `--safe-mode` 로 이 프로젝트의 CLAUDE.md·훅·스킬·MCP 가 카피 생성에 새어들지 않게 하고,
 * `--tools ""` 로 도구 없는 순수 생성만 시킨다. `--bare` 는 쓰지 않는다 — 훅을 걷어내는
 * 목적에는 맞지만 인증이 ANTHROPIC_API_KEY 로 강제되어 로컬 OAuth 자격증명을 읽지 않는다.
 */
export function runClaudeCli(args: {
  system: string;
  content: ContentBlock[];
  jsonSchema: object;
  model: string;
  timeoutMs: number;
  command?: string;
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      args.command ?? "claude",
      [
        "-p",
        "--input-format", "stream-json",
        "--output-format", "stream-json",
        "--verbose",
        "--model", args.model,
        "--tools", "",
        "--safe-mode",
        "--no-session-persistence",
        "--system-prompt", args.system,
        "--json-schema", JSON.stringify(stripJsonSchemaMeta(args.jsonSchema)),
      ],
      { env: childEnv(process.env) },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new CliTimeout("제한 시간 초과")));
    }, args.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on("error", (e: NodeJS.ErrnoException) => {
      finish(() => reject(e.code === "ENOENT" ? new CliNotFound("claude 실행 파일 없음") : new CliFailed(e.message)));
    });

    child.on("close", () => {
      finish(() => {
        try {
          resolve(readStructuredOutput(stdout));
        } catch (e) {
          // stdout 에 result 가 없으면 사유는 stderr 에만 있다 (예: --json-schema 거부).
          reject(e instanceof CliFailed && stderr.trim() ? new CliFailed(stderr.trim()) : e);
        }
      });
    });

    child.stdin.end(buildStreamJsonLine(args.content));
  });
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/claude-cli.test.ts`
Expected: PASS — 18 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/claude-cli.ts src/lib/claude-cli.test.ts
git commit -m "feat: claude -p spawn 래퍼와 stub 기반 테스트 추가"
```

---

### Task 4: 에러 문구를 CLI 실패 유형에 맞게 다시 씀

`api-errors.ts` 는 지금 HTTP status 로 분기한다. CLI 에는 status 가 없다. 실패 타입으로 바꾼다.
CLI 원문(영어)과 stderr 는 사용자에게 노출하지 않는다 — 한도 판정에만 쓰고 문구는 고정한다.

**Files:**
- Modify: `src/lib/api-errors.ts` (전면 교체)
- Modify: `src/lib/api-errors.test.ts` (전면 교체)

**Interfaces:**
- Consumes: Task 2 의 `CliNotFound` / `CliFailed` / `CliTimeout` / `NoStructuredOutput`
- Produces: `friendlyGenerateError(e: unknown): string` — `mode` 인자가 사라진다

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/api-errors.test.ts` 전체를 아래로 교체한다.

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/api-errors.test.ts`
Expected: FAIL — 기존 구현은 `CliNotFound` 를 모르고 `status` 로만 분기하므로 대부분의 케이스가 원본 메시지를 그대로 돌려준다

- [ ] **Step 3: 최소 구현**

`src/lib/api-errors.ts` 전체를 아래로 교체한다.

```ts
/**
 * `claude -p` 호출 실패를 사용자에게 보여 줄 한국어 문장으로 바꾼다.
 *
 * CLI 는 실패 사유를 영어 산문으로 준다. 그대로 흘리면 사용자가 읽을 수 없고,
 * stderr 에는 JSON 이 섞여 나오기도 한다. 한도 판정에만 원문을 쓰고 문구는 고정한다.
 */
import { CliNotFound, CliFailed, CliTimeout, NoStructuredOutput } from "@/lib/claude-cli";

export const SCHEMA_MISMATCH = "카피 생성 결과가 스키마와 맞지 않습니다. 다시 시도해주세요.";

/** CLI 가 한도를 알릴 때 쓰는 표현들. */
function isUsageLimit(message: string): boolean {
  return /usage limit|rate.?limit/i.test(message);
}

export function friendlyGenerateError(e: unknown): string {
  if (e instanceof CliNotFound) {
    return "Claude Code CLI를 찾을 수 없어요. `claude` 설치를 확인해 주세요.";
  }
  if (e instanceof CliTimeout) {
    return "생성이 너무 오래 걸려 중단했어요. 다시 시도해 주세요.";
  }
  if (e instanceof NoStructuredOutput) {
    return SCHEMA_MISMATCH;
  }
  if (e instanceof CliFailed) {
    return isUsageLimit(e.message)
      ? "Claude 사용량 한도에 걸렸어요. 같은 계정으로 Claude Code 같은 다른 작업이 돌고 있다면 끝난 뒤 다시 시도해 주세요."
      : "카피 생성에 실패했어요. 잠시 후 다시 시도해 주세요.";
  }
  // 여기까지 온 오류는 우리 코드가 던진 것이라 메시지가 이미 한국어다.
  if (e instanceof Error) return e.message;
  return "생성 중 오류가 났어요. 다시 시도해 주세요.";
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/api-errors.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/api-errors.ts src/lib/api-errors.test.ts
git commit -m "refactor: 에러 문구를 CLI 실패 유형 기준으로 재작성"
```

---

### Task 5: 라우트 교체와 SDK 흔적 제거

여기서 SDK 경로가 사라진다. `parseBody` 의 입력 계약은 바뀌지 않으므로 `route.test.ts` 는 건드리지 않는다 — 이 태스크의 RED 는 "기존 테스트가 계속 통과하는가"가 아니라 타입 검사와 전체 테스트로 확인한다.

**Files:**
- Modify: `src/app/api/generate/route.ts`
- Delete: `src/lib/auth.ts`, `src/lib/auth.test.ts`
- Modify: `package.json` (`@anthropic-ai/sdk` 제거)
- Modify: `.env.local.example` (`ANTHROPIC_AUTH_TOKEN` 항목 제거)

**Interfaces:**
- Consumes: `runClaudeCli`, `NoStructuredOutput` (Task 2·3), `friendlyGenerateError`, `SCHEMA_MISMATCH` (Task 4)
- Produces: 응답 계약 변화 없음 — 성공 `{ spec }`, 실패 `{ error }`

- [ ] **Step 1: auth 모듈 삭제**

```bash
git rm src/lib/auth.ts src/lib/auth.test.ts
```

- [ ] **Step 2: 타입 검사로 깨진 곳 확인 (RED)**

Run: `npx tsc --noEmit > /tmp/tsc-red.log 2>&1; cat /tmp/tsc-red.log`
Expected: FAIL — `src/app/api/generate/route.ts` 가 `@/lib/auth` 를 찾지 못한다

- [ ] **Step 3: 라우트 구현**

`src/app/api/generate/route.ts` 의 import 블록(1~7행)과 `POST` 의 `mode` 관련 부분·`try` 블록을 아래로 교체한다. `BodySchema` 와 `parseBody` 는 그대로 둔다.

```ts
import { z } from "zod/v4";
import { InfographicSpec, CardnewsSpec } from "@/lib/schema";
import { readVault, buildSystemPrompt, buildUserContent } from "@/lib/prompt";
import { runClaudeCli, NoStructuredOutput } from "@/lib/claude-cli";
import { friendlyGenerateError, SCHEMA_MISMATCH } from "@/lib/api-errors";

const MODEL = "claude-opus-4-8";
/** 실측 24초의 5배. 넘어가면 매달려 있느니 끊고 사용자에게 알린다. */
const TIMEOUT_MS = 120_000;
```

`POST` 본문은 이렇게 된다 (`parseBody` 로 body 를 얻은 뒤부터).

```ts
  const spec = body.type === "informationsend" ? InfographicSpec : CardnewsSpec;

  try {
    const vault = await readVault();
    const raw = await runClaudeCli({
      system: buildSystemPrompt(body.type, vault, body.photos.length > 0),
      content: buildUserContent(body.keyword, body.photos),
      jsonSchema: z.toJSONSchema(spec),
      model: MODEL,
      timeoutMs: TIMEOUT_MS,
    });

    // JSON Schema 는 모양만 강제한다. `.refine()`(첫 카드 hook / 마지막 cta)은
    // z.toJSONSchema 에서 탈락하므로 여기서 진짜 스키마로 다시 검증한다.
    const parsed = spec.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: SCHEMA_MISMATCH }, { status: 502 });
    }
    return Response.json({ spec: parsed.data });
  } catch (e) {
    if (e instanceof NoStructuredOutput) {
      return Response.json({ error: SCHEMA_MISMATCH }, { status: 502 });
    }
    return Response.json({ error: friendlyGenerateError(e) }, { status: 500 });
  }
```

`mode === "none"` 가드 블록과 `resolveAuthMode` / `oauthToken` / `Anthropic` / `zodOutputFormat` / `ContentSpec` import 는 전부 지운다.

- [ ] **Step 4: 타입 검사 통과 확인 (GREEN)**

Run: `npx tsc --noEmit > /tmp/tsc-green.log 2>&1; cat /tmp/tsc-green.log`
Expected: 출력 없음

- [ ] **Step 5: SDK 의존성 제거**

```bash
npm uninstall @anthropic-ai/sdk
```

`.env.local.example` 에서 `ANTHROPIC_AUTH_TOKEN` 줄과 그 설명을 지운다. 남은 내용이 없으면 파일 자체를 지운다.

- [ ] **Step 6: 전체 테스트**

Run: `npx vitest run > /tmp/vitest.log 2>&1; tail -20 /tmp/vitest.log`
Expected: 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: 생성 경로를 claude -p 로 교체하고 SDK 제거"
```

---

### Task 6: 사람 확인

이 프로젝트는 브라우저가 로컬 dev 서버에 닿지 않아 UI 검증을 자동화할 수 없다. 실제 생성은 사람이 확인한다.

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 검증 실행**

```bash
npx vitest run > /tmp/verify-test.log 2>&1; tail -20 /tmp/verify-test.log
npx tsc --noEmit > /tmp/verify-tsc.log 2>&1; cat /tmp/verify-tsc.log
```
Expected: 테스트 전부 PASS, 타입 오류 없음

- [ ] **Step 2: `.env.local` 정리 여부를 사용자에게 확인**

`.env.local` 은 git 에 없다. `ANTHROPIC_AUTH_TOKEN` 을 지울지 사용자에게 묻고, 지우기로 하면 그 줄만 제거한다. **남겨두어도 `childEnv` 가 자식에게 넘기지 않으므로 동작에는 영향이 없다.**

- [ ] **Step 3: dev 서버에서 실제 생성 (사진 없음)**

```bash
npm run dev > /tmp/dev.log 2>&1 &
```

사용자에게 `http://localhost:3500/cardnews` 에서 키워드만 넣고 생성해 달라고 요청한다.
확인 항목: 카드 5~6장이 나오고, 첫 카드가 hook, 마지막이 cta 인가.

- [ ] **Step 4: dev 서버에서 실제 생성 (사진 첨부)**

같은 화면에서 사진을 2장 이상 올려 생성해 달라고 요청한다.
확인 항목: 카피가 **사진에 실제로 보이는 것**을 근거로 쓰였는가 (stream-json 이미지 전달이 살아 있다는 증거).

- [ ] **Step 5: 서버 로그 확인**

```bash
grep "POST /api/generate" /tmp/dev.log
```
Expected: `200` (기존의 `500` 이 아님)

- [ ] **Step 6: 계획 문서의 체크박스를 채우고 커밋**

```bash
git add docs/superpowers/plans/2026-07-31-claude-cli-generate.md
git commit -m "docs: claude -p 전환 계획 완료 표시"
```

---

## 완료 기준

- `npx vitest run` 전부 통과
- `npx tsc --noEmit` 오류 없음
- `@anthropic-ai/sdk` 가 `package.json` 에 없음
- `src/lib/auth.ts` 가 없음
- 사진 없이 1회, 사진 첨부로 1회 실제 생성 성공을 사람이 확인

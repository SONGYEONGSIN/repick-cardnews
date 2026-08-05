import { spawn } from "node:child_process";
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
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  return env;
}

/**
 * 부를 `claude` 실행 파일. 기본은 PATH 위의 `claude` 다.
 *
 * Windows 에서는 그게 안 된다. npm 전역 bin(`%APPDATA%\npm`)에 있는 것은 `claude`(bash
 * 스크립트)·`claude.cmd`·`claude.ps1` 뿐이고 Windows 가 실행 파일로 인정하는 `.exe` 가 없어
 * `spawn` 이 ENOENT 로 죽는다. `.cmd` 를 직접 부르는 것도 막혀 있다 — Node 18.20+ 는
 * `shell: true` 없는 `.cmd` spawn 을 EINVAL 로 거부한다. 그렇다고 `shell: true` 를 켤 수는
 * 없다: `--system-prompt`·`--json-schema` 가 인자로 들어가므로 셸 인용 규칙을 타게 된다.
 *
 * 그래서 실행 파일 경로를 `.env.local` 에서 받는다(기계마다 다르고 커밋 대상이 아니다).
 * 실측한 위치는 이랬다 — Windows 11, claude-code 2.1.222, 2026-08-05:
 *   %APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe
 *
 * macOS·Linux 는 이 값을 두지 않으므로 지금까지와 똑같이 `claude` 를 쓴다.
 */
export function resolveClaudeCommand(configured = process.env.CLAUDE_CLI_PATH): string {
  return configured?.trim() || "claude";
}

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
      args.command ?? resolveClaudeCommand(),
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

    // 청크 단위로 Buffer.toString() 하면 멀티바이트 문자(한글)가 청크 경계에서
    // U+FFFD 로 깨질 수 있다. setEncoding 을 걸면 Node 의 StringDecoder 가 청크
    // 경계에 걸친 바이트를 다음 청크까지 들고 있다가 문자 단위로 디코딩한다.
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });

    child.on("error", (e: NodeJS.ErrnoException) => {
      finish(() => reject(e.code === "ENOENT" ? new CliNotFound("claude 실행 파일 없음") : new CliFailed(e.message)));
    });

    child.on("close", (code, signal) => {
      finish(() => {
        try {
          resolve(readStructuredOutput(stdout));
        } catch (e) {
          // NoStructuredOutput 은 그대로 전파한다 — CliFailed 가 아니라 별도 처리 경로가 있다.
          if (!(e instanceof CliFailed)) {
            reject(e);
            return;
          }
          // CliFailed 의 message 는 두 갈래에서 온다 — is_error 의 실제 사유(예: usage
          // limit), 또는 결과 이벤트가 아예 없어 사유가 stderr 에만 있는 경우. 어느
          // 쪽인지 여기서 구분하지 않고 둘 다 이어붙인다. stderr 로 통째로 대체하면
          // is_error 사유가 잡음(예: deprecation 경고) 뒤에 묻혀 사라진다.
          const detail = [e.message, stderr.trim(), `exit=${code ?? signal}`].filter(Boolean).join(" | ");
          reject(new CliFailed(detail));
        }
      });
    });

    // 자식이 stdin 을 다 읽지 않고 먼저 끝나면(타임아웃 SIGKILL, --json-schema 거부
    // 등) 남은 쓰기가 EPIPE 로 실패한다. 리스너가 없으면 Node 가 이를
    // uncaughtException 으로 승격시킨다. 실제 실패 사유는 이미 close/error 경로에서
    // 보고되므로 여기서는 그냥 삼킨다.
    child.stdin.on("error", () => {});
    child.stdin.end(buildStreamJsonLine(args.content));
  });
}

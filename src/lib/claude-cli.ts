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

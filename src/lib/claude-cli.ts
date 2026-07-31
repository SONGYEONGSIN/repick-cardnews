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

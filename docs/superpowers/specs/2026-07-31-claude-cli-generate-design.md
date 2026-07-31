# 카피 생성 경로를 Anthropic SDK 에서 `claude -p` 로 교체

- 날짜: 2026-07-31
- 대상: `src/app/api/generate/route.ts` 와 그 의존 모듈
- 성격: 완전 교체 (SDK 경로를 남기지 않는다)

## 배경

`/api/generate` 는 `@anthropic-ai/sdk` 로 Anthropic API 를 직접 호출하고, 인증은
`.env.local` 의 `ANTHROPIC_AUTH_TOKEN`(`claude setup-token` 으로 발급한 OAuth 토큰)을 쓴다.
이 토큰이 사용량 한도에 걸려 생성이 전면 실패했다.

실측으로 확인한 사실:

| 경로 | Opus | Sonnet | Haiku |
|---|---|---|---|
| `.env.local` 토큰 직접 호출 | 429 | 429 | 200 |
| 로컬 `claude` CLI 자격증명 | 정상 | 정상 | 정상 |

같은 계정인데도 갈린다. 즉 그 토큰에 별도 한도가 물려 있고, 로컬 Claude Code 자격증명
경로는 살아 있다. 이 앱은 이미 로컬 전용이므로(`/api/save` 가 `process.cwd()` 에 PNG 를
쓰고 원장도 로컬에 append) "로컬에 `claude` CLI 가 필요하다"는 새로 생기는 제약이 아니다.

## 목표

생성 경로를 `claude -p` 서브프로세스 호출로 바꾼다. 산출물(`ContentSpec`)의 계약,
프롬프트 내용, 사진 처리 방식은 그대로 유지한다. SDK 경로는 남기지 않는다
(`rules/donts.md` 의 폴백 로직 금지).

## 사전 검증 (설계 전 실측)

이 설계는 다음을 실제로 돌려 확인한 위에 세웠다.

1. `--input-format stream-json` 은 `{"type":"image","source":{"type":"base64",...}}` 블록을
   그대로 받는다 → `buildUserContent` 의 출력 구조를 바꿀 필요가 없다.
2. `--json-schema` 는 검증된 객체를 `structured_output` 필드로 돌려준다 →
   `messages.parse` + `output_config` 를 대체한다.
3. 실제 `knowledge/` 볼트 + 실제 `CardnewsSpec` 로 "에어컨 전기세" 카드뉴스를 생성했고,
   결과가 `CardnewsSpec.safeParse` 를 통과했다(`.refine()` 의 hook·cta 규칙 포함).
4. 소요 시간 24 초. 자명한 프롬프트로 잰 CLI 기동 오버헤드는 1~2 초이므로 나머지는
   모델이 실제로 카피를 쓰는 시간이다.
5. `--model claude-opus-4-8` 은 CLI 에서 그대로 유효하다.

## 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 전환 성격 | 완전 교체 | 되돌릴 계획이 없고, 두 경로 공존은 폴백 금지 규칙에 걸린다 |
| 모델 | `claude-opus-4-8` 유지 | 이번 변경은 호출 통로 교체지 모델 교체가 아니다. 같이 바꾸면 카피 품질 변화의 원인을 구분할 수 없고, 원장의 기존 기록과도 끊긴다 |
| 호출 방식 | stream-json 입출력 | 사진을 지금과 동일한 content block 으로 넘길 수 있는 유일한 방식 |
| 통합 테스트 | 진짜 `claude` 는 부르지 않음 | 실제 CLI 를 도는 테스트는 할당량을 쓰고 네트워크에 의존해 불안정하다. 대신 정해진 JSONL 을 찍고 끝나는 stub 을 `command` 로 주입해 spawn·타임아웃·env 스크러빙을 오프라인으로 검증하고, 실제 생성은 구현 후 앱에서 사람이 확인한다 |

### 기각한 대안

- **사진을 임시 파일로 쓰고 Read 도구로 읽히기**: 도구를 켜야 해서 `--tools ""` 를 포기하게
  되고, 모델이 파일을 읽을지가 비결정적이며, 임시 파일 수명 관리가 새로 생긴다.
- **텍스트 프롬프트 + `--output-format json`**: 파싱은 가장 단순하지만 사진 경로에서 위와
  같은 문제에 부딪힌다.

## 구조

### 새 모듈 `src/lib/claude-cli.ts`

책임은 하나 — 프롬프트 하나를 CLI 로 돌려 검증된 JSON 을 돌려준다.

```ts
runClaudeCli(args: {
  system: string;
  content: ContentBlock[];
  jsonSchema: Record<string, unknown>;
  model: string;
  timeoutMs: number;
}): Promise<unknown>
```

- `node:child_process.spawn` + 인자 배열 (셸을 거치지 않으므로 인젝션 경로가 없다)
- stdin 에 stream-json 한 줄을 쓰고 닫는다 — stdin 을 닫지 않으면 CLI 가 입력을 기다린다
- stdout 을 JSONL 로 읽어 `type === "result"` 이벤트만 취하고 `structured_output` 을 반환
- 실패는 타입 있는 에러로 던진다: `CliNotFound` / `CliFailed` / `NoStructuredOutput` / `CliTimeout`

`route.ts` 는 조립만 한다:
`parseBody → readVault → buildSystemPrompt → buildUserContent → toJsonSchema → runClaudeCli → zod safeParse → 응답`

### 변경되지 않는 것

`src/lib/prompt.ts`(`readVault` / `buildSystemPrompt` / `buildUserContent`),
`src/lib/schema.ts`, 클라이언트의 `requestSpec`. 응답 계약 `{ spec }` / `{ error }` 도 그대로다.

### 삭제되는 것

- `@anthropic-ai/sdk` 의존성과 그 import
- `src/lib/auth.ts`, `src/lib/auth.test.ts`
- `route.ts` 의 `mode === "none"` 가드
- `friendlyGenerateError` 의 `mode` 인자
- `.env.local` / `.env.local.example` 의 `ANTHROPIC_AUTH_TOKEN`

## 자식 프로세스 격리

이번 전환의 성패가 걸린 지점이다.

- **`ANTHROPIC_AUTH_TOKEN` 과 `ANTHROPIC_API_KEY` 를 자식 env 에서 제거한다.**
  Next 서버는 `.env.local` 을 읽어 자기 `process.env` 에 넣으므로, 그대로 물려주면 CLI 가
  한도에 걸린 그 토큰을 다시 써서 원점으로 돌아간다.
- `--safe-mode`: 프로젝트의 CLAUDE.md·훅·스킬·MCP 가 카피 생성에 새어들지 않게 한다.
- `--tools ""`: 도구를 쓰지 않는 순수 생성.
- `--no-session-persistence`: 생성 때마다 세션 파일이 쌓이지 않게 한다.
- `--json-schema` 로 넘기기 전에 **`$schema` 키를 제거한다.** CLI 검증기가 draft 2020-12
  메타스키마를 모르며, 그대로 넘기면
  `--json-schema is not a valid JSON Schema: no schema with key or ref ...` 로 즉시 실패한다.

`--bare` 는 쓰지 않는다. 훅·CLAUDE.md 를 걷어내는 목적에는 맞지만 인증이
`ANTHROPIC_API_KEY` 로 강제되어 OAuth 자격증명을 읽지 않는다.

## 에러 처리

CLI 는 영어로 실패 사유를 돌려주므로 그대로 노출하지 않고 매핑한다.
실패 판정은 프로세스 종료 코드가 0 이 아니거나 result 이벤트의 `is_error === true` 인 경우다
(`subtype` 은 실패해도 `"success"` 로 오므로 판정에 쓰지 않는다).

| 상황 | 상태 코드 | 사용자 문구 |
|---|---|---|
| `claude` 실행 파일 없음 (spawn ENOENT) | 500 | "Claude Code CLI를 찾을 수 없어요. `claude` 설치를 확인해 주세요." |
| `is_error` 이고 사유가 사용량 한도 | 500 | 기존 사용량 한도 문구 유지 |
| `is_error` 기타 | 500 | "카피 생성에 실패했어요. 잠시 후 다시 시도해 주세요." |
| `structured_output` 없음 또는 zod 검증 실패 | 502 | 기존 "카피 생성 결과가 스키마와 맞지 않습니다. 다시 시도해주세요." 유지 |
| 타임아웃 | 500 | "생성이 너무 오래 걸려 중단했어요. 다시 시도해 주세요." (상한 120 초 — 실측 24 초의 5 배) |

`.refine()` 은 `z.toJSONSchema` 에서 조용히 탈락한다(refine 유무와 무관하게 동일한 689 바이트가
나오는 것을 확인). 따라서 JSON Schema 는 모양만 강제하고 "첫 카드 hook / 마지막 cta" 는
CLI 응답을 다시 zod 로 검증해 잡는다 — 위 표의 502 경로가 그 역할을 한다.

## 테스트

실제 spawn 없이 RED→GREEN 이 가능하도록 순수 함수로 잘라 설계한다.

1. `$schema` 제거 헬퍼 — 키가 있으면 지우고 나머지는 보존
2. stream-json 입력 한 줄 생성기 — 사진이 있을 때와 없을 때
3. JSONL 이벤트에서 result 추출 — 성공 / `is_error` / `structured_output` 누락 픽스처
4. 에러 → 한국어 매핑 (`api-errors.test.ts` 를 CLI 실패 유형 기준으로 다시 씀)
5. **env 스크러빙** — 자식에 넘길 env 객체에 `ANTHROPIC_AUTH_TOKEN`·`ANTHROPIC_API_KEY` 가
   없음을 검증. "자식 프로세스 격리" 항목의 회귀 방지용이며, 이 테스트가 없으면 토큰이
   다시 새어도 조용히 429 로만 나타난다

기존 `route.test.ts` 의 `parseBody` 테스트는 입력 계약이 바뀌지 않으므로 그대로 둔다.

## 검증

- `npx vitest run` 전부 통과
- `npx tsc --noEmit` 오류 없음
- 앱에서 사진 없이 1 회, 사진 첨부로 1 회 실제 생성해 카드가 나오는 것을 사람이 확인
  (이 프로젝트는 브라우저가 로컬 dev 서버에 닿지 않아 UI 검증은 사람 확인으로 한다)

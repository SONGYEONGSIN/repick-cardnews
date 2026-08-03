/**
 * 인스타그램 장기 액세스 토큰 갱신 — 부수효과가 있는 쪽(`node:fs`·실제 Graph API 호출).
 * 판단·문자열 로직은 전부 `@/lib/instagram-token-refresh`(순수 함수)에 있다.
 *
 * 모든 진입점이 `env`(호출 쪽이 넘긴 `Record<string, string | undefined>`)를 인자로 받는다 —
 * `checkInstagramConfig(process.env)`(`@/lib/instagram-config`)와 같은 패턴이다. 실서비스
 * 경로(API 라우트·`instrumentation.ts`)는 `process.env`를 그대로 넘긴다 — 그 객체는 참조라서,
 * 갱신 성공 시 이 파일이 그 자리에서 값을 고쳐 쓰면(아래 `performRefresh` 참고) 재시작 없이도
 * 같은 프로세스의 나머지 코드가 새 토큰을 즉시 쓴다. 테스트는 순수 객체를 넘겨 실제 프로세스
 * 환경·실제 `.env.local`을 전혀 건드리지 않는다.
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod/v4";
import {
  applyRefreshToEnvContent,
  classifyRefreshFailure,
  decideAutoRefresh,
  formatKoreanDate,
  parseStoredExpiresAt,
  type RefreshFailureCategory,
} from "@/lib/instagram-token-refresh";

/** 공식 문서(Instagram Login 방식) 예제가 쓰는 호스트. `@/lib/instagram-config`의
 * `DEFAULT_GRAPH_HOST`와 같은 값이지만, 그 파일이 export 하지 않아 여기서 따로 둔다(상수
 * 문자열 하나 중복은 파일 간 결합보다 싸다). */
const DEFAULT_GRAPH_HOST = "graph.instagram.com";

/** `.env.local` 기본 경로 — 프로젝트 루트(`process.cwd()`) 기준. 테스트는 이 함수를 쓰지
 * 않고 `options.envPath`로 임시 파일 경로를 넘긴다. */
export function defaultEnvLocalPath(): string {
  return path.join(process.cwd(), ".env.local");
}

const RefreshResponseSchema = z.object({ access_token: z.string(), expires_in: z.number() });

type ApiResult = { ok: true; newToken: string; expiresInSeconds: number } | { ok: false; reason: RefreshFailureCategory };

async function callInstagramRefreshApi(
  fetchImpl: typeof fetch,
  accessToken: string,
  graphHost: string,
): Promise<ApiResult> {
  const url = `https://${graphHost}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`;

  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch {
    return { ok: false, reason: "network" };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }

  if (!res.ok) {
    return { ok: false, reason: classifyRefreshFailure(body) };
  }

  const parsed = RefreshResponseSchema.safeParse(body);
  if (!parsed.success) return { ok: false, reason: "other" };

  return { ok: true, newToken: parsed.data.access_token, expiresInSeconds: parsed.data.expires_in };
}

/** 임시 파일에 쓰고 같은 파일시스템 안에서 rename — 쓰는 도중 프로세스가 죽어도 원본
 * `.env.local`이 반쪽짜리로 남지 않는다. */
function atomicWriteFile(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, content, "utf8");
  renameSync(tmpPath, filePath);
}

export type PerformRefreshResult = { ok: true; expiresAt: Date } | { ok: false; reason: RefreshFailureCategory };

export type PerformRefreshOptions = { fetchImpl?: typeof fetch; envPath?: string };

/**
 * 갱신의 핵심 로직. 실패하면 `.env.local`을 전혀 건드리지 않는다(각 실패 분기가 파일 읽기
 * 전에 return 한다). 성공하면:
 * 1. `.env.local`을 원자적으로 새 값으로 바꾼다 — 토큰·만료일 줄만.
 * 2. 호출 쪽이 넘긴 `env` 객체(보통 `process.env`)도 같이 갱신해, 재시작 없이 같은 프로세스가
 *    새 토큰을 바로 쓰게 한다.
 * 토큰 값은 어디에도 로그로 남기지 않는다.
 */
export async function performRefresh(
  now: Date,
  env: Record<string, string | undefined>,
  options: PerformRefreshOptions = {},
): Promise<PerformRefreshResult> {
  const accessToken = env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!accessToken) return { ok: false, reason: "config-missing" };

  const graphHost = env.INSTAGRAM_GRAPH_HOST?.trim() || DEFAULT_GRAPH_HOST;
  const fetchImpl = options.fetchImpl ?? fetch;
  const envPath = options.envPath ?? defaultEnvLocalPath();

  const apiResult = await callInstagramRefreshApi(fetchImpl, accessToken, graphHost);
  if (!apiResult.ok) return { ok: false, reason: apiResult.reason };

  const expiresAt = new Date(now.getTime() + apiResult.expiresInSeconds * 1000);

  let fileContent: string;
  try {
    fileContent = readFileSync(envPath, "utf8");
  } catch {
    return { ok: false, reason: "config-missing" };
  }

  const applied = applyRefreshToEnvContent(fileContent, apiResult.newToken, expiresAt.toISOString());
  if (!applied.ok) return { ok: false, reason: "token-line-missing" };

  atomicWriteFile(envPath, applied.content);

  env.INSTAGRAM_ACCESS_TOKEN = apiResult.newToken;
  env.INSTAGRAM_TOKEN_EXPIRES_AT = expiresAt.toISOString();

  return { ok: true, expiresAt };
}

/** 화면의 "토큰 갱신" 버튼이 부른다 — 남은 기간과 무관하게 항상 시도한다(사용자가 직접
 * 누른 액션이라 자동 갱신의 30일 게이트를 적용하지 않는다). */
export async function refreshInstagramTokenNow(
  env: Record<string, string | undefined>,
  now: Date = new Date(),
  options: PerformRefreshOptions = {},
): Promise<PerformRefreshResult> {
  return performRefresh(now, env, options);
}

/**
 * 서버 기동 시(`instrumentation.ts`) 한 번 부른다. 남은 기간이 30일 이하일 때만 시도한다
 * (`decideAutoRefresh`). **어떤 이유로 실패해도 예외를 밖으로 던지지 않는다** — 이 함수가
 * 서버 기동을 막으면 안 된다. 성공했을 때만 로그 한 줄을 남기고, 토큰 값은 절대 남기지
 * 않는다(새 만료일만).
 */
export async function autoRefreshInstagramTokenOnBoot(
  env: Record<string, string | undefined>,
  now: Date = new Date(),
  options: PerformRefreshOptions = {},
): Promise<void> {
  try {
    const expiresAt = parseStoredExpiresAt(env.INSTAGRAM_TOKEN_EXPIRES_AT);
    const decision = decideAutoRefresh(now, expiresAt);
    if (!decision.attempt) return;

    const result = await performRefresh(now, env, options);
    if (result.ok) {
      // console.log 가 아니라 console.info 를 쓴다 — 디버깅 후 지워야 할 임시 로그가 아니라
      // "자동 갱신이 실제로 일어났다"를 남기려는 의도된 운영 로그다. 토큰 값은 담지 않는다.
      console.info(
        `[instagram] 액세스 토큰을 자동 갱신했어요 — ${formatKoreanDate(result.expiresAt)}까지 유효 (${result.expiresAt.toISOString()})`,
      );
    }
    // 실패는 조용히 넘어간다 — "24시간 미만"은 정상 상황이고, 그 밖의 실패도 다음 기동 때
    // 다시 시도된다. 서버 로그를 오류로 어지럽히지 않는다.
  } catch {
    // 어떤 이유로도 서버 기동 자체를 막지 않는다.
  }
}

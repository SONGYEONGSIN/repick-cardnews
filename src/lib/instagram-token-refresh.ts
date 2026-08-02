/**
 * 인스타그램 장기 액세스 토큰 자동/수동 갱신에 쓰는 **순수 함수**만 모은 파일이다.
 *
 * `.env.local` 파일 읽기, 실제 Graph API 호출, 원자적 쓰기 같은 부수효과는 전부
 * `@/lib/instagram-token-refresh-runtime`에 있다 — 이 파일은 `node:fs`·`fetch`를 전혀
 * 쓰지 않으므로 서버·브라우저 어느 쪽에서 import 해도 안전하다(화면이 "남은 며칠" 계산에
 * 그대로 갖다 쓸 수 있다).
 *
 * 장기 토큰은 60일짜리다(`docs/instagram-setup.md` 확인). 자동 갱신은 "마지막 갱신 시각"을
 * 따로 기록하지 않고 **만료일 하나만** `.env.local`(`INSTAGRAM_TOKEN_EXPIRES_AT`)에 남겨
 * 판단한다 — `decideAutoRefresh()` 참고.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 자동 갱신을 시도하는 기준(일). 남은 기간이 이 값 이하면 시도한다. 30일에 갱신하면 다시
 * 60일이 되므로, 앱을 한동안 안 켜도 최소 30일치 여유가 남는다 — 서버를 하루에 몇 번 켜도
 * 매번 인스타그램 API 를 때리지 않는다. */
export const AUTO_REFRESH_THRESHOLD_DAYS = 30;

const INSTAGRAM_ACCESS_TOKEN_KEY = "INSTAGRAM_ACCESS_TOKEN";
const INSTAGRAM_TOKEN_EXPIRES_AT_KEY = "INSTAGRAM_TOKEN_EXPIRES_AT";

/** `.env.local` 원문에서 `KEY=값` 줄(주석 아닌 줄)을 찾아 값만 돌려준다. 못 찾거나 값이
 * 비어 있으면 undefined — `# KEY=`처럼 주석 처리된 줄은 `KEY=`로 시작하지 않으므로 애초에
 * 걸리지 않는다. */
export function readEnvValue(content: string, key: string): string | undefined {
  const prefix = `${key}=`;
  for (const line of content.split("\n")) {
    if (line.startsWith(prefix)) {
      const value = line.slice(prefix.length).trim();
      return value === "" ? undefined : value;
    }
  }
  return undefined;
}

export type ApplyRefreshResult = { ok: true; content: string } | { ok: false; reason: "token-line-missing" };

/**
 * `.env.local` 원문에 새 토큰·만료일을 반영한 새 원문을 돌려준다. 다른 줄·주석·순서·빈 줄은
 * 손대지 않는다.
 * - 토큰 줄(`INSTAGRAM_ACCESS_TOKEN=`)이 없으면 아무것도 바꾸지 않고 실패를 알린다 — 파일이
 *   예상과 다른 모양이면 함부로 쓰지 않는 게 안전하다.
 * - 만료일 줄(`INSTAGRAM_TOKEN_EXPIRES_AT=`)은 있으면 값만 바꾸고, 없으면(처음 자동 갱신하는
 *   경우) 파일 끝에 새로 추가한다 — 트레일링 개행이 있던 파일은 그대로 유지한다.
 */
export function applyRefreshToEnvContent(
  content: string,
  newToken: string,
  expiresAtIso: string,
): ApplyRefreshResult {
  const tokenPrefix = `${INSTAGRAM_ACCESS_TOKEN_KEY}=`;
  const expiresPrefix = `${INSTAGRAM_TOKEN_EXPIRES_AT_KEY}=`;
  let tokenFound = false;
  let expiresFound = false;

  const lines = content.split("\n").map((line) => {
    if (line.startsWith(tokenPrefix)) {
      tokenFound = true;
      return `${tokenPrefix}${newToken}`;
    }
    if (line.startsWith(expiresPrefix)) {
      expiresFound = true;
      return `${expiresPrefix}${expiresAtIso}`;
    }
    return line;
  });

  if (!tokenFound) {
    return { ok: false, reason: "token-line-missing" };
  }

  if (!expiresFound) {
    const newLine = `${expiresPrefix}${expiresAtIso}`;
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.splice(lines.length - 1, 0, newLine);
    } else {
      lines.push(newLine);
    }
  }

  return { ok: true, content: lines.join("\n") };
}

/** 저장된 만료일 문자열(ISO)을 Date 로 바꾼다. 없거나 파싱할 수 없으면 undefined — 처음
 * 설정했거나 사용자가 손으로 토큰만 바꾼 경우를 "기록 없음"으로 다룬다. */
export function parseStoredExpiresAt(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export type AutoRefreshDecision =
  | { attempt: true; reason: "no-record" | "expiring-soon" }
  | { attempt: false; reason: "not-yet" | "already-expired" };

/**
 * 서버 기동 시 자동 갱신을 시도할지 판정한다. 만료일 하나만 보고 판단한다 — "마지막 갱신
 * 시각"을 따로 두지 않는다.
 * - 기록이 없으면(처음, 또는 사용자가 손으로 토큰만 바꿈) 한 번 시도해 기록을 남긴다.
 * - 이미 만료됐으면 갱신 자체가 불가능하므로 시도하지 않는다 — 사용자가 화면에서 안내를 본다.
 * - 남은 기간이 `AUTO_REFRESH_THRESHOLD_DAYS`(30일) 이하이고 아직 만료 전이면 시도한다.
 * - 그보다 여유가 있으면 시도하지 않는다.
 */
export function decideAutoRefresh(now: Date, expiresAt: Date | undefined): AutoRefreshDecision {
  if (!expiresAt) return { attempt: true, reason: "no-record" };
  const msRemaining = expiresAt.getTime() - now.getTime();
  if (msRemaining <= 0) return { attempt: false, reason: "already-expired" };
  const daysLeft = msRemaining / MS_PER_DAY;
  if (daysLeft <= AUTO_REFRESH_THRESHOLD_DAYS) return { attempt: true, reason: "expiring-soon" };
  return { attempt: false, reason: "not-yet" };
}

/** 남은 일수(올림) — 화면에 "N일 남음"으로 보여줄 때 쓴다. 이미 지났으면 0(음수를 주지
 * 않는다) — 만료 여부 자체는 호출 쪽이 먼저 가른다. */
export function daysRemaining(now: Date, expiresAt: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY));
}

/** "10월 3일" — 화면·서버 로그가 공통으로 쓰는 짧은 한국어 날짜 표기(연도 생략). */
export function formatKoreanDate(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

type GraphApiErrorBody = { error?: { message?: string; code?: number; error_subcode?: number } };

function isGraphApiErrorBody(value: unknown): value is GraphApiErrorBody {
  return typeof value === "object" && value !== null && "error" in value;
}

export type RefreshFailureReason = "too-soon" | "invalid-or-expired" | "other";

/**
 * 갱신 요청 실패를 분류한다. **정확한 오류 문구는 확인하지 못했다** — 공식 문서는 "발급·갱신
 * 후 24시간이 지나야 다시 갱신할 수 있다"는 조건만 명시할 뿐 정확한 오류 문구를 싣지 않는다.
 * `@/lib/instagram`의 기존 방식(코드값이 안정적인 것은 코드로, 나머지는 문구 매칭)을 따르되,
 * 잘못 추측해 엉뚱한 안내를 하는 것보다 "그 밖"으로 남기는 쪽을 택한다:
 * - 메시지에 "24"와 "hour"가 함께 있으면 24시간 조건 미달("너무 이르다")로 분류한다.
 * - 표준 인증 오류 신호(서브코드 463=세션 만료, 코드 190=OAuthException — Graph API 전반에서
 *   안정적으로 쓰이는 값, `@/lib/instagram` 상단 주석 참고 — 또는 메시지에 "expired"·"access
 *   token")가 보이면 "만료·무효"로 분류한다.
 * - 둘 다 아니면 "그 밖"이다.
 */
export function classifyRefreshFailure(body: unknown): RefreshFailureReason {
  if (!isGraphApiErrorBody(body) || !body.error) return "other";
  const { message, code, error_subcode } = body.error;
  const lower = (message ?? "").toLowerCase();

  if (lower.includes("24") && lower.includes("hour")) return "too-soon";
  if (error_subcode === 463 || code === 190 || lower.includes("expired") || lower.includes("access token")) {
    return "invalid-or-expired";
  }
  return "other";
}

export type RefreshFailureCategory = RefreshFailureReason | "network" | "config-missing" | "token-line-missing";

/** 갱신 실패 사유를 한국어 안내로 바꾼다. 인스타그램이 준 영문 메시지를 그대로 보여 주지
 * 않는다. */
export function friendlyRefreshMessage(reason: RefreshFailureCategory): string {
  switch (reason) {
    case "too-soon":
      return "아직 갱신할 수 없어요. 마지막 발급·갱신 후 24시간이 지나야 다시 갱신할 수 있어요 — 오류가 아니라 정상이에요.";
    case "invalid-or-expired":
      return "토큰이 이미 만료됐거나 무효해요. 대시보드에서 새로 만들어야 해요 — docs/instagram-setup.md 의 6단계를 따라 주세요.";
    case "network":
      return "네트워크 연결을 확인해 주세요. 인스타그램 서버에 닿지 못했어요.";
    case "config-missing":
      return "액세스 토큰이 설정되지 않았거나 설정 파일을 찾을 수 없어요.";
    case "token-line-missing":
      return "설정 파일(.env.local)에서 토큰 줄을 찾지 못했어요.";
    default:
      return "토큰 갱신에 실패했어요. 잠시 후 다시 시도해 주세요.";
  }
}

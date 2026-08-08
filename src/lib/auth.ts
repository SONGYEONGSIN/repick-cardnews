/**
 * 로그인 판단 — **이 앱의 모든 인증 판정이 여기 모인다.**
 *
 * 이 파일이 순수 함수인 이유: 이 저장소의 테스트는 `environment: "node"` 라 화면을 그릴 수
 * 없다. 판정을 미들웨어 안에 두면 테스트로 묶을 수 없고, 인증은 테스트 없이 두면 안 되는
 * 종류의 코드다.
 *
 * **Web Crypto 만 쓴다**(`node:crypto` 가 아니라). 미들웨어는 edge 런타임에서 돌 수 있고,
 * 거기엔 노드 모듈이 없다.
 */

/**
 * 로그인 없이 열어 주는 경로.
 *
 * `/s/` 는 **인스타그램 서버가 카드 이미지를 가져가는 길**이다(`src/lib/instagram.ts:213`).
 * 여기를 막으면 게시가 통째로 실패한다 — 그래서 이 예외가 이 파일의 존재 이유 절반이다.
 * 그 경로는 추측할 수 없는 토큰이 지킨다.
 */
const PUBLIC_EXACT = new Set(["/login", "/api/login", "/favicon.ico"]);
const PUBLIC_PREFIXES = ["/s/", "/_next/"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  // `/s` 하나만 온 경우도 공유 경로로 본다. `/slogan` 처럼 **뒤에 글자가 붙은 것은 아니다** —
  // 접두사만 보고 열면 이름이 비슷한 다른 경로가 통째로 새어 나간다.
  if (pathname === "/s") return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * 상수시간 비교. 앞에서 다르다고 곧장 끝내면 **어디까지 맞았는지가 시간으로 새어 나간다.**
 * 길이 차이도 결과에 섞어 넣어 길이만으로 갈라지지 않게 한다.
 */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 쿠키에 담을 값 — `만료시각.서명` 이다.
 *
 * 서버에 아무것도 저장하지 않는다. 서버리스는 요청마다 다른 기계에서 돌 수 있어, 어딘가에
 * 세션 목록을 두면 그 저장소부터 붙여야 한다. 서명만으로 충분하다.
 */
export async function signSession(expiresAt: number, secret: string): Promise<string> {
  return `${expiresAt}.${await hmacHex(String(expiresAt), secret)}`;
}

export async function verifySession(
  token: string | undefined,
  secret: string,
  now: number,
): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;

  const expiresAt = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^\d+$/.test(expiresAt)) return false;

  // **서명을 먼저 본다.** 만료를 먼저 보면 위조 쿠키인지 만료 쿠키인지가 응답 차이로 드러난다.
  if (!safeEqual(signature, await hmacHex(expiresAt, secret))) return false;
  return Number(expiresAt) > now;
}

/** 로그인 쿠키 이름. 미들웨어와 로그인 API 가 같은 값을 봐야 한다. */
export const SESSION_COOKIE = "repick_session";

/** 로그인 유지 기간. 폰에서 매번 다시 치지 않아도 되게 넉넉히 둔다. */
export const SESSION_DAYS = 30;

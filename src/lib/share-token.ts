import { randomUUID } from "node:crypto";

/**
 * 1회용 공유 링크(폰으로 보내기 / 인스타 게시)의 토큰.
 *
 * 추측 불가능해야 하므로 `crypto.randomUUID()`를 쓴다 — 이 저장소는 템플릿 결정론 때문에
 * `Math.random()`을 금지하는 규칙이 있으니(디자인 시드 등) 혼동 없이 crypto로 분리한다.
 */

/** 발급 후 이 시간(ms)이 지나면 토큰이 무효가 된다. */
export const SHARE_TOKEN_TTL_MS = 30 * 60 * 1000;

export function createShareToken(): string {
  return randomUUID();
}

/**
 * 순수 함수 — 발급 시각(issuedAt)과 판정 시각(now)을 모두 인자로 받는다.
 * 내부에서 `Date.now()`를 부르지 않아 시간에 의존하지 않는 테스트가 가능하다.
 * 경계값(now === issuedAt + ttlMs)은 무효로 본다.
 */
export function isTokenExpired(issuedAt: number, now: number, ttlMs: number = SHARE_TOKEN_TTL_MS): boolean {
  return now - issuedAt >= ttlMs;
}

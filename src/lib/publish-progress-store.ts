import type { PublishStageProgress } from "@/lib/instagram";

/**
 * 인스타그램 게시가 도는 동안 "어디까지 갔는지"를 서버 메모리에 남기는 보관소.
 * `@/lib/share-store`와 같은 패턴(globalThis 싱글턴 Map, 만료 정리)을 그대로 따른다 — 공유
 * 토큰을 키로 쓰는 것도 같다. 다만 이 보관소는 값(카드 이미지)이 아니라 "지금 3단계 중
 * 어디에 있는지" 만 담으므로, 토큰 자체를 응답 바디에 실어 보내지 않는다(호출 쪽 책임 —
 * `/api/publish-progress`는 진행 상황만 돌려주고 토큰을 되돌려 보내지 않는다).
 *
 * 게시가 끝나면 `/api/publish`가 `clearPublishProgress()`로 직접 지운다 — 그게 정상 경로다.
 * `PUBLISH_PROGRESS_TTL_MS`는 그 정리가 어떤 이유로든(예외적 프로세스 종료 등) 못 일어난
 * 경우를 대비한 안전망이다.
 */

/** 게시 3단계 진행 중 상태(`@/lib/instagram`)에 더해, 끝났음(성공/실패)까지 구분한다. */
export type PublishProgress = PublishStageProgress | { stage: "done"; result: "success" | "failure" };

type ProgressEntry = {
  progress: PublishProgress;
  updatedAt: number;
};

/** 단일 컨테이너 대기 상한(`POLL_INTERVAL_MS × POLL_MAX_ATTEMPTS` = 5분, `@/lib/instagram`
 * 실측 확인)보다 넉넉히 길게 잡아, 정상 진행 중인 단계를 오판해 지우지 않는다. */
export const PUBLISH_PROGRESS_TTL_MS = 10 * 60 * 1000;

declare global {
  var __repickPublishProgressStore: Map<string, ProgressEntry> | undefined;
}

function store(): Map<string, ProgressEntry> {
  if (!globalThis.__repickPublishProgressStore) {
    globalThis.__repickPublishProgressStore = new Map();
  }
  return globalThis.__repickPublishProgressStore;
}

/** 만료된 항목을 통째로 쓸어낸다. 로컬 1인 도구 규모라 접근마다 훑어도 비용이 작다. */
function purgeExpired(now: number): void {
  const map = store();
  for (const [token, entry] of map) {
    if (now - entry.updatedAt >= PUBLISH_PROGRESS_TTL_MS) {
      map.delete(token);
    }
  }
}

export function recordPublishProgress(token: string, progress: PublishProgress, now: number): void {
  store().set(token, { progress, updatedAt: now });
}

/** 기록이 없거나 만료됐으면 null — 호출 쪽(화면 폴링)은 "지금 도는 게시가 없다"로 조용히 처리한다. */
export function readPublishProgress(token: string, now: number): PublishProgress | null {
  purgeExpired(now);
  return store().get(token)?.progress ?? null;
}

export function clearPublishProgress(token: string): void {
  store().delete(token);
}

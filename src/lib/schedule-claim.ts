/**
 * 이 예약을 **지금 올려도 되는가**.
 *
 * 예전에는 프로세스 메모리의 `Set` 이 "지금 올리는 중" 을 들고 있었다. 서버리스에서는 tick 마다
 * 다른 인스턴스일 수 있어 그 표시가 통하지 않는다 — 그래서 표시를 **저장소의 상태**로 옮긴다.
 *
 * **한계를 숨기지 않는다.** Blob 에는 원자적 비교-교환(compare-and-set)이 없다. 두 tick 이
 * **같은 순간에** 읽으면 둘 다 "아직 아무도 안 찜했다" 로 보고 둘 다 올릴 수 있다 — 같은
 * 사진이 두 번 올라간다는 뜻이다. 부르는 cron 이 하나면 순차로 불리므로 현실적 위험은 낮지만
 * 0은 아니다. 이보다 강하게 막으려면 조건부 쓰기를 지원하는 저장소가 필요하다.
 */

/**
 * 찜이 풀리는 시간.
 *
 * 게시 도중 함수가 죽으면 `publishing` 인 채로 남는다. 풀어 주지 않으면 그 예약은 영영 안
 * 올라간다. 캐러셀 한 건이 1~2분이므로 10분이면 "정상적으로 도는 중" 과 "죽었다" 가 갈린다.
 */
export const CLAIM_STALE_MS = 10 * 60 * 1000;

export function canClaim(item: { status: string; claimedAt?: number }, now: number): boolean {
  if (item.status === "pending") return true;
  // 끝난 것(published·failed·missed·canceled)은 다시 건드리지 않는다.
  if (item.status !== "publishing") return false;
  return item.claimedAt === undefined || now - item.claimedAt >= CLAIM_STALE_MS;
}

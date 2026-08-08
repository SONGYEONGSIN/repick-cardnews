import { safeEqual } from "./auth";

/**
 * 밖에서 부르는 cron 요청이 진짜인지.
 *
 * cron 서비스는 로그인할 수 없다. 그래서 `/api/cron/*` 은 미들웨어의 로그인 예외인데,
 * **그 대신 이 비밀이 유일한 문지기**다.
 *
 * 설정이 없으면 **잠기는 쪽으로** 실패한다. 열어 두는 쪽으로 기울면, 환경변수를 빠뜨린
 * 배포 한 번에 주소를 아는 누구나 게시를 돌릴 수 있다.
 *
 * 비교는 상수시간(`safeEqual`)이다 — 앞에서 다르다고 곧장 끝내면 어디까지 맞았는지가
 * 시간으로 새어 나간다.
 */
export function checkCronSecret(given: string | null, expected: string | undefined): boolean {
  if (!expected || !given) return false;
  return safeEqual(given, expected);
}

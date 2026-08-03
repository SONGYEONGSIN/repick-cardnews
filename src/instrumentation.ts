/**
 * Next.js 서버 기동 훅. `register()`는 서버 프로세스가 뜰 때 딱 한 번 불린다(요청마다가
 * 아니다). 여기서 인스타그램 액세스 토큰이 곧 만료될지(`AUTO_REFRESH_THRESHOLD_DAYS` 이내,
 * `@/lib/instagram-token-refresh`) 확인하고 필요하면 자동으로 갱신한다 — 사용자가 60일마다
 * 대시보드에 다시 갈 필요가 없게.
 *
 * `NEXT_RUNTIME`이 `"nodejs"`일 때만 실행한다 — 갱신 로직이 `node:fs`를 쓰므로 edge
 * 런타임에서는 돌 수 없고, 돌 필요도 없다(이 앱은 항상 node 런타임의 API 라우트로 게시한다).
 * `import()`로 동적으로 불러오는 것도 같은 이유다 — 최상단에서 정적으로 import 하면 Next 가
 * edge 런타임 번들도 함께 분석하면서 `node:fs`를 끌고 가려 한다(공식 문서 권장 패턴).
 *
 * `autoRefreshInstagramTokenOnBoot()`는 스스로 모든 실패를 삼킨다(`@/lib/
 * instagram-token-refresh-runtime` 참고) — 여기서 다시 감쌀 필요가 없다. 이 함수가 예외를
 * 던지면 서버 기동 자체가 실패할 수 있으므로, 혹시 모를 상황에 대비해 한 겹 더 방어한다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { autoRefreshInstagramTokenOnBoot } = await import("@/lib/instagram-token-refresh-runtime");
    await autoRefreshInstagramTokenOnBoot(process.env);
  } catch {
    // 토큰 자동 갱신은 부가 기능이다 — 어떤 이유로도 서버 기동 자체를 막으면 안 된다.
  }

  // 예약 발행 스케줄러. 위와 같은 이유로 동적 import 하고(`node:fs` 를 쓴다), 같은 이유로
  // 실패를 삼킨다. 서버가 도는 동안만 돌아간다 — 컴퓨터가 꺼져 있으면 예약도 멈춘다는 사실은
  // 화면이 사용자에게 그대로 말한다(`SchedulePanel`).
  try {
    const { startScheduler } = await import("@/lib/schedule-scheduler");
    startScheduler();
  } catch {
    // 스케줄러를 못 켜도 나머지 기능은 그대로 써야 한다.
  }
}

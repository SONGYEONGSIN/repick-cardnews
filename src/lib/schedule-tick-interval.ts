/**
 * **밖에서 부르는 간격.** cron-job.org 가 `/api/cron/tick` 을 이 주기로 두드린다.
 *
 * 예전에는 서버 프로세스 안 `setInterval` 의 주기였다. 서버리스에는 tick 사이에 살아남는
 * 프로세스가 없어 밖에서 부르는 방식으로 바뀌었지만, **맥박이 얼마나 끊기면 이상한가**를
 * 판단하려면 여전히 이 값이 필요하다(`scheduler-health` 의 `HEARTBEAT_STALE_MS`).
 *
 * 이 값을 바꾸면 **cron-job.org 의 설정도 함께 바꿔야 한다** — 여기만 고치면 화면이 멀쩡한
 * 스케줄러를 "멈췄다" 고 말하거나, 멈춘 것을 못 알아챈다.
 */
export const TICK_MS = 60 * 1000;

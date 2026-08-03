/**
 * 예약 도래 판정 — **완전 순수 함수**다. `Date.now()` 를 부르지 않고 `now` 를 받는다.
 * 시각에 기대는 로직을 테스트할 수 있는 유일한 방법이다.
 *
 * 유예 1시간은 사용자가 정한 값이다(`docs/superpowers/specs/2026-08-03-scheduled-publish-design.md`):
 * 서버가 잠시 꺼져 있었던 경우는 늦게라도 올리되, 새벽에 켰다가 어제 낮 예약이 올라가는 일은
 * 막는다.
 */

export const GRACE_MS = 60 * 60 * 1000;

export type DueVerdict = "wait" | "due" | "missed";

export function dueVerdict(scheduledAt: number, now: number): DueVerdict {
  if (now < scheduledAt) return "wait";
  return now - scheduledAt < GRACE_MS ? "due" : "missed";
}

function minutesBetween(a: number, b: number): number {
  return Math.max(0, Math.round(Math.abs(a - b) / 60000));
}

/** "1시간 30분 뒤에 올라가요" / "5분 지났어요" 처럼. 화면에 그대로 나가므로 한국어만. */
export function describeSchedule(scheduledAt: number, now: number): string {
  const mins = minutesBetween(scheduledAt, now);
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  const span = hours > 0 ? (rest > 0 ? `${hours}시간 ${rest}분` : `${hours}시간`) : `${rest}분`;
  return now < scheduledAt ? `${span} 뒤에 올라가요` : `${span} 지났어요`;
}

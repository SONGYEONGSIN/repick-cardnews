import { dueVerdict } from "./schedule-due";
import { readQueue, removeImages, scheduleRoot, updateStatus, type ScheduleItem } from "./schedule-queue";
import { runScheduledItem, type RunResult } from "./schedule-runner";
import { TICK_MS } from "./schedule-tick-interval";
import { writeHeartbeat } from "./scheduler-health";

/**
 * 예약 스케줄러 — 서버가 도는 동안 1분마다 큐를 훑는다(`src/instrumentation.ts` 가 켠다).
 *
 * **`tickOnce` 가 테스트 가능한 단위다.** `startScheduler` 는 그것을 타이머에 얹기만 한다 —
 * 타이머 자체를 테스트하지 않는다.
 *
 * 실패가 서버를 죽이면 안 된다. 게시 함수가 던져도 잡아서 `failed` 로 남기고 다음 항목으로
 * 넘어간다 — 기동 훅의 토큰 자동 갱신과 같은 원칙이다.
 */

export { TICK_MS };

/**
 * 지금 게시가 도는 항목들. 게시는 몇 분 걸릴 수 있어 다음 tick 이 먼저 온다 — 이 표시가 없으면
 * 같은 예약이 두 번 올라간다.
 */
const inFlight = new Set<string>();

export type TickDeps = {
  root?: string;
  run?: (item: ScheduleItem, root: string, now: number) => Promise<RunResult>;
};

function defaultRun(item: ScheduleItem, root: string, now: number): Promise<RunResult> {
  return runScheduledItem(item, { now, root });
}

export async function tickOnce(now: number, deps: TickDeps = {}): Promise<void> {
  const root = deps.root ?? scheduleRoot();
  const run = deps.run ?? defaultRun;

  // 대기 항목이 없어도 남긴다 — 궁금한 것은 "올릴 게 있나"가 아니라 "시계가 도나"다.
  writeHeartbeat(now, root);

  const pending = readQueue(root).filter((i) => i.status === "pending");

  // 한 번에 하나씩 순차로 — 인스타 쪽 한도와 우리 대역폭을 동시에 밀지 않는다.
  for (const item of pending) {
    const verdict = dueVerdict(item.scheduledAt, now);
    if (verdict === "wait") continue;

    if (verdict === "missed") {
      updateStatus(item.id, "missed", "예약 시각을 한 시간 넘게 지나 올리지 않았어요.", root);
      removeImages(item.id, root);
      continue;
    }

    if (inFlight.has(item.id)) continue;
    inFlight.add(item.id);
    try {
      const result = await run(item, root, now);
      if (result.ok) updateStatus(item.id, "published", undefined, root);
      else updateStatus(item.id, "failed", result.message, root);
    } catch {
      // 예상 못 한 예외까지 여기서 멈춘다 — 원문은 밖으로 내보내지 않는다.
      updateStatus(item.id, "failed", "올리는 중에 문제가 생겼어요. 다시 예약해 주세요.", root);
    } finally {
      removeImages(item.id, root);
      inFlight.delete(item.id);
    }
  }
}

let started = false;

/** 서버 기동 훅이 부른다. 두 번 켜지지 않는다. */
export function startScheduler(): void {
  if (started) return;
  started = true;
  setInterval(() => {
    // 타이머 콜백에서 던지면 프로세스가 죽는다 — 여기서 반드시 삼킨다.
    void tickOnce(Date.now()).catch(() => undefined);
  }, TICK_MS);
}

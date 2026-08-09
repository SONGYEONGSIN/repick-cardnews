import { list, put } from "@vercel/blob";
import { TICK_MS } from "@/lib/schedule-tick-interval";

/**
 * 예약 스케줄러의 **맥박**.
 *
 * 예전에는 서버 기동 훅(`src/instrumentation.ts`)이 켠 타이머가 뛰었다. 그 훅은 어떤 실패든
 * 조용히 삼키게 돼 있어(서버 기동 자체를 막으면 안 되므로) **켜졌는지 알 길이 없었다.**
 * 실제로 예약이 44분 지나도 '대기 중'인 채 남고 화면은 아무 말도 못 했다(2026-08-05).
 *
 * 지금은 밖에서 cron 이 두드린다(`/api/cron/tick`). 질문이 "우리 타이머가 도나" 에서
 * **"cron 이 부르고 있나"** 로 바뀌었을 뿐, 답을 알아야 한다는 사실은 같다 — 조용히 아무 일도
 * 안 일어나는 것이 제일 나쁘다.
 *
 * 저장 위치도 디스크에서 Blob 으로 옮겼다. 배포 서버에는 tick 사이에 살아남는 디스크가 없다.
 */

/** 맥박이 이보다 오래 끊기면 멈춘 것으로 본다. 한 박자(cron 한 번) 놓치는 것까지는 봐준다. */
export const HEARTBEAT_STALE_MS = TICK_MS * 3;

export type SchedulerHealth = "alive" | "stale";

const HEARTBEAT_PATH = "scheduled/heartbeat.json";

/** 올릴 게 없어도 남긴다 — 궁금한 것은 "올릴 게 있나"가 아니라 "시계가 도나"다. */
export async function writeHeartbeat(now: number): Promise<void> {
  try {
    await put(HEARTBEAT_PATH, JSON.stringify({ lastTickAt: now }), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  } catch {
    // 맥박을 못 남기는 것으로 예약 자체를 멈추지 않는다.
  }
}

/** 마지막으로 뛴 시각. 없거나 읽을 수 없으면 `null` — 한 번도 안 뛰었다는 뜻으로 다룬다. */
export async function readHeartbeat(): Promise<number | null> {
  try {
    const { blobs } = await list({ prefix: HEARTBEAT_PATH });
    const found = blobs.find((b) => b.pathname === HEARTBEAT_PATH);
    if (!found) return null;

    const res = await fetch(found.url, { cache: "no-store" });
    if (!res.ok) return null;

    const raw: unknown = await res.json();
    const at = typeof raw === "object" && raw !== null ? (raw as { lastTickAt?: unknown }).lastTickAt : null;
    return typeof at === "number" ? at : null;
  } catch {
    return null;
  }
}

export function schedulerHealth(lastTickAt: number | null, now: number): SchedulerHealth {
  if (lastTickAt === null) return "stale";
  return now - lastTickAt <= HEARTBEAT_STALE_MS ? "alive" : "stale";
}

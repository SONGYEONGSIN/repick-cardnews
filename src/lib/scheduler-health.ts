import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TICK_MS } from "@/lib/schedule-tick-interval";

/**
 * 예약 스케줄러의 **맥박**.
 *
 * 스케줄러는 서버 기동 훅(`src/instrumentation.ts`)이 켠다. 그런데 그 훅은 어떤 실패든
 * 조용히 삼키게 돼 있어(서버 기동 자체를 막으면 안 되므로), **켜졌는지 아닌지를 알 길이
 * 없었다.** 실제로 그래서 예약이 44분이 지나도 '대기 중'인 채로 남아 있었고 화면은 아무
 * 말도 못 했다(2026-08-05).
 *
 * 그래서 뛸 때마다 시각을 파일에 남긴다. 화면은 그 시각을 보고 "시계가 멈췄다"고 말할 수
 * 있다 — 조용히 아무 일도 안 일어나는 것보다 낫다.
 */

/** 맥박이 이보다 오래 끊기면 멈춘 것으로 본다. 한 박자(틱) 놓치는 것까지는 봐준다. */
export const HEARTBEAT_STALE_MS = TICK_MS * 3;

export type SchedulerHealth = "alive" | "stale";

function heartbeatFile(root: string): string {
  return path.join(root, "heartbeat.json");
}

export function writeHeartbeat(now: number, root: string): void {
  try {
    if (!existsSync(root)) mkdirSync(root, { recursive: true });
    writeFileSync(heartbeatFile(root), JSON.stringify({ lastTickAt: now }), "utf8");
  } catch {
    // 맥박을 못 남기는 것으로 예약 자체를 멈추지 않는다.
  }
}

/** 마지막으로 뛴 시각. 없거나 읽을 수 없으면 `null` — 한 번도 안 뛰었다는 뜻으로 다룬다. */
export function readHeartbeat(root: string): number | null {
  try {
    const raw: unknown = JSON.parse(readFileSync(heartbeatFile(root), "utf8"));
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

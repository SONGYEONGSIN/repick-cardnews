import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { HEARTBEAT_STALE_MS, readHeartbeat, schedulerHealth, writeHeartbeat } from "@/lib/scheduler-health";

/**
 * 예약이 안 올라가는데 화면은 '대기 중'만 보여 줬다(2026-08-05: 44분이 지나도 그대로).
 * 스케줄러는 서버 기동 훅이 켜는데, 그 훅이 실패하면 **아무 데도 흔적이 남지 않는다** —
 * 켜졌는지 아닌지를 알 길이 없었다. 그래서 뛸 때마다 맥박을 남긴다.
 */
describe("맥박 기록", () => {
  let root: string;

  it("쓴 값을 그대로 읽는다", () => {
    root = mkdtempSync(path.join(tmpdir(), "hb-"));
    writeHeartbeat(1_700_000_000_000, root);
    expect(readHeartbeat(root)).toBe(1_700_000_000_000);
    rmSync(root, { recursive: true, force: true });
  });

  it("파일이 없으면 null 이다 — 한 번도 안 뛰었다", () => {
    root = mkdtempSync(path.join(tmpdir(), "hb-"));
    expect(readHeartbeat(root)).toBeNull();
    rmSync(root, { recursive: true, force: true });
  });

  it("깨진 파일도 null 이다 — 읽다 죽지 않는다", () => {
    root = mkdtempSync(path.join(tmpdir(), "hb-"));
    writeFileSync(path.join(root, "heartbeat.json"), "{망가진", "utf8");
    expect(readHeartbeat(root)).toBeNull();
    rmSync(root, { recursive: true, force: true });
  });
});

describe("schedulerHealth — 시계가 돌고 있나", () => {
  const now = 1_700_000_000_000;

  it("방금 뛰었으면 살아 있다", () => {
    expect(schedulerHealth(now - 1000, now)).toBe("alive");
  });

  it("한동안 안 뛰었으면 멈춘 것이다", () => {
    expect(schedulerHealth(now - HEARTBEAT_STALE_MS - 1, now)).toBe("stale");
  });

  it("한 번도 안 뛰었으면 멈춘 것이다 — 켜지지 않았다는 뜻이다", () => {
    expect(schedulerHealth(null, now)).toBe("stale");
  });

  it("경계에서는 아직 살아 있다고 본다 — 한 박자 늦은 것으로 겁주지 않는다", () => {
    expect(schedulerHealth(now - HEARTBEAT_STALE_MS, now)).toBe("alive");
  });
});

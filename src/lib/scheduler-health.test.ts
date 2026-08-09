import { describe, it, expect, vi, beforeEach } from "vitest";
import { HEARTBEAT_STALE_MS, readHeartbeat, schedulerHealth, writeHeartbeat } from "@/lib/scheduler-health";

/**
 * 예약이 안 올라가는데 화면은 '대기 중'만 보여 줬다(2026-08-05: 44분이 지나도 그대로).
 * 켜졌는지 아닌지를 알 길이 없었기 때문이다. 그래서 뛸 때마다 맥박을 남긴다.
 *
 * Blob 은 네트워크다 — 이 테스트는 `environment: "node"` 에서 돌고 바깥을 타면 안 되므로
 * 저장소와 내려받기를 흉내만 낸다. **무엇을 저장하느냐가 아니라 무엇을 판단하느냐**를 본다.
 */
let stored: string | null = null;

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (_path: string, body: string) => {
    stored = body;
    return { url: "https://blob.example/scheduled/heartbeat.json" };
  }),
  list: vi.fn(async () => ({
    blobs:
      stored === null
        ? []
        : [{ pathname: "scheduled/heartbeat.json", url: "https://blob.example/scheduled/heartbeat.json" }],
  })),
}));

beforeEach(() => {
  stored = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => JSON.parse(stored ?? "null"),
    })),
  );
});

describe("맥박 기록", () => {
  it("쓴 값을 그대로 읽는다", async () => {
    await writeHeartbeat(1_700_000_000_000);
    expect(await readHeartbeat()).toBe(1_700_000_000_000);
  });

  it("한 번도 안 뛰었으면 null 이다", async () => {
    expect(await readHeartbeat()).toBeNull();
  });

  it("깨진 값도 null 이다 — 읽다 죽지 않는다", async () => {
    stored = "{망가진";
    expect(await readHeartbeat()).toBeNull();
  });

  it("숫자가 아닌 값도 null 이다", async () => {
    stored = JSON.stringify({ lastTickAt: "어제" });
    expect(await readHeartbeat()).toBeNull();
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

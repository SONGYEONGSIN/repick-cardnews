import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { TICK_MS, tickOnce } from "./schedule-scheduler";
import { GRACE_MS } from "./schedule-due";
import { appendItem, readQueue, saveImages, type ScheduleItem } from "./schedule-queue";

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "repick-tick-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const T = 1_800_000_000_000;

function item(over: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "a1",
    scheduledAt: T,
    caption: "캡션",
    imageCount: 2,
    keyword: "수원 갈비",
    status: "pending",
    createdAt: T - 3600_000,
    ...over,
  };
}

function seed(over: Partial<ScheduleItem> = {}) {
  const it = item(over);
  appendItem(it, root);
  saveImages(it.id, [Buffer.from("one"), Buffer.from("two")], root);
  return it;
}

function statusOf(id: string) {
  return readQueue(root).find((i) => i.id === id)?.status;
}

describe("주기", () => {
  it("1분마다 돈다", () => {
    expect(TICK_MS).toBe(60 * 1000);
  });
});

describe("tickOnce", () => {
  it("아직 시각 전이면 아무것도 하지 않는다", async () => {
    seed();
    const run = vi.fn();

    await tickOnce(T - 1, { root, run });

    expect(run).not.toHaveBeenCalled();
    expect(statusOf("a1")).toBe("pending");
  });

  it("도래한 항목을 게시하고 published 로 바꾼다", async () => {
    seed();
    const run = vi.fn(async () => ({ ok: true as const, mediaId: "m1" }));

    await tickOnce(T, { root, run });

    expect(run).toHaveBeenCalledOnce();
    expect(statusOf("a1")).toBe("published");
  });

  it("유예를 넘긴 항목은 게시하지 않고 missed 로 바꾼다", async () => {
    seed();
    const run = vi.fn();

    await tickOnce(T + GRACE_MS, { root, run });

    expect(run).not.toHaveBeenCalled();
    expect(statusOf("a1")).toBe("missed");
  });

  it("pending 이 아닌 항목은 건드리지 않는다 — 이미 올라간 것을 다시 올리지 않는다", async () => {
    seed({ status: "published" });
    seed({ id: "b2", status: "canceled" });
    const run = vi.fn();

    await tickOnce(T, { root, run });

    expect(run).not.toHaveBeenCalled();
  });

  it("게시가 실패하면 failed 와 한국어 사유를 남긴다", async () => {
    seed();
    const run = vi.fn(async () => ({ ok: false as const, message: "터널에 닿지 못했어요." }));

    await tickOnce(T, { root, run });

    const found = readQueue(root).find((i) => i.id === "a1");
    expect(found?.status).toBe("failed");
    expect(found?.message).toBe("터널에 닿지 못했어요.");
  });

  it("성공하면 이미지를 지운다 — 다 쓴 사진을 디스크에 남기지 않는다", async () => {
    seed();
    const run = vi.fn(async () => ({ ok: true as const, mediaId: "m1" }));

    await tickOnce(T, { root, run });

    expect(existsSync(path.join(root, "a1"))).toBe(false);
  });

  it("실패해도 이미지를 지운다 — 되돌릴 수 없으니 쌓아 두지 않는다", async () => {
    seed();
    const run = vi.fn(async () => ({ ok: false as const, message: "안 됐어요." }));

    await tickOnce(T, { root, run });

    expect(existsSync(path.join(root, "a1"))).toBe(false);
  });

  it("놓친 항목의 이미지도 지운다", async () => {
    seed();

    await tickOnce(T + GRACE_MS, { root, run: vi.fn() });

    expect(existsSync(path.join(root, "a1"))).toBe(false);
  });

  it("여러 항목을 한 번에 처리한다", async () => {
    seed();
    seed({ id: "b2" });
    const run = vi.fn(async () => ({ ok: true as const, mediaId: "m" }));

    await tickOnce(T, { root, run });

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("게시가 도는 동안 다시 돌아도 같은 항목을 두 번 올리지 않는다", async () => {
    seed();
    let release: (() => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<{ ok: true; mediaId: string }>((resolve) => {
          release = () => resolve({ ok: true, mediaId: "m1" });
        }),
    );

    const first = tickOnce(T, { root, run });
    await tickOnce(T, { root, run }); // 앞의 것이 끝나기 전에 또 돈다
    release?.();
    await first;

    expect(run).toHaveBeenCalledOnce();
  });

  it("게시 함수가 던져도 서버를 죽이지 않고 failed 로 남긴다", async () => {
    seed();
    const run = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(tickOnce(T, { root, run })).resolves.toBeUndefined();

    const found = readQueue(root).find((i) => i.id === "a1");
    expect(found?.status).toBe("failed");
    expect(found?.message && /[가-힣]/.test(found.message)).toBe(true);
    expect(found?.message).not.toContain("boom");
  });
});

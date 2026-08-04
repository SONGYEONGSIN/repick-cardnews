import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DELETE, GET, POST } from "./route";
import { appendItem, readQueue, type ScheduleItem } from "@/lib/schedule-queue";

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "repick-api-"));
  vi.stubEnv("REPICK_SCHEDULE_ROOT", root);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const FUTURE = Date.now() + 60 * 60 * 1000;

function post(body: unknown, host = "localhost:3500") {
  return new Request(`http://${host}/api/schedule`, {
    method: "POST",
    headers: { host, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function png(): string {
  return Buffer.from("fake-png").toString("base64");
}

function validBody(over: Record<string, unknown> = {}) {
  return {
    scheduledAt: FUTURE,
    caption: "캡션",
    hashtags: ["살림", "요리"],
    keyword: "수원 갈비",
    images: [png(), png()],
    ...over,
  };
}

function item(over: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "a1",
    scheduledAt: FUTURE,
    caption: "캡션",
    imageCount: 2,
    keyword: "수원 갈비",
    status: "pending",
    createdAt: Date.now(),
    ...over,
  };
}

describe("로컬 전용", () => {
  it("다른 기기에서 부르면 셋 다 403 과 한국어 안내를 준다", async () => {
    const host = "192.168.0.5:3500";
    const listed = await GET(new Request(`http://${host}/api/schedule`, { headers: { host } }));
    const created = await POST(post(validBody(), host));
    const removed = await DELETE(
      new Request(`http://${host}/api/schedule?id=a1`, { method: "DELETE", headers: { host } }),
    );

    for (const res of [listed, created, removed]) {
      expect(res.status).toBe(403);
      expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
    }
  });
});

describe("POST /api/schedule", () => {
  it("예약을 만들고 id 를 돌려준다", async () => {
    const res = await POST(post(validBody()));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(typeof data.id).toBe("string");

    const queue = readQueue(root);
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe("pending");
    expect(queue[0].imageCount).toBe(2);
  });

  it("해시태그를 캡션에 합쳐 **예약 시점에** 굳힌다 — 게시 때 다시 조합하지 않는다", async () => {
    await POST(post(validBody({ caption: "본문", hashtags: ["살림"] })));

    expect(readQueue(root)[0].caption).toContain("#살림");
    expect(readQueue(root)[0].caption).toContain("본문");
  });

  it("과거 시각이면 400 과 한국어 안내를 준다", async () => {
    const res = await POST(post(validBody({ scheduledAt: Date.now() - 1000 })));

    expect(res.status).toBe(400);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
    expect(readQueue(root)).toEqual([]);
  });

  // 정보전달은 한 장이다 — 손으로는 올라가는데 예약만 막히면 안 된다(`publishKindFor`).
  it("한 장도 예약된다 — 정보전달은 한 장으로 나간다", async () => {
    const res = await POST(post(validBody({ images: [png()] })));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id?: string };
    expect(typeof body.id).toBe("string");
  });

  it("사진이 하나도 없으면 400 이다", async () => {
    const res = await POST(post(validBody({ images: [] })));

    expect(res.status).toBe(400);
    expect(readQueue(root)).toEqual([]);
  });

  it("사진이 너무 많으면 400 이다", async () => {
    const res = await POST(post(validBody({ images: Array.from({ length: 11 }, png) })));

    expect(res.status).toBe(400);
  });

  it("해시태그가 상한을 넘으면 400 이다", async () => {
    const res = await POST(post(validBody({ hashtags: ["1", "2", "3", "4", "5", "6"] })));

    expect(res.status).toBe(400);
  });

  it("본문 형태가 어긋나면 400 과 한국어 안내를 준다 — zod 영문 원문을 보이지 않는다", async () => {
    const res = await POST(post({ nope: true }));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(/[가-힣]/.test(error)).toBe(true);
  });
});

describe("GET /api/schedule", () => {
  it("목록과 사람이 읽을 한 줄을 함께 준다", async () => {
    appendItem(item(), root);

    const data = await (await GET(new Request("http://localhost:3500/api/schedule", { headers: { host: "localhost:3500" } }))).json();

    expect(data.items).toHaveLength(1);
    expect(typeof data.items[0].describe).toBe("string");
    expect(/[가-힣]/.test(data.items[0].describe)).toBe(true);
  });

  it("최신 예약이 먼저 온다", async () => {
    appendItem(item({ id: "old", createdAt: 1 }), root);
    appendItem(item({ id: "new", createdAt: 2 }), root);

    const data = await (await GET(new Request("http://localhost:3500/api/schedule", { headers: { host: "localhost:3500" } }))).json();

    expect(data.items.map((i: ScheduleItem) => i.id)).toEqual(["new", "old"]);
  });
});

describe("DELETE /api/schedule", () => {
  function del(id: string) {
    return new Request(`http://localhost:3500/api/schedule?id=${id}`, {
      method: "DELETE",
      headers: { host: "localhost:3500" },
    });
  }

  it("pending 을 취소한다", async () => {
    appendItem(item(), root);

    const res = await DELETE(del("a1"));

    expect(res.status).toBe(200);
    expect(readQueue(root)[0].status).toBe("canceled");
  });

  it("이미 올라간 것은 취소하지 않는다 — 되돌릴 수 없다", async () => {
    appendItem(item({ status: "published" }), root);

    const res = await DELETE(del("a1"));

    expect(res.status).toBe(400);
    expect(readQueue(root)[0].status).toBe("published");
  });

  it("없는 id 면 404 와 한국어 안내를 준다", async () => {
    const res = await DELETE(del("없음"));

    expect(res.status).toBe(404);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
  });

  it("id 가 없으면 400 이다", async () => {
    const res = await DELETE(
      new Request("http://localhost:3500/api/schedule", { method: "DELETE", headers: { host: "localhost:3500" } }),
    );

    expect(res.status).toBe(400);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DELETE, GET, POST } from "./route";
import { appendItem, readQueue, type ScheduleItem } from "@/lib/schedule-queue";
import { clearPublishProgress, recordPublishProgress } from "@/lib/publish-progress-store";
import { writeHeartbeat } from "@/lib/scheduler-health";

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

/** 진짜 PNG 서명으로 시작하는 최소 바이트 — 라우트가 내용을 검사하므로 흉내만으로는 안 된다. */
function png(): string {
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from("아무 내용")]).toString("base64");
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

/**
 * 목록이 진행 상황을 함께 내려준다 — 화면이 그걸 읽어 '5장 중 2장 준비 중' 처럼 보여 준다.
 * 진행은 실행기가 항목 id 로 남긴다(`@/lib/schedule-runner`).
 */
describe("GET 진행 상황", () => {
  it("도는 중이면 그 항목에 진행이 담긴다", async () => {
    await POST(post(validBody({ images: [png(), png()] })));
    const created = readQueue(root)[0];
    recordPublishProgress(created.id, { stage: "preparing", index: 2, total: 5 }, Date.now());

    const res = await GET(new Request("http://localhost:3500/api/schedule", { headers: { host: "localhost:3500" } }));
    const body = (await res.json()) as { items: { id: string; progress?: unknown }[] };

    expect(body.items.find((i) => i.id === created.id)?.progress).toEqual({
      stage: "preparing",
      index: 2,
      total: 5,
    });
    clearPublishProgress(created.id);
  });

  it("안 도는 항목에는 진행이 없다", async () => {
    await POST(post(validBody({ images: [png(), png()] })));

    const res = await GET(new Request("http://localhost:3500/api/schedule", { headers: { host: "localhost:3500" } }));
    const body = (await res.json()) as { items: { progress?: unknown }[] };

    expect(body.items.every((i) => i.progress === undefined)).toBe(true);
  });
});

/**
 * 시계(스케줄러)가 멈춰 있으면 예약은 영영 안 올라간다. 그런데 지금껏 화면은 '대기 중'만
 * 보여 줬다 — 목록이 시계 상태를 함께 내려줘야 사람이 알 수 있다.
 */
describe("GET 스케줄러 상태", () => {
  it("맥박이 없으면 멈춘 것으로 알린다", async () => {
    const res = await GET(new Request("http://localhost:3500/api/schedule", { headers: { host: "localhost:3500" } }));
    const body = (await res.json()) as { scheduler?: string };

    expect(body.scheduler).toBe("stale");
  });

  it("방금 뛰었으면 살아 있다고 알린다", async () => {
    writeHeartbeat(Date.now(), root);

    const res = await GET(new Request("http://localhost:3500/api/schedule", { headers: { host: "localhost:3500" } }));
    const body = (await res.json()) as { scheduler?: string };

    expect(body.scheduler).toBe("alive");
  });
});

/**
 * 빈 이미지를 받아 저장하면 **인스타그램이 거절할 때까지 아무도 모른다** — 실제로 그랬다
 * (2026-08-05: 예약이 0바이트 파일을 저장했고, 터널 확인은 200 이라 통과했으며, 게시에서야
 * `HTTP 500 · code 1` 로 튕겼다). 받는 자리에서 막는다.
 */
describe("POST 이미지 내용 검증", () => {
  it("빈 문자열이면 400 이다", async () => {
    const res = await POST(post(validBody({ images: [""] })));

    expect(res.status).toBe(400);
    expect(readQueue(root)).toEqual([]);
  });

  it("PNG 가 아니면 400 이다 — 저장해 두고 나중에 실패하지 않는다", async () => {
    const notPng = Buffer.from("이건 PNG 가 아니다").toString("base64");
    const res = await POST(post(validBody({ images: [notPng] })));

    expect(res.status).toBe(400);
    expect(readQueue(root)).toEqual([]);
  });

  it("거절 사유는 한국어다", async () => {
    const res = await POST(post(validBody({ images: [""] })));
    const body = (await res.json()) as { error: string };

    expect(/[가-힣]/.test(body.error)).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/cron/tick/route";
import type { ScheduledItem } from "@/lib/schedule-store";

/**
 * 밖에서 부르는 입구다. **로그인 예외**라서 비밀 검사가 유일한 문지기고, 여기서 실수하면
 * 주소를 아는 누구나 게시를 돌릴 수 있다 — 그래서 거절 경로를 먼저 못 박는다.
 *
 * Blob 은 네트워크다. `environment: "node"` 에서 돌고 바깥을 타면 안 되므로 저장소와 실행기를
 * 흉내만 낸다 — 여기서 보는 것은 **무엇을 저장하느냐가 아니라 어떤 순서로 판단하느냐**다.
 */
let stored: ScheduledItem[] = [];
const puts: ScheduledItem[] = [];
const deleted: string[] = [];
let beats = 0;

vi.mock("@/lib/schedule-store", () => ({
  listItems: vi.fn(async () => stored),
  putItem: vi.fn(async (i: ScheduledItem) => {
    puts.push(i);
  }),
  deleteImages: vi.fn(async (id: string) => {
    deleted.push(id);
  }),
}));

vi.mock("@/lib/scheduler-health", () => ({
  writeHeartbeat: vi.fn(async () => {
    beats += 1;
  }),
}));

const runMock = vi.fn(async () => ({ ok: true, mediaId: "media-1" }));
vi.mock("@/lib/schedule-runner", () => ({
  runScheduledItem: (...args: unknown[]) => runMock(...(args as [])),
}));

const NOW = 1_800_000_000_000;

function pending(over: Partial<ScheduledItem> = {}): ScheduledItem {
  return {
    id: "a1",
    scheduledAt: NOW - 1000,
    caption: "캡션",
    keyword: "수원 갈비",
    imageUrls: ["https://blob.example/scheduled/a1/1.png"],
    status: "pending",
    createdAt: NOW - 100_000,
    ...over,
  };
}

function call(secret: string | null) {
  const url = new URL("http://x/api/cron/tick");
  if (secret !== null) url.searchParams.set("secret", secret);
  return GET(new Request(url));
}

beforeEach(() => {
  stored = [];
  puts.length = 0;
  deleted.length = 0;
  beats = 0;
  runMock.mockClear();
  runMock.mockResolvedValue({ ok: true, mediaId: "media-1" });
  process.env.CRON_SECRET = "올바른비밀값";
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
});

describe("cron 입구 — 문지기", () => {
  it("비밀이 틀리면 401 이고 무엇도 올리지 않는다", async () => {
    stored = [pending()];

    const res = await call("틀린값");

    expect(res.status).toBe(401);
    expect(runMock).not.toHaveBeenCalled();
    expect(beats).toBe(0);
  });

  it("비밀을 아예 안 주면 401 이다", async () => {
    const res = await call(null);
    expect(res.status).toBe(401);
  });

  it("서버에 비밀이 없으면 맞는 값을 줘도 401 이다 — 잠기는 쪽으로 실패한다", async () => {
    delete process.env.CRON_SECRET;
    const res = await call("무엇이든");
    expect(res.status).toBe(401);
  });

  it("거절 문구는 한국어다", async () => {
    const data = await (await call("틀린값")).json();
    expect(data.error).toMatch(/[가-힣]/);
  });
});

describe("cron 입구 — 하는 일", () => {
  it("비밀이 맞으면 심장박동을 남긴다 — 올릴 게 없어도", async () => {
    const res = await call("올바른비밀값");

    expect(res.status).toBe(200);
    expect(beats).toBe(1);
  });

  it("아직 시각이 안 됐으면 올리지 않는다", async () => {
    stored = [pending({ scheduledAt: NOW + 60_000 })];

    await call("올바른비밀값");

    expect(runMock).not.toHaveBeenCalled();
  });

  // 함수는 300초에서 끊긴다. 캐러셀 한 건이 1~2분이라 여러 건을 몰아 처리하다 중간에 끊기면
  // 올라갔는지 아닌지 모르는 항목이 생긴다. 밀린 것은 다음 분에 빠진다.
  it("한 번에 하나만 올린다 — 밀려 있어도", async () => {
    stored = [pending({ id: "늦은것", scheduledAt: NOW - 500 }), pending({ id: "빠른것", scheduledAt: NOW - 5000 })];

    await call("올바른비밀값");

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(puts[0].id).toBe("빠른것");
  });

  it("인스타를 부르기 전에 찜한다 — 안 그러면 다음 tick 이 같은 것을 또 올린다", async () => {
    stored = [pending()];

    await call("올바른비밀값");

    expect(puts[0].status).toBe("publishing");
    expect(puts[0].claimedAt).toBe(NOW);
  });

  it("이미 찜한 것은 건너뛴다", async () => {
    stored = [pending({ status: "publishing", claimedAt: NOW - 1000 })];

    await call("올바른비밀값");

    expect(runMock).not.toHaveBeenCalled();
  });

  it("성공하면 published 로 남기고 사진을 지운다", async () => {
    stored = [pending()];

    await call("올바른비밀값");

    expect(puts[puts.length - 1].status).toBe("published");
    expect(deleted).toContain("a1");
  });

  it("실패하면 failed 와 한국어 사유를 남기고 사진은 지우지 않는다", async () => {
    stored = [pending()];
    runMock.mockResolvedValueOnce({ ok: false, message: "인스타그램이 거절했어요." } as never);

    await call("올바른비밀값");

    const last = puts[puts.length - 1];
    expect(last.status).toBe("failed");
    expect(last.message).toBe("인스타그램이 거절했어요.");
    expect(deleted).not.toContain("a1");
  });

  it("한 시간 넘게 지난 것은 missed 로 표시하고 사진을 지운다", async () => {
    stored = [pending({ scheduledAt: NOW - 2 * 60 * 60 * 1000 })];

    await call("올바른비밀값");

    expect(runMock).not.toHaveBeenCalled();
    expect(puts[0].status).toBe("missed");
    expect(puts[0].message).toMatch(/[가-힣]/);
    expect(deleted).toContain("a1");
  });

  it("끝난 것은 다시 건드리지 않는다", async () => {
    stored = [pending({ status: "published" }), pending({ id: "b1", status: "canceled" })];

    await call("올바른비밀값");

    expect(runMock).not.toHaveBeenCalled();
    expect(puts).toHaveLength(0);
  });
});

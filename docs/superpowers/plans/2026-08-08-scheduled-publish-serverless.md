# 예약 발행 서버리스 이전 — 구현 계획

> **에이전트에게:** `superpowers:executing-plans` 로 태스크 단위로 실행한다. 체크박스로 추적한다.

설계: `docs/superpowers/specs/2026-08-08-scheduled-publish-serverless-design.md`

**Goal:** 배포된 서버에서 예약 발행이 실제로 돌게 한다.

**Architecture:** 큐와 카드 이미지를 Blob 으로 옮기고(항목 하나 = 파일 하나), 프로세스 안
1분 타이머 대신 cron-job.org 가 `/api/cron/tick` 을 두드린다. 중복 게시는 상태 찜으로 막는다.

**Tech Stack:** `@vercel/blob` · Next.js Route Handlers · vitest(`environment: "node"`)

## Global Constraints

- **판단은 순수 함수로 뺀다.** 테스트가 `node` 환경이라 화면·네트워크는 못 묶는다
- **모든 문구는 한국어.** 큐에 남고 화면에 그대로 나간다 — 영어·raw JSON 금지
- **비밀값을 응답·오류·로그에 담지 않는다.** `.env.local` 은 열지 않는다
- **`git add -A` 금지**
- **`/api/schedule` 의 응답 모양을 바꾸지 않는다** — `SchedulePanel` 을 손대지 않기 위해서다.
  `imageCount` 는 `imageUrls.length` 로 계산해 내려준다
- 커밋 전 `npx vitest run` 통과 · `npx tsc --noEmit` 0바이트
- 테스트에서 **Blob 을 실제로 부르지 않는다** — `vi.mock` 으로 흉내 낸다

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/lib/schedule-store.ts` (신규) | Blob 위의 큐 — 경로·파싱·읽기·쓰기 |
| `src/lib/schedule-claim.ts` (신규) | 찜 판정(순수) — 이 항목을 지금 올려도 되나 |
| `src/lib/cron-auth.ts` (신규) | cron 비밀 검사(순수) |
| `src/app/api/cron/tick/route.ts` (신규) | 밖에서 부르는 입구 |
| `src/lib/schedule-runner.ts` (수정) | 디스크 대신 항목의 `imageUrls` 를 쓴다 |
| `src/app/api/schedule/route.ts` (수정) | Blob 으로 읽고 쓴다 |
| `src/lib/auth.ts` (수정) | `/api/cron/` 을 공개 경로에 추가 |
| `src/lib/scheduler-health.ts` (수정) | 심장박동을 Blob 으로 |
| `src/lib/schedule-queue.ts` (삭제) | 디스크 큐 — `schedule-store` 가 대신한다 |
| `src/lib/schedule-scheduler.ts` (삭제) | `setInterval` — cron 이 대신한다 |
| `src/instrumentation.ts` (수정) | 스케줄러 기동 제거 |

---

### Task 1: 찜 판정과 cron 비밀 검사 (순수 함수)

가장 안쪽부터 만든다. 둘 다 바깥을 안 타서 테스트가 쉽고, 뒤의 모든 태스크가 이것을 쓴다.

**Files** — Create: `src/lib/schedule-claim.ts`, `src/lib/schedule-claim.test.ts`,
`src/lib/cron-auth.ts`, `src/lib/cron-auth.test.ts`

**Produces:**
- `CLAIM_STALE_MS: number` (10분)
- `canClaim(item: { status: string; claimedAt?: number }, now: number): boolean`
- `checkCronSecret(given: string | null, expected: string | undefined): boolean`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from "vitest";
import { CLAIM_STALE_MS, canClaim } from "./schedule-claim";

describe("canClaim", () => {
  it("대기 중이면 올릴 수 있다", () => {
    expect(canClaim({ status: "pending" }, 1000)).toBe(true);
  });

  // 다른 tick 이 이미 들고 있다. 여기서 또 올리면 같은 사진이 두 번 올라간다.
  it("방금 찜한 것은 건너뛴다", () => {
    expect(canClaim({ status: "publishing", claimedAt: 1000 }, 1000 + CLAIM_STALE_MS - 1)).toBe(false);
  });

  // 함수가 중간에 죽으면 publishing 인 채로 영원히 남는다 — 풀어 줘야 한다.
  it("찜한 지 오래되면 다시 가져온다", () => {
    expect(canClaim({ status: "publishing", claimedAt: 1000 }, 1000 + CLAIM_STALE_MS)).toBe(true);
  });

  it("claimedAt 이 없는 publishing 은 다시 가져온다 — 옛 기록", () => {
    expect(canClaim({ status: "publishing" }, 5000)).toBe(true);
  });

  it("끝난 것은 다시 올리지 않는다", () => {
    for (const status of ["published", "failed", "missed", "canceled"]) {
      expect(canClaim({ status }, 1000), status).toBe(false);
    }
  });

  it("기준은 10분이다 — 낮추면 이 테스트가 먼저 깨진다", () => {
    expect(CLAIM_STALE_MS).toBe(10 * 60 * 1000);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { checkCronSecret } from "./cron-auth";

describe("checkCronSecret", () => {
  it("맞으면 통과", () => {
    expect(checkCronSecret("비밀값", "비밀값")).toBe(true);
  });

  it("틀리면 거절", () => {
    expect(checkCronSecret("틀린값", "비밀값")).toBe(false);
  });

  // 설정이 없으면 잠긴다 — 열어 두면 아무나 게시를 돌릴 수 있다.
  it("서버에 비밀이 설정돼 있지 않으면 거절한다", () => {
    expect(checkCronSecret("무엇이든", undefined)).toBe(false);
    expect(checkCronSecret("무엇이든", "")).toBe(false);
  });

  it("안 주면 거절", () => {
    expect(checkCronSecret(null, "비밀값")).toBe(false);
    expect(checkCronSecret("", "비밀값")).toBe(false);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/schedule-claim.test.ts src/lib/cron-auth.test.ts`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: 구현한다**

```ts
// src/lib/schedule-claim.ts
/**
 * 이 항목을 지금 올려도 되는가.
 *
 * **한계**: Blob 에는 원자적 비교-교환이 없다. 두 tick 이 같은 순간에 읽으면 둘 다 찜하고
 * 둘 다 올릴 수 있다 — cron 이 하나라 현실적 위험은 낮지만 0은 아니다.
 */
export const CLAIM_STALE_MS = 10 * 60 * 1000;

export function canClaim(item: { status: string; claimedAt?: number }, now: number): boolean {
  if (item.status === "pending") return true;
  // 함수가 도중에 죽으면 `publishing` 인 채 남는다. 오래되면 풀어 준다.
  if (item.status !== "publishing") return false;
  return item.claimedAt === undefined || now - item.claimedAt >= CLAIM_STALE_MS;
}
```

```ts
// src/lib/cron-auth.ts
import { safeEqual } from "./auth";

/** 설정이 없으면 **잠기는 쪽으로** 실패한다 — 열어 두면 아무나 게시를 돌릴 수 있다. */
export function checkCronSecret(given: string | null, expected: string | undefined): boolean {
  if (!expected || !given) return false;
  return safeEqual(given, expected);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/schedule-claim.test.ts src/lib/cron-auth.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/schedule-claim.ts src/lib/schedule-claim.test.ts src/lib/cron-auth.ts src/lib/cron-auth.test.ts
git commit -m "feat: 예약 찜 판정과 cron 비밀 검사"
```

---

### Task 2: Blob 위의 큐 (`schedule-store`)

**Files** — Create: `src/lib/schedule-store.ts`, `src/lib/schedule-store.test.ts`

**Consumes:** Task 1 의 `canClaim`(여기서는 안 쓴다. Task 4 가 쓴다)

**Produces:**
- `ScheduledItem` — `{ id, scheduledAt, caption, keyword, imageUrls: string[], status, createdAt, updatedAt?, message?, claimedAt? }`
- `itemPath(id: string): string` → `scheduled/<id>/item.json`
- `imagePath(id: string, index: number): string` → `scheduled/<id>/<n>.png`
- `parseItem(raw: unknown): ScheduledItem | null`
- `putItem(item: ScheduledItem): Promise<void>`
- `listItems(): Promise<ScheduledItem[]>`
- `putImages(id: string, images: Buffer[]): Promise<string[]>`
- `deleteImages(id: string): Promise<void>`
- `deleteItem(id: string): Promise<void>`

- [ ] **Step 1: 순수 함수의 실패하는 테스트를 쓴다**

경로와 파싱만 테스트한다. 나머지는 Blob 을 타므로 Task 4·5 에서 `vi.mock` 으로 덮는다.

```ts
import { describe, expect, it } from "vitest";
import { imagePath, itemPath, parseItem } from "./schedule-store";

describe("경로", () => {
  it("항목과 이미지가 같은 폴더를 쓴다", () => {
    expect(itemPath("a1")).toBe("scheduled/a1/item.json");
    expect(imagePath("a1", 0)).toBe("scheduled/a1/1.png");
    expect(imagePath("a1", 9)).toBe("scheduled/a1/10.png");
  });
});

describe("parseItem", () => {
  const ok = {
    id: "a1",
    scheduledAt: 1800000000000,
    caption: "캡션",
    keyword: "수원 갈비",
    imageUrls: ["https://blob.example/scheduled/a1/1.png"],
    status: "pending",
    createdAt: 1700000000000,
  };

  it("모양이 맞으면 값을 돌려준다", () => {
    expect(parseItem(ok)?.id).toBe("a1");
  });

  // 저장소가 깨졌을 때 목록 전체가 터지면 안 된다 — 그 항목만 빠진다.
  it("모양이 아니면 null", () => {
    expect(parseItem(null)).toBeNull();
    expect(parseItem({ ...ok, status: "몰라" })).toBeNull();
    expect(parseItem({ ...ok, imageUrls: "하나" })).toBeNull();
    expect(parseItem({ ...ok, scheduledAt: "언젠가" })).toBeNull();
  });

  it("publishing 과 claimedAt 을 받는다", () => {
    const item = parseItem({ ...ok, status: "publishing", claimedAt: 123 });
    expect(item?.status).toBe("publishing");
    expect(item?.claimedAt).toBe(123);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/schedule-store.test.ts` → FAIL(`Cannot find module`)

- [ ] **Step 3: 구현한다**

```ts
import { del, list, put } from "@vercel/blob";
import { z } from "zod/v4";

/**
 * 예약 큐 — **Blob 에 둔다. 항목 하나가 파일 하나다.**
 *
 * 한 파일에 모아 두면 상태를 바꿀 때 읽고-고치고-쓰는 사이에 다른 요청이 끼어든다.
 * 항목마다 따로 두면 그 경합이 없다.
 */
const ItemSchema = z.object({
  id: z.string().min(1),
  scheduledAt: z.number(),
  caption: z.string(),
  keyword: z.string(),
  imageUrls: z.array(z.string()),
  status: z.enum(["pending", "publishing", "published", "failed", "missed", "canceled"]),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
  message: z.string().optional(),
  claimedAt: z.number().optional(),
});

export type ScheduledItem = z.infer<typeof ItemSchema>;

const ROOT = "scheduled";

export function itemDir(id: string): string {
  return `${ROOT}/${id}/`;
}
export function itemPath(id: string): string {
  return `${itemDir(id)}item.json`;
}
export function imagePath(id: string, index: number): string {
  return `${itemDir(id)}${index + 1}.png`;
}

/** 모양이 다르면 `null` — 그 항목만 빠지고 목록 전체는 살아 있어야 한다. */
export function parseItem(raw: unknown): ScheduledItem | null {
  const parsed = ItemSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const PUT = { access: "public", addRandomSuffix: false, allowOverwrite: true } as const;

export async function putItem(item: ScheduledItem): Promise<void> {
  await put(itemPath(item.id), JSON.stringify(item), { ...PUT, contentType: "application/json" });
}

export async function putImages(id: string, images: Buffer[]): Promise<string[]> {
  const uploaded = await Promise.all(
    images.map((buf, i) => put(imagePath(id, i), buf, { ...PUT, contentType: "image/png" })),
  );
  return uploaded.map((b) => b.url);
}

export async function listItems(): Promise<ScheduledItem[]> {
  const { blobs } = await list({ prefix: `${ROOT}/` });
  const metas = blobs.filter((b) => b.pathname.endsWith("/item.json"));
  const items = await Promise.all(
    metas.map(async (b) => {
      const res = await fetch(b.url, { cache: "no-store" });
      if (!res.ok) return null;
      return parseItem(await res.json().catch(() => null));
    }),
  );
  return items.filter((i): i is ScheduledItem => i !== null);
}

/** 올렸거나 취소했으면 사진만 지운다 — `item.json` 은 기록으로 남긴다. */
export async function deleteImages(id: string): Promise<void> {
  const { blobs } = await list({ prefix: itemDir(id) });
  const pngs = blobs.filter((b) => b.pathname.endsWith(".png"));
  if (pngs.length > 0) await del(pngs.map((b) => b.url));
}

/** 기록까지 통째로 지운다(취소 후 목록에서 지우기). */
export async function deleteItem(id: string): Promise<void> {
  const { blobs } = await list({ prefix: itemDir(id) });
  if (blobs.length > 0) await del(blobs.map((b) => b.url));
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/schedule-store.test.ts` → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/schedule-store.ts src/lib/schedule-store.test.ts
git commit -m "feat: 예약 큐를 Blob 에 두는 저장소"
```

---

### Task 3: 심장박동을 Blob 으로

**Files** — Modify: `src/lib/scheduler-health.ts`, `src/lib/scheduler-health.test.ts`

**Produces:** `writeHeartbeat(now: number): Promise<void>`, `readHeartbeat(): Promise<number | null>`
(`root` 인자가 사라지고 비동기가 된다. `schedulerHealth(lastTickAt, now)` 순수 판정은 **그대로**)

- [ ] **Step 1: 순수 판정 테스트는 그대로 두고, 파일 기반 테스트만 지운다**

`schedulerHealth` 를 검증하는 테스트는 손대지 않는다 — 판정은 안 바뀐다. `writeHeartbeat`/
`readHeartbeat` 가 임시 폴더를 쓰던 테스트만 지운다(Blob 은 Task 5 에서 mock 으로 덮는다).

- [ ] **Step 2: 구현한다**

```ts
import { list, put } from "@vercel/blob";

const HEARTBEAT_PATH = "scheduled/heartbeat.json";

/** 대기 항목이 없어도 남긴다 — 궁금한 것은 "올릴 게 있나"가 아니라 "시계가 도나"다. */
export async function writeHeartbeat(now: number): Promise<void> {
  await put(HEARTBEAT_PATH, JSON.stringify({ lastTickAt: now }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function readHeartbeat(): Promise<number | null> {
  const { blobs } = await list({ prefix: HEARTBEAT_PATH });
  const found = blobs.find((b) => b.pathname === HEARTBEAT_PATH);
  if (!found) return null;
  const res = await fetch(found.url, { cache: "no-store" });
  if (!res.ok) return null;
  const raw: unknown = await res.json().catch(() => null);
  const at = typeof raw === "object" && raw !== null ? (raw as { lastTickAt?: unknown }).lastTickAt : null;
  return typeof at === "number" ? at : null;
}
```

`HEARTBEAT_STALE_MS` 와 `schedulerHealth` 는 그대로 둔다. 다만 `TICK_MS` 의 뜻이 "우리
타이머 간격" 에서 "cron 이 부르는 간격" 으로 바뀌므로 주석을 고친다.

- [ ] **Step 3: 확인하고 커밋**

Run: `npx vitest run src/lib/scheduler-health.test.ts` → PASS

```bash
git add src/lib/scheduler-health.ts src/lib/scheduler-health.test.ts
git commit -m "feat: 심장박동을 Blob 에 남긴다"
```

---

### Task 4: 실행기가 항목의 `imageUrls` 를 쓴다

**Files** — Modify: `src/lib/schedule-runner.ts`, `src/lib/schedule-runner.test.ts`

**Consumes:** Task 2 의 `ScheduledItem`

**Produces:** `runScheduledItem(item: ScheduledItem, deps: { now: number; publish?; publishSingle? }): Promise<RunResult>`
(`root` 가 사라진다. 디스크를 안 읽는다)

- [ ] **Step 1: 테스트를 고친다 — 디스크 대신 항목이 주소를 들고 온다**

`saveImages(...)` 로 디스크에 심던 준비를 없애고, `item()` 헬퍼가 `imageUrls` 를 갖게 한다.

```ts
function item(over: Partial<ScheduledItem> = {}): ScheduledItem {
  return {
    id: "a1",
    scheduledAt: 1_800_000_000_000,
    caption: "캡션 #살림",
    keyword: "수원 갈비",
    imageUrls: ["https://blob.example/scheduled/a1/1.png", "https://blob.example/scheduled/a1/2.png"],
    status: "pending",
    createdAt: 1_700_000_000_000,
    ...over,
  };
}
```

그리고 이 테스트를 **새로 추가한다** — 재업로드가 사라졌다는 것을 못 박는다:

```ts
it("항목이 들고 있는 주소를 그대로 인스타에 넘긴다 — 다시 올리지 않는다", async () => {
  let seen: string[] = [];
  const publish = vi.fn(async (args: { imageUrls: string[] }) => {
    seen = args.imageUrls;
    return "media-1";
  });

  await runScheduledItem(item(), { now: 1, publish });

  expect(seen).toEqual([
    "https://blob.example/scheduled/a1/1.png",
    "https://blob.example/scheduled/a1/2.png",
  ]);
});
```

- [ ] **Step 2: 실패를 확인한다** — `npx vitest run src/lib/schedule-runner.test.ts`

- [ ] **Step 3: 구현한다**

`loadImages`·`createShareToken`·`saveShare` 호출을 지우고 `item.imageUrls` 를 그대로 쓴다.
장수 판정은 `publishKindFor(item.imageUrls.length)`.

- [ ] **Step 4: 통과를 확인하고 커밋**

```bash
git add src/lib/schedule-runner.ts src/lib/schedule-runner.test.ts
git commit -m "feat: 예약 실행기가 이미지를 다시 올리지 않는다"
```

---

### Task 5: cron 입구 (`/api/cron/tick`)

**Files** — Create: `src/app/api/cron/tick/route.ts`, `src/app/api/cron/tick/route.test.ts` ·
Modify: `src/lib/auth.ts`, `src/lib/auth.test.ts`

**Consumes:** Task 1 `canClaim`·`checkCronSecret`, Task 2 `listItems`·`putItem`·`deleteImages`,
Task 3 `writeHeartbeat`, Task 4 `runScheduledItem`

- [ ] **Step 1: 공개 경로 테스트를 먼저 쓴다 (RED)**

`src/lib/auth.test.ts` 의 `isPublicPath` describe 에 넣는다:

```ts
// cron 서비스는 로그인할 수 없다. 대신 CRON_SECRET 이 막는다(`@/lib/cron-auth`).
it("cron 입구는 연다", () => {
  expect(isPublicPath("/api/cron/tick")).toBe(true);
});

it("이름만 비슷한 경로는 막는다", () => {
  expect(isPublicPath("/api/cronhack")).toBe(false);
});
```

- [ ] **Step 2: 실패를 확인하고 `auth.ts` 에 `"/api/cron/"` 을 `PUBLIC_PREFIXES` 에 넣는다**

- [ ] **Step 3: 라우트 테스트를 쓴다 (RED)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/cron/tick/route";
import type { ScheduledItem } from "@/lib/schedule-store";

// Blob 은 네트워크다 — node 환경 테스트에서 바깥을 타면 안 된다.
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
const runMock = vi.fn(async () => ({ ok: true, mediaId: "media-1" }) as const);
vi.mock("@/lib/schedule-runner", () => ({ runScheduledItem: (...a: unknown[]) => runMock(...(a as [])) }));

const NOW = 1_800_000_000_000;
function pending(over: Partial<ScheduledItem> = {}): ScheduledItem {
  return {
    id: "a1",
    scheduledAt: NOW - 1000,
    caption: "캡션",
    keyword: "수원 갈비",
    imageUrls: ["https://blob.example/scheduled/a1/1.png"],
    status: "pending",
    createdAt: NOW - 100000,
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
  process.env.CRON_SECRET = "올바른비밀값";
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});

it("비밀이 틀리면 401 이고 무엇도 올리지 않는다", async () => {
  stored = [pending()];
  const res = await call("틀린값");
  expect(res.status).toBe(401);
  expect(runMock).not.toHaveBeenCalled();
  expect(beats).toBe(0);
});

it("비밀이 맞으면 심장박동을 남긴다 — 올릴 게 없어도", async () => {
  const res = await call("올바른비밀값");
  expect(res.status).toBe(200);
  expect(beats).toBe(1);
});

it("한 번에 하나만 올린다 — 밀려 있어도", async () => {
  stored = [pending({ id: "늦은것", scheduledAt: NOW - 500 }), pending({ id: "빠른것", scheduledAt: NOW - 5000 })];
  await call("올바른비밀값");
  expect(runMock).toHaveBeenCalledTimes(1);
  // 가장 먼저 예약된 것부터
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

it("한 시간 넘게 지난 것은 missed 로 표시하고 사진을 지운다", async () => {
  stored = [pending({ scheduledAt: NOW - 2 * 60 * 60 * 1000 })];
  await call("올바른비밀값");
  expect(runMock).not.toHaveBeenCalled();
  expect(puts[0].status).toBe("missed");
  expect(puts[0].message).toMatch(/[가-힣]/);
  expect(deleted).toContain("a1");
});

it("게시에 실패하면 failed 와 한국어 사유를 남기고 사진은 지우지 않는다", async () => {
  stored = [pending()];
  runMock.mockResolvedValueOnce({ ok: false, message: "인스타그램이 거절했어요." } as never);
  await call("올바른비밀값");
  const last = puts[puts.length - 1];
  expect(last.status).toBe("failed");
  expect(last.message).toBe("인스타그램이 거절했어요.");
  expect(deleted).not.toContain("a1");
});
```

- [ ] **Step 4: 라우트를 구현한다**

```ts
import { checkCronSecret } from "@/lib/cron-auth";
import { canClaim } from "@/lib/schedule-claim";
import { deleteImages, listItems, putItem } from "@/lib/schedule-store";
import { writeHeartbeat } from "@/lib/scheduler-health";
import { dueVerdict } from "@/lib/schedule-due";
import { runScheduledItem } from "@/lib/schedule-runner";

/**
 * 밖에서 1분마다 두드리는 입구(cron-job.org).
 *
 * 로그인 예외지만 `CRON_SECRET` 이 막는다 — 설정이 없으면 아무도 못 들어온다.
 * **한 번에 하나만 올린다**: Vercel 함수는 300초에서 끊기고, 캐러셀 한 건이 1~2분 걸린다.
 * 밀린 것은 다음 분에 빠진다 — 끊기는 것보다 늦는 편이 낫다.
 */
export async function GET(req: Request) {
  const given = new URL(req.url).searchParams.get("secret");
  if (!checkCronSecret(given, process.env.CRON_SECRET)) {
    return Response.json({ error: "권한이 없어요." }, { status: 401 });
  }

  const now = Date.now();
  await writeHeartbeat(now);

  const items = await listItems();
  const ready = items
    .filter((i) => canClaim(i, now))
    .map((i) => ({ item: i, verdict: dueVerdict(i.scheduledAt, now) }));

  for (const { item, verdict } of ready.filter((r) => r.verdict === "missed")) {
    await putItem({ ...item, status: "missed", message: "예약 시각을 한 시간 넘게 지나 올리지 않았어요.", updatedAt: now });
    await deleteImages(item.id);
  }

  const due = ready.filter((r) => r.verdict === "due").map((r) => r.item).sort((a, b) => a.scheduledAt - b.scheduledAt);
  const target = due[0];
  if (!target) return Response.json({ ok: true, published: 0, waiting: due.length });

  // **인스타를 부르기 전에** 찜한다 — 다음 tick 이 같은 것을 집으면 두 번 올라간다.
  await putItem({ ...target, status: "publishing", claimedAt: now, updatedAt: now });

  const result = await runScheduledItem(target, { now });
  await putItem({
    ...target,
    status: result.ok ? "published" : "failed",
    message: result.ok ? undefined : result.message,
    updatedAt: Date.now(),
  });
  if (result.ok) await deleteImages(target.id);

  return Response.json({ ok: true, published: result.ok ? 1 : 0, remaining: due.length - 1 });
}
```

- [ ] **Step 5: 통과를 확인하고 커밋**

```bash
git add src/app/api/cron src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: 밖에서 부르는 cron 입구"
```

---

### Task 6: `/api/schedule` 을 Blob 으로 옮기고 옛 모듈을 지운다

**Files** — Modify: `src/app/api/schedule/route.ts`, `src/app/api/schedule/route.test.ts`,
`src/instrumentation.ts` · Delete: `src/lib/schedule-queue.ts`(+테스트),
`src/lib/schedule-scheduler.ts`(+테스트)

- [ ] **Step 1: 라우트 테스트를 고친다 — Blob 을 mock 으로**

`POST` 는 `putImages` → `putItem` 순서여야 한다. **사진을 먼저 굳히고 큐에 넣는다** — 반대로
하면 tick 이 사진 없는 항목을 본다. 이 순서를 테스트로 못 박는다:

```ts
const order: string[] = [];
vi.mock("@/lib/schedule-store", () => ({
  putImages: vi.fn(async (id: string, images: Buffer[]) => {
    order.push("putImages");
    return images.map((_, i) => `https://blob.example/scheduled/${id}/${i + 1}.png`);
  }),
  putItem: vi.fn(async () => {
    order.push("putItem");
  }),
  listItems: vi.fn(async () => []),
  deleteImages: vi.fn(async () => undefined),
  deleteItem: vi.fn(async () => undefined),
}));

it("사진을 먼저 올리고 나서 항목을 넣는다", async () => {
  order.length = 0;
  // 1×1 짜리 진짜 PNG — 라우트가 내용까지 본다(`isPngBuffer`).
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ).toString("base64");

  const res = await POST(
    new Request("http://x/api/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        keyword: "수원 갈비",
        caption: "캡션",
        hashtags: [],
        scheduledAt: Date.now() + 600_000,
        images: [png],
      }),
    }),
  );

  expect(res.status).toBe(200);
  expect(order).toEqual(["putImages", "putItem"]);
});
```

- [ ] **Step 2: 라우트를 고친다**

- `GET`: `listItems()` → 정렬 → `imageCount: i.imageUrls.length` 로 **응답 모양 유지**,
  `scheduler: schedulerHealth(await readHeartbeat(), now)`
- `POST`: `putImages(id, images)` → 받은 주소로 `putItem(...)`
- `DELETE`: 취소는 `putItem({...item, status: "canceled"})` + `deleteImages(id)`,
  기록 지우기는 `deleteItem(id)`

- [ ] **Step 3: 옛 모듈을 지우고 기동 훅에서 스케줄러를 뺀다**

```bash
git rm src/lib/schedule-queue.ts src/lib/schedule-queue.test.ts \
       src/lib/schedule-scheduler.ts src/lib/schedule-scheduler.test.ts
```

`src/instrumentation.ts` 에서 `startScheduler()` 블록을 지우고, **왜 없어졌는지** 주석에
남긴다 — 토큰 자동 갱신 블록은 그대로 둔다.

- [ ] **Step 4: 전체 검증 후 커밋**

```bash
npx vitest run && npx tsc --noEmit | wc -c && npm run design:audit
git add -u src/ && git add src/app/api/cron
git commit -m "feat: 예약 큐를 Blob 으로 옮기고 프로세스 타이머를 걷어낸다"
```

---

### Task 7: 배포하고 cron 을 붙인다 — 실측

**Files** — Modify: `docs/deploy-setup.md`, `.env.example`

- [ ] **Step 1: [나] `CRON_SECRET` 을 만들어 Vercel 에 넣는다**

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

`.env.local` 과 Vercel(production·preview)에 `CRON_SECRET` 으로 넣는다. **값을 대화에 남기지
않는다** — 파일에서 읽어 그대로 넘긴다.

- [ ] **Step 2: [나] 배포하고 비밀 검사를 확인한다**

```bash
npx vercel deploy --prod
# 비밀 없이 → 401 이어야 한다
curl -s -o /dev/null -w "%{http_code}\n" https://repick-cardnews.vercel.app/api/cron/tick
# 맞는 비밀로 → 200 이어야 한다
```

- [ ] **Step 3: [사람] cron-job.org 에 등록한다**

- 주소: `https://repick-cardnews.vercel.app/api/cron/tick?secret=<CRON_SECRET>`
- 간격: **1분마다**
- 저장 후 실행 이력에서 200 이 찍히는지 확인

- [ ] **Step 4: [나] 심장박동이 갱신되는지 본다**

`/api/schedule` 의 `scheduler` 가 `alive` 여야 한다.

- [ ] **Step 5: [사람] 실제로 2~3분 뒤로 예약해서 인스타에 올라가는지 본다**

**이것이 성공 기준이다.** 나머지는 전부 이걸 위한 준비다.

- [ ] **Step 6: [나] 문서를 고친다**

`docs/deploy-setup.md` 의 "안 되는 것" 에서 예약 발행을 빼고, cron 설정과 **중복 게시 한계**를
적는다. `.env.example` 에 `CRON_SECRET` 을 넣는다.

```bash
git add docs/deploy-setup.md .env.example
git commit -m "docs: 예약 발행 cron 설정과 한계"
```

---

## 사람이 확인해야 하는 것

- **예약한 사진이 실제로 인스타에 올라가는가** (Task 7) — 성공 기준
- cron-job.org 실행 이력에 200 이 꾸준히 찍히는가

## 멈춰야 하는 지점

- **Task 5 에서 비밀 없이 200 이 나오면** — cron 입구가 열려 있다. 고치기 전에 배포하지 않는다
- **같은 사진이 두 번 올라가면** — 찜 판정을 다시 본다. 설계의 한계가 현실이 된 것이다

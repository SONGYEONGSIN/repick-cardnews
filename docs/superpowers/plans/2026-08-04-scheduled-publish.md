# 예약 발행 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 만든 카드를 정해 둔 시각에 인스타그램에 자동으로 올린다.

**Architecture:** 예약하면 렌더된 PNG 를 **디스크에 고정**하고 큐 파일에 항목을 남긴다. 서버 기동 훅(`instrumentation.register()`)이 스케줄러를 켜고 1분마다 도래한 항목을 확인한다. 도래하면 디스크 이미지로 **공유 토큰을 새로 발급**하고, `.env.local` 에서 `PUBLIC_BASE_URL` 을 **다시 읽어**, 터널이 실제로 닿는지 확인한 뒤 기존 `publishCarousel` 경로로 올린다.

**Tech Stack:** Next.js App Router, TypeScript, zod v4, node:fs, vitest(`environment: "node"`)

## Global Constraints

- **한국어만.** 모든 오류·상태 문구는 한국어. 영문·raw JSON 이 사용자에게 닿으면 안 된다. `inKorean(raw, fallback)`(`@/features/cardnews/screens/errors`) 을 쓴다.
- **비밀값 금지.** 액세스 토큰·시크릿을 **큐 파일·응답·로그 어디에도** 담지 않는다. 게시 시점에 `.env.local` 에서 읽는다.
- **`.env.local` 을 읽기만 한다.** 이 기능은 그 파일을 **쓰지 않는다**(토큰 갱신만 쓴다). 값을 로그·보고서에 옮기지 마라.
- **`git add -A` 금지.** 브리프에 적힌 경로만. `.repick/` 는 `.gitignore` 에 넣는다 — 카드 이미지가 저장소에 올라가면 안 된다.
- **로컬 전용**: 새 API 는 `isLocalHost(req.headers.get("host"))` 로 막고 실패 시 403 + 한국어. 가드가 **다른 처리보다 앞**에 온다.
- **실제 인스타 게시를 자동 테스트로 하지 마라.** 진짜로 올라간다. 스케줄러가 게시 함수를 부르는지까지만 mock 으로 확인하고, 실제 게시는 Task 6 에서 사람이 한 번 예약해 확인한다.
- **시각을 인자로 받아라.** `Date.now()` 를 함수 안에서 부르면 테스트할 수 없다. 도래 판정·유예 계산은 `now: number` 를 받는 순수 함수로 만든다.
- **화면은 `docs/ui-standards.md` 를 따른다** — `SectionHead` 골격, `max-w` 로 폭을 비우지 않기, 2단은 `grid gap-6 xl:grid-cols-2 xl:items-start`.
- `any`·`@ts-ignore`·`eslint-disable`·`console.*` 금지. 미사용 import 금지.
- **RED 먼저.** 테스트를 쓰고 실패를 실행으로 확인한 뒤 구현한다.

### 확인된 기존 인터페이스 — 그대로 쓴다

| 무엇 | 어디 |
|---|---|
| `publishCarousel({ config, imageUrls, caption }, sleep?, onProgress?): Promise<string>` | `@/lib/instagram` |
| `friendlyPublishError(e)`, `CAROUSEL_MIN_ITEMS`(2), `CAROUSEL_MAX_ITEMS`(10) | `@/lib/instagram` |
| `buildCarouselImageUrls(publicBaseUrl, token, count)` | `@/lib/instagram` |
| `checkInstagramConfig(env): { ready: true, config } \| { ready: false, missing }` | `@/lib/instagram-config` |
| `saveShare(token, { images: Buffer[], keyword, issuedAt })`, `loadShare(token, now)` | `@/lib/share-store` |
| `createShareToken()`, `SHARE_TOKEN_TTL_MS`(30분) | `@/lib/share-token` |
| `combineCaptionWithHashtags(caption, hashtags)`, `MAX_HASHTAGS`(5) | `@/lib/hashtags` |
| `defaultEnvLocalPath()` — `path.join(process.cwd(), ".env.local")` | `@/lib/instagram-token-refresh-runtime` |
| `isLocalHost(host)` | `@/lib/local-guard` |
| `register()` 서버 기동 훅 | `src/instrumentation.ts` |

### 설계에서 정해진 값

| 항목 | 값 | 이유 |
|---|---|---|
| 유예 시간 | **1시간** | 잠시 껐던 경우는 구제, 새벽에 켰다가 어제 예약이 올라가는 건 막는다(사용자 결정) |
| 확인 주기 | **1분** | 분 단위 예약이면 충분하다 |
| 저장 위치 | `.repick/scheduled/<id>/N.png` + `.repick/scheduled/queue.jsonl` | 메모리 저장소는 30분 만료 + 재시작에 사라진다 |
| 상태 | `pending` `published` `failed` `missed` `canceled` | |

---

## File Structure

**신규**
- `src/lib/schedule-queue.ts` — 큐 파일 읽기·쓰기, 상태 전이 (순수에 가깝게, 경로를 인자로)
- `src/lib/schedule-queue.test.ts`
- `src/lib/schedule-due.ts` — 도래 판정(유예 포함). **완전 순수**
- `src/lib/schedule-due.test.ts`
- `src/lib/schedule-runner.ts` — 도래 항목 하나를 실제로 게시하는 절차
- `src/lib/schedule-runner.test.ts`
- `src/lib/schedule-scheduler.ts` — 1분 타이머. `instrumentation` 이 켠다
- `src/app/api/schedule/route.ts` — `GET`(목록) · `POST`(예약) · `DELETE`(취소)
- `src/app/api/schedule/route.test.ts`
- `src/features/cardnews/screens/SchedulePanel.tsx` — 내보내기의 인스타 방법 안

**수정**
- `src/instrumentation.ts` — 스케줄러 기동
- `src/features/cardnews/screens/InstagramPublishPanel.tsx` — 예약 패널 자리
- `.gitignore` — `.repick/`

---

### Task 1: 도래 판정 (순수 함수)

**Files:**
- Create: `src/lib/schedule-due.ts`, `src/lib/schedule-due.test.ts`

**Interfaces:**
- Produces:
  - `GRACE_MS = 60 * 60 * 1000`
  - `type DueVerdict = "wait" | "due" | "missed"`
  - `dueVerdict(scheduledAt: number, now: number): DueVerdict`
  - `describeSchedule(scheduledAt: number, now: number): string` — 사람이 읽을 한 줄

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, it, expect } from "vitest";
import { GRACE_MS, describeSchedule, dueVerdict } from "./schedule-due";

const T = new Date("2026-08-04T09:00:00+09:00").getTime();

describe("dueVerdict — 유예 1시간", () => {
  it("아직 시각 전이면 기다린다", () => {
    expect(dueVerdict(T, T - 1)).toBe("wait");
  });

  it("시각이 되면 올린다", () => {
    expect(dueVerdict(T, T)).toBe("due");
  });

  it("유예 안이면 늦게라도 올린다 — 잠시 껐던 경우를 구제한다", () => {
    expect(dueVerdict(T, T + GRACE_MS - 1)).toBe("due");
  });

  it("유예를 넘기면 놓친 것으로 둔다 — 새벽에 어제 예약이 올라가면 안 된다", () => {
    expect(dueVerdict(T, T + GRACE_MS)).toBe("missed");
    expect(dueVerdict(T, T + GRACE_MS * 5)).toBe("missed");
  });

  it("유예는 1시간이다(사용자가 정한 값)", () => {
    expect(GRACE_MS).toBe(60 * 60 * 1000);
  });
});

describe("describeSchedule — 한국어 한 줄", () => {
  it("남은 시간을 말한다", () => {
    const line = describeSchedule(T, T - 90 * 60 * 1000);
    expect(line).toContain("뒤");
    expect(line).not.toMatch(/[A-Za-z]/);
  });

  it("지난 예약은 지났다고 말한다", () => {
    const line = describeSchedule(T, T + 5 * 60 * 1000);
    expect(line).toContain("지났");
    expect(line).not.toMatch(/[A-Za-z]/);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/schedule-due.test.ts` → 모듈 없음

- [ ] **Step 3: 구현**

```ts
/**
 * 예약 도래 판정 — **완전 순수 함수**다. `Date.now()` 를 부르지 않고 `now` 를 받는다.
 * 시각에 기대는 로직을 테스트할 수 있는 유일한 방법이다.
 *
 * 유예 1시간은 사용자가 정한 값이다: 서버가 잠시 꺼져 있었던 경우는 늦게라도 올리되,
 * 새벽에 켰다가 어제 낮 예약이 올라가는 일은 막는다.
 */
export const GRACE_MS = 60 * 60 * 1000;

export type DueVerdict = "wait" | "due" | "missed";

export function dueVerdict(scheduledAt: number, now: number): DueVerdict {
  if (now < scheduledAt) return "wait";
  return now - scheduledAt < GRACE_MS ? "due" : "missed";
}

function minutesBetween(a: number, b: number): number {
  return Math.max(0, Math.round(Math.abs(a - b) / 60000));
}

/** "3시간 20분 뒤" / "5분 지났어요" 처럼. 화면에 그대로 나가므로 한국어만. */
export function describeSchedule(scheduledAt: number, now: number): string {
  const mins = minutesBetween(scheduledAt, now);
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  const span = hours > 0 ? (rest > 0 ? `${hours}시간 ${rest}분` : `${hours}시간`) : `${rest}분`;
  return now < scheduledAt ? `${span} 뒤에 올라가요` : `${span} 지났어요`;
}
```

- [ ] **Step 4: 통과 확인** — `npx vitest run && npx tsc --noEmit`

- [ ] **Step 5: 커밋**

```bash
git add src/lib/schedule-due.ts src/lib/schedule-due.test.ts
git commit -m "feat: 예약 도래 판정(유예 1시간)"
```

---

### Task 2: 큐 파일

**Files:**
- Create: `src/lib/schedule-queue.ts`, `src/lib/schedule-queue.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  - `type ScheduleStatus = "pending" | "published" | "failed" | "missed" | "canceled"`
  - `type ScheduleItem = { id: string; scheduledAt: number; caption: string; imageCount: number; keyword: string; status: ScheduleStatus; createdAt: number; message?: string }`
  - `scheduleRoot(): string` — `path.join(process.cwd(), ".repick", "scheduled")`
  - `readQueue(root?: string): ScheduleItem[]`
  - `appendItem(item: ScheduleItem, root?: string): void`
  - `updateStatus(id: string, status: ScheduleStatus, message: string | undefined, root?: string): void`
  - `saveImages(id: string, images: Buffer[], root?: string): void`
  - `loadImages(id: string, root?: string): Buffer[]`
  - `removeImages(id: string, root?: string): void`

**주의**: 큐는 **JSONL 이고 마지막 줄이 이긴다**(같은 id 가 여러 줄일 수 있다). `readQueue` 가 id 별로 마지막 줄만 남겨 돌려준다 — append-only 라 쓰는 쪽이 단순하고, 중간에 죽어도 앞줄이 온전하다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  appendItem,
  loadImages,
  readQueue,
  removeImages,
  saveImages,
  updateStatus,
  type ScheduleItem,
} from "./schedule-queue";

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "repick-sched-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function item(over: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "a1",
    scheduledAt: 1_800_000_000_000,
    caption: "캡션",
    imageCount: 5,
    keyword: "수원 갈비",
    status: "pending",
    createdAt: 1_700_000_000_000,
    ...over,
  };
}

describe("큐 파일", () => {
  it("아직 파일이 없으면 빈 목록이다 — 처음 쓰는 사람에게 오류를 던지지 않는다", () => {
    expect(readQueue(root)).toEqual([]);
  });

  it("넣은 항목을 그대로 읽는다", () => {
    appendItem(item(), root);
    expect(readQueue(root)).toEqual([item()]);
  });

  it("같은 id 가 여러 줄이면 마지막 줄이 이긴다 — append-only 로 상태를 바꾼다", () => {
    appendItem(item(), root);
    updateStatus("a1", "published", undefined, root);

    const queue = readQueue(root);
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe("published");
  });

  it("실패 사유를 함께 남긴다", () => {
    appendItem(item(), root);
    updateStatus("a1", "failed", "터널에 닿지 못했어요.", root);

    expect(readQueue(root)[0].message).toBe("터널에 닿지 못했어요.");
  });

  it("깨진 줄은 건너뛰고 나머지를 읽는다 — 한 줄 때문에 전체를 잃지 않는다", () => {
    appendItem(item(), root);
    appendItem(item({ id: "b2" }), root);
    // 중간에 죽어 반쯤 쓰인 줄을 흉내 낸다
    const file = path.join(root, "queue.jsonl");
    const fs = require("node:fs") as typeof import("node:fs");
    fs.appendFileSync(file, '{"id":"c3","scheduled\n', "utf8");

    expect(readQueue(root).map((i) => i.id)).toEqual(["a1", "b2"]);
  });

  it("이미지를 저장하고 그대로 읽는다", () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);

    expect(loadImages("a1", root).map((b) => b.toString())).toEqual(["one", "two"]);
  });

  it("이미지를 지우면 폴더가 사라진다", () => {
    saveImages("a1", [Buffer.from("one")], root);
    removeImages("a1", root);

    expect(existsSync(path.join(root, "a1"))).toBe(false);
    expect(loadImages("a1", root)).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현** — `node:fs` 동기 API 를 쓴다(스케줄러가 1분에 한 번 도는 로컬 도구라 비동기로 얻을 게 없다). 파일 상단에 다음을 적는다:

```ts
/**
 * 예약 큐 — **디스크**에 남긴다. 공유 저장소(`@/lib/share-store`)는 프로세스 메모리에 두고
 * 30분이면 만료되므로 몇 시간 뒤 게시에는 쓸 수 없다.
 *
 * 큐는 **JSONL append-only** 다. 상태를 바꿀 때도 줄을 덧붙이고, 읽을 때 id 별로 마지막 줄만
 * 남긴다 — 쓰는 쪽이 단순하고(줄 하나 추가), 중간에 죽어도 앞줄이 온전하다. 깨진 줄은 건너뛴다.
 *
 * **토큰·시크릿을 여기에 담지 않는다.** 게시 시점에 `.env.local` 에서 읽는다.
 */
```

- [ ] **Step 4: `.gitignore` 에 `.repick/` 추가**

카드 이미지가 저장소에 올라가면 안 된다.

- [ ] **Step 5: 통과 확인** — `npx vitest run && npx tsc --noEmit`

- [ ] **Step 6: 커밋**

```bash
git add src/lib/schedule-queue.ts src/lib/schedule-queue.test.ts .gitignore
git commit -m "feat: 예약 큐를 디스크에 남김"
```

---

### Task 3: 게시 절차

**Files:**
- Create: `src/lib/schedule-runner.ts`, `src/lib/schedule-runner.test.ts`

**Interfaces:**
- Consumes: Task 2 전부, `publishCarousel`·`friendlyPublishError`·`buildCarouselImageUrls`(`@/lib/instagram`), `checkInstagramConfig`(`@/lib/instagram-config`), `saveShare`·`createShareToken`
- Produces:
  - `readPublicBaseUrl(envPath?: string): string | null` — **`.env.local` 에서 다시 읽는다**
  - `runScheduledItem(item: ScheduleItem, deps): Promise<{ ok: true; mediaId: string } | { ok: false; message: string }>`
  - `deps` = `{ now: number; root?: string; envPath?: string; fetchImpl?: typeof fetch; publish?: typeof publishCarousel }`

**절차 (순서를 지켜라):**

1. 디스크에서 이미지를 읽는다. 없거나 `CAROUSEL_MIN_ITEMS` 미만이면 실패
2. `checkInstagramConfig(process.env)` — 준비 안 됐으면 실패(무엇이 없는지 한국어로)
3. **`PUBLIC_BASE_URL` 을 `.env.local` 에서 다시 읽는다.** 부팅 시점 `process.env` 값은 터널을 새로 켜면 낡는다. 파일에 있으면 그 값이 이긴다
4. 공유 토큰을 **새로 발급**하고 `saveShare` 로 이미지를 올린다 — 예약 시점 토큰은 이미 만료됐다
5. **터널이 실제로 닿는지 확인한다** — 첫 이미지 주소를 `fetchImpl` 로 부른다. 2xx 가 아니면 게시하지 않고 실패(인스타에 깨진 요청을 보내지 않는다)
6. `publishCarousel` 로 올린다
7. 성공하면 `mediaId`, 실패하면 `friendlyPublishError(e)`

- [ ] **Step 1: 실패하는 테스트 작성**

핵심 케이스만 적는다(전부 mock — 실제 인스타를 부르지 마라):

```ts
describe("runScheduledItem", () => {
  it("터널에 닿지 않으면 게시하지 않고 한국어로 실패한다", async () => { /* fetch 가 502 */ });
  it("이미지가 모자라면 게시하지 않는다", async () => { /* 1장만 저장 */ });
  it("설정이 없으면 무엇이 없는지 한국어로 말한다", async () => { /* env 비움 */ });
  it("정상 경로에서 publishCarousel 을 부르고 mediaId 를 돌려준다", async () => { /* publish mock */ });
  it("게시가 실패하면 한국어 사유를 돌려준다 — 원문·토큰을 노출하지 않는다", async () => { /* publish throw */ });
  it(".env.local 의 PUBLIC_BASE_URL 이 process.env 보다 우선한다", async () => { /* 임시 envPath */ });
});
```

각 테스트에서 **결과 문구에 영문이 없는지**(`expect(res.message).not.toMatch(/[A-Za-z]/)`)와 **토큰 문자열이 안 섞였는지**를 확인해라.

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `npx vitest run && npx tsc --noEmit`. **실제 인스타를 부르지 마라.**
- [ ] **Step 5: 커밋**

```bash
git add src/lib/schedule-runner.ts src/lib/schedule-runner.test.ts
git commit -m "feat: 예약 게시 절차(터널 확인·토큰 재발급 포함)"
```

---

### Task 4: 스케줄러와 기동 훅

**Files:**
- Create: `src/lib/schedule-scheduler.ts`
- Modify: `src/instrumentation.ts`

**Interfaces:**
- Produces:
  - `TICK_MS = 60 * 1000`
  - `tickOnce(now: number, deps?): Promise<void>` — 한 번 훑는다. **테스트 가능한 단위**
  - `startScheduler(): void` — `setInterval` 로 `tickOnce` 를 돈다. 두 번 켜지지 않게 막는다

**규칙:**
- `pending` 만 본다. `dueVerdict` 로 갈라 `due` → 게시, `missed` → `updateStatus(id, "missed", …)`
- **한 번에 하나씩 순차로** 처리한다. 같은 항목이 두 번 올라가지 않게 **처리 중 표시**를 둔다(모듈 스코프 `Set`)
- 성공/실패 뒤 이미지를 지운다(`removeImages`)
- **어떤 실패도 서버를 죽이면 안 된다** — 기동 훅은 이미 그 원칙으로 짜여 있다(토큰 자동 갱신 참고)
- `instrumentation.register()` 에서 `NEXT_RUNTIME === "nodejs"` 일 때만, 동적 `import()` 로 부른다(기존 토큰 갱신과 같은 이유 — `node:fs` 가 edge 번들에 끌려가면 안 된다)

- [ ] **Step 1: `tickOnce` 테스트 작성** (RED)

```ts
it("pending 만 본다 — 이미 올라간 것을 다시 올리지 않는다", ...);
it("도래한 항목을 게시하고 published 로 바꾼다", ...);
it("유예를 넘긴 항목은 게시하지 않고 missed 로 바꾼다", ...);
it("아직 시각 전이면 아무것도 하지 않는다", ...);
it("게시가 실패하면 failed 와 한국어 사유를 남긴다", ...);
it("성공·실패 어느 쪽이든 이미지를 지운다", ...);
it("같은 항목을 두 번 처리하지 않는다 — 처리 중이면 건너뛴다", ...);
```

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: `instrumentation.ts` 배선** — 기존 토큰 갱신 아래에 같은 방식으로 추가. **기존 갱신 로직을 건드리지 마라.**
- [ ] **Step 5: 통과 확인** — `npx vitest run && npx tsc --noEmit`, dev 서버 재시작 후 `/cardnews` 200
- [ ] **Step 6: 커밋**

```bash
git add src/lib/schedule-scheduler.ts src/lib/schedule-scheduler.test.ts src/instrumentation.ts
git commit -m "feat: 예약 스케줄러를 서버 기동 시 켬"
```

---

### Task 5: `/api/schedule`

**Files:**
- Create: `src/app/api/schedule/route.ts`, `src/app/api/schedule/route.test.ts`

**Interfaces:**
- `GET /api/schedule` → `{ items: (ScheduleItem & { describe: string })[] }` — 최신 예약이 먼저
- `POST /api/schedule` — 본문 `{ scheduledAt: number; caption: string; hashtags: string[]; keyword: string; images: string[] }`(base64) → `{ id }`
- `DELETE /api/schedule?id=<id>` → `{ ok: true }` — `pending` 만 취소된다
- 전부 `isLocalHost` 로 막고 실패 시 403 + 한국어

**검증 규칙:**
- `scheduledAt` 이 **과거면 400**(한국어). 지금보다 뒤여야 한다
- 이미지 수가 `CAROUSEL_MIN_ITEMS`~`CAROUSEL_MAX_ITEMS` 밖이면 400
- 해시태그는 `MAX_HASHTAGS` 까지 — 캡션과 합치는 것은 `combineCaptionWithHashtags` 로 **예약 시점에** 끝낸다(게시 시점에 다시 조합하지 않는다. 예약한 그대로가 올라가야 한다)
- zod 로 본문을 검증하고 `issues[0].message` 를 쓴다(이 저장소 관례)

- [ ] **Step 1: 실패하는 테스트 작성** (RED) — 위 규칙 각각 + LAN 403
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** + **실제 `curl` 로 확인**

```bash
# 과거 시각 → 400 한국어
curl -s -X POST localhost:3500/api/schedule -H 'content-type: application/json' \
  -d '{"scheduledAt":1,"caption":"","hashtags":[],"keyword":"테스트","images":[]}'
# LAN → 403
curl -s -o /dev/null -w "%{http_code}\n" "http://$(ifconfig | awk '/inet /{if($2!="127.0.0.1"){print $2; exit}}'):3500/api/schedule"
```

- [ ] **Step 5: 커밋**

---

### Task 6: 화면

**Files:**
- Create: `src/features/cardnews/screens/SchedulePanel.tsx`
- Modify: `src/features/cardnews/screens/InstagramPublishPanel.tsx`

**규칙** — `docs/ui-standards.md` 를 따른다:
- `SectionHead title="예약 발행"` 골격. 제목을 박스 안에 넣지 않는다
- 2단: **왼쪽 = 시각 고르기·안내, 오른쪽 = 예약 목록**
- 인스타 패널의 `ready` 상태 아래에 붙인다 — 예약도 게시의 한 갈래다
- 목록은 예약이 하나라도 있을 때만. `pending` 만 `취소` 버튼
- 상태 문구는 전부 한국어. 실패는 **왜 실패했는지**
- 과거 시각은 고를 수 없게 막는다(`min` 속성 + 서버도 400)

**반드시 적을 한 줄** (지우지 마라):

> 예약한 시각에 **이 컴퓨터가 켜져 있고 dev 서버와 터널이 돌고 있어야** 올라가요.
> 시각을 1시간 넘게 지나면 올리지 않고 "놓침"으로 남겨요.

안 적으면 "예약했으니 됐다"고 믿고 컴퓨터를 끈다. 로컬 앱의 구조적 제약이라 우회할 수 없다.

- [ ] **Step 1: 화면 작성** (렌더 테스트는 불가 — `environment: "node"`)
- [ ] **Step 2: `npx tsc --noEmit` + `npx vitest run`**
- [ ] **Step 3: `npm run design:audit` 27/27**
- [ ] **Step 4: 사람이 실제로 예약해 확인**

**이 기능에서 유일하게 실제 게시가 일어나는 지점이다.** 2~3분 뒤로 한 번 예약해 보고:
- 목록에 `pending` 으로 뜨는가
- 시각이 되면 실제로 올라가고 `published` 로 바뀌는가
- 터널을 끄고 예약하면 **게시 전에** `failed` + "터널에 닿지 못했어요" 가 되는가

- [ ] **Step 5: 커밋**

---

## 사람이 확인해야 하는 것

브라우저가 로컬 dev 서버에 닿지 않아 자동 검증이 불가능하다.

- 예약 → 목록에 뜨고 남은 시간이 맞게 보이는가
- 취소가 되는가(`pending` 만)
- 과거 시각을 고를 수 없는가
- 시각이 되면 **실제로 올라가는가**
- 서버를 껐다 켜도 예약이 살아 있는가(디스크에 남았으므로)
- 유예를 넘긴 예약이 `missed` 로 남는가

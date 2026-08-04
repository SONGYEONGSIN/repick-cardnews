import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod/v4";

/**
 * 예약 큐 — **디스크**에 남긴다. 공유 저장소(`@/lib/share-store`)는 프로세스 메모리에 두고
 * 30분이면 만료되므로 몇 시간 뒤 게시에는 쓸 수 없다.
 *
 * 큐는 **JSONL append-only** 다. 상태를 바꿀 때도 줄을 덧붙이고, 읽을 때 id 별로 마지막 줄만
 * 남긴다 — 쓰는 쪽이 단순하고(줄 하나 추가), 쓰다가 죽어도 앞줄이 온전하다. 깨진 줄과 형태가
 * 어긋난 줄은 건너뛴다: 한 줄 때문에 예약 전체를 잃으면 안 된다.
 *
 * **토큰·시크릿을 여기에 담지 않는다.** 게시 시점에 `.env.local` 에서 읽는다.
 *
 * 동기 API 를 쓴다 — 1분에 한 번 도는 로컬 도구라 비동기로 얻을 게 없고, 스케줄러가 읽고 쓰는
 * 사이에 다른 요청이 끼어드는 창을 줄이는 편이 낫다.
 */

export type ScheduleStatus = "pending" | "published" | "failed" | "missed" | "canceled";

const ScheduleItemSchema = z.object({
  id: z.string().min(1),
  scheduledAt: z.number(),
  caption: z.string(),
  imageCount: z.number(),
  keyword: z.string(),
  status: z.enum(["pending", "published", "failed", "missed", "canceled"]),
  /** 상태가 마지막으로 바뀐 시각 — 목록이 "언제 올렸나" 를 보여 준다. 옛 기록에는 없다. */
  updatedAt: z.number().optional(),
  createdAt: z.number(),
  message: z.string().optional(),
});

export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;

/**
 * 큐가 사는 곳. `REPICK_SCHEDULE_ROOT` 로 바꿀 수 있다 — 라우트는 경로를 인자로 받을 수 없어
 * 테스트가 임시 폴더를 가리키려면 이 이음새가 필요하다(실제 실행에서는 설정하지 않는다).
 */
export function scheduleRoot(): string {
  return process.env.REPICK_SCHEDULE_ROOT ?? path.join(process.cwd(), ".repick", "scheduled");
}

function queueFile(root: string): string {
  return path.join(root, "queue.jsonl");
}

function ensureRoot(root: string): void {
  mkdirSync(root, { recursive: true });
}

/** id 별 **마지막 줄**이 이긴다. 순서는 그 id 가 처음 등장한 순서를 지킨다. */
export function readQueue(root: string = scheduleRoot()): ScheduleItem[] {
  const file = queueFile(root);
  if (!existsSync(file)) return [];

  const byId = new Map<string, ScheduleItem>();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      // 쓰다가 죽어 반쯤 남은 줄. 건너뛴다.
      continue;
    }
    const parsed = ScheduleItemSchema.safeParse(raw);
    if (!parsed.success) continue;
    byId.set(parsed.data.id, parsed.data);
  }
  return [...byId.values()];
}

export function appendItem(item: ScheduleItem, root: string = scheduleRoot()): void {
  ensureRoot(root);
  appendFileSync(queueFile(root), `${JSON.stringify(item)}\n`, "utf8");
}

/** 없는 id 면 아무것도 하지 않는다 — 취소와 게시가 겹쳐도 큐가 깨지지 않아야 한다. */
export function updateStatus(
  id: string,
  status: ScheduleStatus,
  message: string | undefined,
  root: string = scheduleRoot(),
): void {
  const current = readQueue(root).find((i) => i.id === id);
  if (!current) return;
  // 상태가 바뀐 시각을 함께 남긴다 — 목록이 "언제 올렸나" 를 보여 준다.
  appendItem({ ...current, status, updatedAt: Date.now(), ...(message === undefined ? {} : { message }) }, root);
}

function imageDir(id: string, root: string): string {
  return path.join(root, id);
}

/** `1.png` 부터 차례로. 게시 시점에 순서 그대로 다시 읽는다. */
export function saveImages(id: string, images: Buffer[], root: string = scheduleRoot()): void {
  const dir = imageDir(id, root);
  mkdirSync(dir, { recursive: true });
  images.forEach((buf, i) => writeFileSync(path.join(dir, `${i + 1}.png`), buf));
}

export function loadImages(id: string, root: string = scheduleRoot()): Buffer[] {
  const dir = imageDir(id, root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".png"))
    // 파일 이름이 문자열이라 그대로 정렬하면 10.png 가 2.png 앞에 온다.
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
    .map((name) => readFileSync(path.join(dir, name)));
}

/** 성공·실패 어느 쪽에서든 부른다 — 없어도 던지지 않는다. */
export function removeImages(id: string, root: string = scheduleRoot()): void {
  rmSync(imageDir(id, root), { recursive: true, force: true });
}

/**
 * 기록을 **아예 지운다**(취소와 다르다 — 취소는 상태만 바꾼다). 쌓이기만 하면 목록이
 * 쓰레기통이 되므로, 올라가지 않은 기록은 치울 수 있어야 한다.
 *
 * 큐는 append-only 라 지울 때만 파일을 다시 쓴다.
 */
export function removeItem(id: string, root: string = scheduleRoot()): void {
  const kept = readQueue(root).filter((item) => item.id !== id);
  ensureRoot(root);
  writeFileSync(queueFile(root), kept.map((item) => `${JSON.stringify(item)}\n`).join(""), "utf8");
  removeImages(id, root);
}

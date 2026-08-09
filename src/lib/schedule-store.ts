import { del, list, put } from "@vercel/blob";
import { z } from "zod/v4";

/**
 * 예약 큐 — **Blob 에 둔다. 항목 하나가 파일 하나다.**
 *
 * 예전에는 `queue.jsonl` 한 파일에 append-only 로 쌓았다. 한 프로세스가 계속 도는 로컬
 * 도구에서는 맞는 선택이었지만 배포하면 파일이 사라진다.
 *
 * 옮기면서 **한 파일에 모으지 않는다.** 모아 두면 상태를 바꿀 때마다 전체를 읽고-고치고-쓰게
 * 되고, 그 사이에 다른 요청이 끼어들면 남의 변경을 덮어쓴다. 항목마다 파일을 따로 두면 그
 * 경합이 아예 없다.
 *
 * ```
 * scheduled/<id>/item.json   예약 내용 + 상태 + 이미지 주소들
 * scheduled/<id>/1.png …     올리고 나면 지운다 (item.json 은 기록으로 남긴다)
 * ```
 */

const ItemSchema = z.object({
  id: z.string().min(1),
  scheduledAt: z.number(),
  caption: z.string(),
  keyword: z.string(),
  /** 예약할 때 올려 둔 Blob 주소. **올릴 시각에 다시 올리지 않는다.** */
  imageUrls: z.array(z.string()),
  status: z.enum(["pending", "publishing", "published", "failed", "missed", "canceled"]),
  createdAt: z.number(),
  /** 상태가 마지막으로 바뀐 시각 — 목록이 "언제 올렸나" 를 보여 준다. */
  updatedAt: z.number().optional(),
  message: z.string().optional(),
  /** 어느 tick 이 들고 갔는지. `@/lib/schedule-claim` 이 이 값으로 중복을 막는다. */
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

// 경로를 우리가 정한다(`addRandomSuffix: false`) — 그래야 id 로 다시 찾아올 수 있다.
// 상태가 바뀔 때마다 같은 경로를 덮어쓰므로 `allowOverwrite` 가 필요하다.
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

/** 올렸거나 취소했으면 **사진만** 지운다 — `item.json` 은 기록으로 남는다. */
export async function deleteImages(id: string): Promise<void> {
  const { blobs } = await list({ prefix: itemDir(id) });
  const pngs = blobs.filter((b) => b.pathname.endsWith(".png"));
  if (pngs.length > 0) await del(pngs.map((b) => b.url));
}

/** 기록까지 통째로 지운다 — 목록에서 지우기. */
export async function deleteItem(id: string): Promise<void> {
  const { blobs } = await list({ prefix: itemDir(id) });
  if (blobs.length > 0) await del(blobs.map((b) => b.url));
}

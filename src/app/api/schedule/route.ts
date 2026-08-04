import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { isLocalHost } from "@/lib/local-guard";
import { readPublishProgress } from "@/lib/publish-progress-store";
import { CAROUSEL_MAX_ITEMS, PUBLISHABLE_MIN_ITEMS } from "@/lib/instagram";
import { MAX_HASHTAGS, combineCaptionWithHashtags } from "@/lib/hashtags";
import { describeSchedule } from "@/lib/schedule-due";
import { appendItem, readQueue, saveImages, updateStatus, type ScheduleItem } from "@/lib/schedule-queue";

/**
 * `/api/schedule` — 예약 목록·생성·취소.
 *
 * `/api/publish` 와 같은 이유로 이 PC 브라우저에서만 부를 수 있다(`@/lib/local-guard`).
 *
 * **캡션은 예약할 때 해시태그까지 합쳐 굳힌다.** 게시 시점에 다시 조합하지 않는다 — 예약한
 * 그대로가 올라가야 한다. 카드 이미지도 같은 이유로 이때 디스크에 고정한다.
 */

const CreateSchema = z.object({
  scheduledAt: z.number({ error: "언제 올릴지 시각을 골라 주세요." }),
  caption: z.string().max(2200, { error: "캡션이 너무 길어요." }),
  hashtags: z.array(z.string()).max(MAX_HASHTAGS, { error: `해시태그는 ${MAX_HASHTAGS}개까지예요.` }),
  keyword: z.string().min(1, { error: "주제가 없어요." }),
  images: z
    .array(z.string(), { error: "올릴 사진이 없어요." })
    // 한 장(정보전달)도 예약된다 — 실제 게시는 장수를 보고 갈라진다(`publishKindFor`).
    .min(PUBLISHABLE_MIN_ITEMS, { error: `사진이 ${PUBLISHABLE_MIN_ITEMS}장 이상이어야 해요.` })
    .max(CAROUSEL_MAX_ITEMS, { error: `사진은 ${CAROUSEL_MAX_ITEMS}장까지예요.` }),
});

function forbidden() {
  return Response.json({ error: "예약 발행은 이 컴퓨터의 브라우저에서만 할 수 있어요." }, { status: 403 });
}

export async function GET(req: Request) {
  if (!isLocalHost(req.headers.get("host"))) return forbidden();

  const now = Date.now();
  // 최신 예약이 먼저 — 방금 만든 것을 바로 확인한다.
  const items = [...readQueue()]
    .sort((a, b) => b.createdAt - a.createdAt)
    // 도는 중인 항목에는 실행기가 남긴 진행을 함께 담는다 — 화면이 '5장 중 2장 준비 중'
    // 처럼 보여 준다(`@/lib/schedule-runner` 가 항목 id 로 기록한다).
    .map((item) => {
      const progress = readPublishProgress(item.id, now);
      return {
        ...item,
        describe: describeSchedule(item.scheduledAt, now),
        ...(progress ? { progress } : {}),
      };
    });

  return Response.json({ items });
}

export async function POST(req: Request) {
  if (!isLocalHost(req.headers.get("host"))) return forbidden();

  const body: unknown = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    // zod v4 의 `message` 는 영문 JSON 덩어리다 — 첫 issue 의 한국어 문구만 쓴다(저장소 관례).
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const now = Date.now();
  if (parsed.data.scheduledAt <= now) {
    return Response.json({ error: "지난 시각으로는 예약할 수 없어요. 지금보다 뒤로 골라 주세요." }, { status: 400 });
  }

  const id = randomUUID();
  const images = parsed.data.images.map((b64) => Buffer.from(b64, "base64"));
  // 이미지를 먼저 굳히고 큐에 넣는다 — 반대로 하면 스케줄러가 사진 없는 항목을 볼 수 있다.
  saveImages(id, images);

  const item: ScheduleItem = {
    id,
    scheduledAt: parsed.data.scheduledAt,
    caption: combineCaptionWithHashtags(parsed.data.caption, parsed.data.hashtags),
    imageCount: images.length,
    keyword: parsed.data.keyword,
    status: "pending",
    createdAt: now,
  };
  appendItem(item);

  return Response.json({ id });
}

export async function DELETE(req: Request) {
  if (!isLocalHost(req.headers.get("host"))) return forbidden();

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "어떤 예약을 취소할지 알 수 없어요." }, { status: 400 });

  const found = readQueue().find((i) => i.id === id);
  if (!found) return Response.json({ error: "그 예약을 찾지 못했어요." }, { status: 404 });
  if (found.status !== "pending") {
    return Response.json({ error: "이미 끝난 예약은 취소할 수 없어요." }, { status: 400 });
  }

  updateStatus(id, "canceled", undefined);
  return Response.json({ ok: true });
}

import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { readPublishProgress } from "@/lib/publish-progress-store";
import { readHeartbeat, schedulerHealth } from "@/lib/scheduler-health";
import { canRemoveRecord } from "@/features/cardnews/screens/schedule-view";
import { CAROUSEL_MAX_ITEMS, PUBLISHABLE_MIN_ITEMS } from "@/lib/instagram";
import { MAX_HASHTAGS, combineCaptionWithHashtags } from "@/lib/hashtags";
import { describeSchedule } from "@/lib/schedule-due";
import { deleteImages, deleteItem, listItems, putImages, putItem, type ScheduledItem } from "@/lib/schedule-store";

/**
 * `/api/schedule` — 예약 목록·생성·취소.
 *
 * `/api/publish` 와 같은 이유로 로그인한 사람만 부를 수 있다(`src/middleware.ts`).
 *
 * **캡션은 예약할 때 해시태그까지 합쳐 굳힌다.** 게시 시점에 다시 조합하지 않는다 — 예약한
 * 그대로가 올라가야 한다. 카드 이미지도 같은 이유로 이때 Blob 에 굳힌다 — 올릴 시각에 다시
 * 올리지 않으므로, 여기서 올린 주소가 그대로 인스타그램에 넘어간다.
 *
 * **응답 모양은 옛 큐 시절과 같게 유지한다**(`imageCount` 포함) — 화면(`SchedulePanel`)을
 * 건드리지 않기 위해서다. 저장 방식이 바뀌었다고 화면까지 흔들 이유가 없다.
 */

/** PNG 서명(8바이트)으로 시작하는가. 캡처가 빈 값을 주면 여기서 걸린다. */
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function isPngBuffer(buf: Buffer): boolean {
  return buf.length > PNG_SIGNATURE.length && buf.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

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

export async function GET(req: Request) {

  const now = Date.now();
  // 최신 예약이 먼저 — 방금 만든 것을 바로 확인한다.
  const items = [...(await listItems())]
    .sort((a, b) => b.createdAt - a.createdAt)
    // 도는 중인 항목에는 실행기가 남긴 진행을 함께 담는다 — 화면이 '5장 중 2장 준비 중'
    // 처럼 보여 준다(`@/lib/schedule-runner` 가 항목 id 로 기록한다).
    .map((item) => {
      const progress = readPublishProgress(item.id, now);
      const { imageUrls, claimedAt: _claimedAt, ...rest } = item;
      return {
        ...rest,
        // 화면은 장수만 쓴다. 주소를 그대로 내려보내면 로그인 없이도 카드가 보이게 된다.
        imageCount: imageUrls.length,
        describe: describeSchedule(item.scheduledAt, now),
        ...(progress ? { progress } : {}),
      };
    });

  // 시계가 멈춰 있으면 예약은 영영 안 올라간다 — 그 사실을 함께 내려준다(`scheduler-health`).
  const scheduler = schedulerHealth(await readHeartbeat(), now);

  return Response.json({ items, scheduler });
}

export async function POST(req: Request) {

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

  // **내용까지 본다.** 빈 base64 나 PNG 가 아닌 것을 그냥 저장하면, 인스타그램이 거절할 때까지
  // 아무도 모른다 — 실제로 0바이트 파일을 저장해 두고 게시에서야 튕겼다(2026-08-05).
  // 공개 주소 확인(`tunnelReaches`)도 0바이트를 200 으로 받아 통과시킨다.
  if (!images.every(isPngBuffer)) {
    return Response.json({ error: "카드 이미지를 읽지 못했어요. 화면을 새로 고치고 다시 예약해 주세요." }, { status: 400 });
  }
  // 이미지를 먼저 굳히고 큐에 넣는다 — 반대로 하면 tick 이 사진 없는 항목을 볼 수 있다.
  const imageUrls = await putImages(id, images);

  const item: ScheduledItem = {
    id,
    scheduledAt: parsed.data.scheduledAt,
    caption: combineCaptionWithHashtags(parsed.data.caption, parsed.data.hashtags),
    imageUrls,
    keyword: parsed.data.keyword,
    status: "pending",
    updatedAt: Date.now(),
    createdAt: now,
  };
  await putItem(item);

  return Response.json({ id });
}

export async function DELETE(req: Request) {

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "어떤 예약을 취소할지 알 수 없어요." }, { status: 400 });

  const found = (await listItems()).find((i) => i.id === id);
  if (!found) return Response.json({ error: "그 기록을 찾지 못했어요." }, { status: 404 });

  // `remove` 는 기록을 아예 지운다 — 취소(상태만 바꿈)와 다르다. 올라간 것은 못 지운다:
  // 인스타에는 남아 있는데 여기서만 사라지면 무엇을 올렸는지 알 길이 없어진다.
  if (new URL(req.url).searchParams.get("action") === "remove") {
    if (!canRemoveRecord(found.status)) {
      return Response.json({ error: "올라갔거나 아직 기다리는 기록은 지울 수 없어요." }, { status: 400 });
    }
    await deleteItem(id);
    return Response.json({ ok: true });
  }

  if (found.status !== "pending") {
    return Response.json({ error: "이미 끝난 예약은 취소할 수 없어요." }, { status: 400 });
  }

  await putItem({ ...found, status: "canceled", updatedAt: Date.now() });
  // 안 올릴 사진은 남겨 둘 이유가 없다.
  await deleteImages(id);
  return Response.json({ ok: true });
}

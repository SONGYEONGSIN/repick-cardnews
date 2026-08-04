import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { loadShare } from "@/lib/share-store";
import { appendItem } from "@/lib/schedule-queue";
import { checkInstagramConfig } from "@/lib/instagram-config";
import { isLocalHost } from "@/lib/local-guard";
import {
  publishCarousel,
  publishSingleImage,
  publishKindFor,
  buildCarouselImageUrls,
  friendlyPublishError,
  PUBLISHABLE_MIN_ITEMS,
  CAROUSEL_MAX_ITEMS,
  type PublishStageProgress,
} from "@/lib/instagram";
import { recordPublishProgress, clearPublishProgress } from "@/lib/publish-progress-store";
import { publishFailureDetail } from "@/lib/publish-failure-log";
import { MAX_HASHTAGS, combineCaptionWithHashtags } from "@/lib/hashtags";

/**
 * POST /api/publish — 공유 토큰이 가리키는 카드 이미지들을 인스타그램에 게시한다. 한 장이면
 * 단일 게시, 2~10장이면 캐러셀이다(`publishKindFor`) — 정보전달이 한 장으로 나간다.
 *
 * **사진이 이 서버를 벗어나는 지점**: 인스타그램 콘텐츠 게시 API 는 파일을 직접 받지 않고
 * `image_url` 을 주면 인스타그램 서버가 그 주소로 사진을 가져간다(`@/lib/instagram` 상단 주석
 * 참고). 그래서 아래 게시 호출이 시작되는 순간 — `PUBLIC_BASE_URL` + 공유 토큰
 * 경로(`/s/<token>/<n>.png`)로 만든 주소를 통해 — 카드 이미지가 인터넷으로 나간다. 로컬 PC
 * 안에서만 도는 다른 기능(저장·폰으로 보내기)과 다른 지점이다.
 *
 * 설정(공개 주소·비즈니스 계정 ID·액세스 토큰)이 하나라도 없으면 게시를 시도하지 않고 무엇이
 * 없는지 한국어로 알려준다 — 액세스 토큰 값 자체는 어떤 응답에도 담기지 않는다.
 *
 * **이 PC 브라우저에서만 부를 수 있다** — 실 토큰이 설정되면 이 경로는 "인스타그램에
 * 게시"라는 실제 액션을 수행하므로, 같은 와이파이의 다른 기기가 무심코(또는 의도적으로)
 * 호출하는 것을 `isLocalHost()`로 막는다. 판정 기준과 한계(헤더 위조는 못 막음)는
 * `@/lib/local-guard` 참고.
 */

const BodySchema = z.object({
  token: z.uuid("잘못된 공유 링크입니다"),
  caption: z.string().trim().max(2200, "캡션은 2200자를 넘을 수 없습니다").default(""),
  // 인스타그램은 2025-12부터 게시물당 해시태그를 5개로 제한한다(넘으면 탐색·추천에서 빠진다) —
  // 화면(`InstagramPublishPanel`)이 이미 5개를 넘기지 못하게 막지만, 여기서도 같은 상한을
  // 다시 검증한다(`@/lib/hashtags`가 단일 출처).
  hashtags: z
    .array(z.string().trim().min(1, "빈 해시태그는 보낼 수 없습니다"))
    .max(MAX_HASHTAGS, `해시태그는 최대 ${MAX_HASHTAGS}개까지만 쓸 수 있습니다`)
    .default([]),
});

export async function POST(req: Request) {
  if (!isLocalHost(req.headers.get("host"))) {
    return Response.json(
      { error: "인스타그램 게시는 이 컴퓨터의 브라우저에서만 할 수 있어요." },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const configCheck = checkInstagramConfig(process.env);
  if (!configCheck.ready) {
    return Response.json(
      { error: `인스타그램 게시 설정이 없어요: ${configCheck.missing.join(", ")}` },
      { status: 400 },
    );
  }

  const entry = loadShare(parsed.data.token, Date.now());
  if (!entry) {
    return Response.json({ error: "공유 링크가 없거나 만료됐어요" }, { status: 404 });
  }

  // 예약 실행기(`@/lib/schedule-runner`)와 **같은 갈림**을 쓴다 — 한쪽만 1장을 받으면
  // 손으로는 올라가는데 예약하면 실패한다.
  const kind = publishKindFor(entry.images.length);
  if (!kind) {
    return Response.json(
      {
        error: `한 번에 ${PUBLISHABLE_MIN_ITEMS}~${CAROUSEL_MAX_ITEMS}장까지 게시할 수 있어요 (현재 ${entry.images.length}장)`,
      },
      { status: 400 },
    );
  }

  const imageUrls = buildCarouselImageUrls(configCheck.config.publicBaseUrl, parsed.data.token, entry.images.length);

  // 게시가 도는 동안 어디까지 갔는지 이 토큰 아래 기록해 둔다 — 화면(`/api/publish-progress`)이
  // 몇 초 간격으로 읽어간다. 끝나면(성공이든 실패든) `finally`에서 반드시 지운다 — 정리를
  // 빼먹으면 서버 메모리에 무한정 쌓인다.
  const caption = combineCaptionWithHashtags(parsed.data.caption, parsed.data.hashtags);

  try {
    const onProgress = (progress: PublishStageProgress) =>
      recordPublishProgress(parsed.data.token, progress, Date.now());
    const mediaId =
      kind === "single"
        ? await publishSingleImage(
            { config: configCheck.config, imageUrl: imageUrls[0], caption },
            undefined,
            onProgress,
          )
        : await publishCarousel({ config: configCheck.config, imageUrls, caption }, undefined, onProgress);
    // 손으로 올린 것도 **예약과 같은 장부**에 남긴다 — 안 남기면 "올라갔나?" 를 인스타에
    // 가서 봐야 한다. 실패하면 남기지 않는다: 안 올라간 것을 올렸다고 적지 않는다.
    appendItem({
      id: randomUUID(),
      scheduledAt: Date.now(),
      caption,
      imageCount: entry.images.length,
      keyword: entry.keyword,
      status: "published",
      updatedAt: Date.now(),
      createdAt: Date.now(),
    });
    return Response.json({ mediaId });
  } catch (e) {
    // 사용자에게는 한국어 안내만 보낸다. 원인은 서버 콘솔에만 남긴다 — 토큰은 가린다.
    console.error("[게시 실패]", publishFailureDetail(e, [configCheck.config.accessToken]));
    return Response.json({ error: friendlyPublishError(e) }, { status: 502 });
  } finally {
    clearPublishProgress(parsed.data.token);
  }
}

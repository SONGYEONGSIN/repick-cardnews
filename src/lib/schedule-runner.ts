import { checkInstagramConfig } from "./instagram-config";
import {
  CAROUSEL_MAX_ITEMS,
  PUBLISHABLE_MIN_ITEMS,
  friendlyPublishError,
  publishCarousel,
  publishKindFor,
  publishSingleImage,
  type PublishStageProgress,
} from "./instagram";
import { publishContextLine, publishFailureDetail } from "./publish-failure-log";
import { saveShare } from "./share-blob";
import { clearPublishProgress, recordPublishProgress } from "./publish-progress-store";
import { createShareToken } from "./share-token";
import { loadImages, scheduleRoot, type ScheduleItem } from "./schedule-queue";

/**
 * 예약 항목 하나를 실제로 게시하는 절차.
 *
 * 순서를 지킨다 — 각 단계가 앞 단계의 결과에 기댄다:
 *
 * 1. 디스크 이미지 확인 (예약할 때 고정한 것)
 * 2. 인스타 설정 확인
 * 3. **공유 토큰을 새로 발급해 Blob 에 올린다** — 예약 시점 토큰은 30분이면 만료된다
 * 4. 게시
 *
 * 예전에는 사이에 두 단계가 더 있었다 — `PUBLIC_BASE_URL` 을 다시 읽고, 그 주소가 진짜
 * 닿는지 확인하는 것. 인스타그램이 **우리 서버**로 이미지를 가지러 왔기 때문이다. 이제는
 * Blob 주소에서 직접 가져가므로 둘 다 필요 없다.
 *
 * 실패는 **언제나 한국어 문구**로 돌려준다. 토큰·원문이 섞이면 안 된다 — 이 문구는 큐 파일에
 * 남고 화면에 그대로 나간다.
 */

export type RunResult = { ok: true; mediaId: string } | { ok: false; message: string };

export type RunDeps = {
  now: number;
  root?: string;
  publish?: typeof publishCarousel;
  publishSingle?: typeof publishSingleImage;
};

export async function runScheduledItem(item: ScheduleItem, deps: RunDeps): Promise<RunResult> {
  const root = deps.root ?? scheduleRoot();
  const publish = deps.publish ?? publishCarousel;
  const publishSingle = deps.publishSingle ?? publishSingleImage;

  const images = loadImages(item.id, root);
  // 손으로 올릴 때와 **같은 갈림**을 탄다(`publishKindFor`) — 한쪽만 1장을 받으면
  // 손으로는 되는데 예약하면 실패한다.
  const kind = publishKindFor(images.length);
  if (!kind) {
    return {
      ok: false,
      message: `예약해 둔 사진이 ${PUBLISHABLE_MIN_ITEMS}~${CAROUSEL_MAX_ITEMS}장이 아니어서 올리지 못했어요.`,
    };
  }

  const configCheck = checkInstagramConfig(process.env);
  if (!configCheck.ready) {
    return { ok: false, message: `인스타그램 설정이 없어요: ${configCheck.missing.join(", ")}` };
  }

  // 예약 시점 토큰은 이미 만료됐다. 새로 발급해 Blob 에 올린다.
  //
  // **인스타그램은 Blob 주소에서 직접 가져간다.** 예전에는 우리 서버의 `/s/...` 를 줬기
  // 때문에, 올릴 시각에 서버가 살아 있고 인터넷에서 닿아야 했다 — 그래서 그 앞에 "공개
  // 주소가 진짜 닿는가" 를 미리 확인하는 단계가 있었다. Blob 은 늘 닿으므로 그 확인이
  // 통째로 필요 없어졌다.
  const token = createShareToken();
  const imageUrls = await saveShare(token, images, { keyword: item.keyword, issuedAt: deps.now });

  // 도는 동안 어디까지 갔는지 **항목 id 로** 남긴다 — 목록(`/api/schedule`)이 그걸 읽어
  // 보여 준다. 끝나면(성공이든 실패든) 반드시 지운다 — 남기면 끝난 예약이 아직 도는 것처럼
  // 보인다.
  const onProgress = (progress: PublishStageProgress) => recordPublishProgress(item.id, progress, deps.now);

  try {
    // 캡션은 **예약할 때** 해시태그까지 합쳐 둔 것이다 — 여기서 다시 조합하지 않는다.
    const config = configCheck.config;
    const mediaId =
      kind === "single"
        ? await publishSingle({ config, imageUrl: imageUrls[0], caption: item.caption }, undefined, onProgress)
        : await publish({ config, imageUrls, caption: item.caption }, undefined, onProgress);
    return { ok: true, mediaId };
  } catch (e) {
    // 사용자에게는 한국어 안내만 간다. 왜 거절됐는지는 **서버 콘솔에만** 남긴다 —
    // 안 남기면 원인을 알 길이 없다. 토큰은 가려서 넣는다(`publish-failure-log`).
    console.error(
      "[예약 게시 실패]",
      publishFailureDetail(e, [configCheck.config.accessToken]),
      "|",
      publishContextLine({ imageUrl: imageUrls[0], captionLength: item.caption.length, imageCount: images.length }),
    );
    return { ok: false, message: friendlyPublishError(e) };
  } finally {
    clearPublishProgress(item.id);
  }
}

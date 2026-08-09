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
import { clearPublishProgress, recordPublishProgress } from "./publish-progress-store";
import type { ScheduledItem } from "./schedule-store";

/**
 * 예약 항목 하나를 실제로 게시하는 절차.
 *
 * 순서를 지킨다 — 각 단계가 앞 단계의 결과에 기댄다:
 *
 * 1. 장수 확인 (예약할 때 고정한 이미지 주소)
 * 2. 인스타 설정 확인
 * 3. 게시
 *
 * **예전에는 네 단계가 더 있었다.** 디스크에서 이미지를 읽고, 공유 토큰을 새로 발급하고,
 * 다시 올리고, `PUBLIC_BASE_URL` 이 진짜 닿는지 확인하는 것. 전부 "인스타그램이 **우리
 * 서버**로 가지러 온다" 는 전제에서 나온 단계였다.
 *
 * 지금은 예약할 때 Blob 에 한 번 올려 두고 그 주소를 항목이 들고 있다. 주소가 영구적이라
 * 다시 올릴 이유가 없고, 인스타그램이 Blob 에서 직접 가져가므로 우리 주소도 필요 없다.
 *
 * 실패는 **언제나 한국어 문구**로 돌려준다. 토큰·원문이 섞이면 안 된다 — 이 문구는 큐 파일에
 * 남고 화면에 그대로 나간다.
 */

export type RunResult = { ok: true; mediaId: string } | { ok: false; message: string };

export type RunDeps = {
  now: number;
  publish?: typeof publishCarousel;
  publishSingle?: typeof publishSingleImage;
};

export async function runScheduledItem(item: ScheduledItem, deps: RunDeps): Promise<RunResult> {
  const publish = deps.publish ?? publishCarousel;
  const publishSingle = deps.publishSingle ?? publishSingleImage;

  const imageUrls = item.imageUrls;
  // 손으로 올릴 때와 **같은 갈림**을 탄다(`publishKindFor`) — 한쪽만 1장을 받으면
  // 손으로는 되는데 예약하면 실패한다.
  const kind = publishKindFor(imageUrls.length);
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
      publishContextLine({ imageUrl: imageUrls[0], captionLength: item.caption.length, imageCount: imageUrls.length }),
    );
    return { ok: false, message: friendlyPublishError(e) };
  } finally {
    clearPublishProgress(item.id);
  }
}

import { existsSync, readFileSync } from "node:fs";
import { checkInstagramConfig } from "./instagram-config";
import {
  CAROUSEL_MAX_ITEMS,
  PUBLISHABLE_MIN_ITEMS,
  buildCarouselImageUrls,
  friendlyPublishError,
  publishCarousel,
  publishKindFor,
  publishSingleImage,
  type PublishStageProgress,
} from "./instagram";
import { defaultEnvLocalPath } from "./instagram-token-refresh-runtime";
import { tunnelFailureMessage, type TunnelReach } from "./tunnel-reach";
import { publishFailureDetail } from "./publish-failure-log";
import { saveShare } from "./share-store";
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
 * 3. **`PUBLIC_BASE_URL` 을 `.env.local` 에서 다시 읽는다** — 부팅 시점 `process.env` 값은
 *    터널을 새로 켜면 낡는다. cloudflared 빠른 터널은 켤 때마다 주소가 바뀐다
 * 4. **공유 토큰을 새로 발급한다** — 예약 시점 토큰은 30분이면 만료된다
 * 5. **터널이 실제로 닿는지 확인한다** — 인스타에 깨진 요청을 보내면 그쪽 한도만 먹는다
 * 6. 게시
 *
 * 실패는 **언제나 한국어 문구**로 돌려준다. 토큰·원문이 섞이면 안 된다 — 이 문구는 큐 파일에
 * 남고 화면에 그대로 나간다.
 */

export type RunResult = { ok: true; mediaId: string } | { ok: false; message: string };

export type RunDeps = {
  now: number;
  root?: string;
  envPath?: string;
  fetchImpl?: typeof fetch;
  publish?: typeof publishCarousel;
  publishSingle?: typeof publishSingleImage;
};

/**
 * `.env.local` 에서 `PUBLIC_BASE_URL` 만 다시 읽는다. Next 는 부팅 때 한 번만 읽으므로,
 * 터널을 새로 켜고 이 파일만 고친 경우 `process.env` 는 낡은 주소를 들고 있다.
 * 파일이 없거나 그 줄이 없으면 `null` — 호출부가 `process.env` 로 떨어진다.
 */
export function readPublicBaseUrl(envPath: string = defaultEnvLocalPath()): string | null {
  if (!existsSync(envPath)) return null;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq).trim() !== "PUBLIC_BASE_URL") continue;
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    return value || null;
  }
  return null;
}

/**
 * 첫 이미지를 직접 불러 공개 주소가 쓸 만한지 본다. 2xx 가 아니면 게시하지 않는다.
 *
 * **결과를 두 갈래로 갈라 돌려준다.** 예전엔 참/거짓이라 실패 문구가 하나뿐이었고, 터널은
 * 멀쩡한데 주소만 옛것인 경우에도 "터널이 켜져 있는지" 를 물어 엉뚱한 곳을 고치게 했다.
 */
async function tunnelReaches(url: string, fetchImpl: typeof fetch): Promise<TunnelReach> {
  try {
    const res = await fetchImpl(url);
    return res.ok ? "ok" : "not-ok";
  } catch {
    // 호스트를 못 찾거나 연결이 끊긴 것 — 원문은 밖으로 흘리지 않는다.
    return "unreachable";
  }
}

export async function runScheduledItem(item: ScheduleItem, deps: RunDeps): Promise<RunResult> {
  const root = deps.root ?? scheduleRoot();
  const fetchImpl = deps.fetchImpl ?? fetch;
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

  // 파일에 있으면 그 값이 이긴다 — 터널을 새로 켠 뒤 서버를 안 껐어도 반영된다.
  const publicBaseUrl = readPublicBaseUrl(deps.envPath) ?? configCheck.config.publicBaseUrl;

  // 예약 시점 토큰은 이미 만료됐다. 디스크 이미지로 새로 발급한다.
  const token = createShareToken();
  saveShare(token, { images, keyword: item.keyword, issuedAt: deps.now });
  const imageUrls = buildCarouselImageUrls(publicBaseUrl, token, images.length);

  const reach = await tunnelReaches(imageUrls[0], fetchImpl);
  if (reach !== "ok") {
    return { ok: false, message: tunnelFailureMessage(reach) };
  }

  // 도는 동안 어디까지 갔는지 **항목 id 로** 남긴다 — 목록(`/api/schedule`)이 그걸 읽어
  // 보여 준다. 끝나면(성공이든 실패든) 반드시 지운다 — 남기면 끝난 예약이 아직 도는 것처럼
  // 보인다.
  const onProgress = (progress: PublishStageProgress) => recordPublishProgress(item.id, progress, deps.now);

  try {
    // 캡션은 **예약할 때** 해시태그까지 합쳐 둔 것이다 — 여기서 다시 조합하지 않는다.
    const config = { ...configCheck.config, publicBaseUrl };
    const mediaId =
      kind === "single"
        ? await publishSingle({ config, imageUrl: imageUrls[0], caption: item.caption }, undefined, onProgress)
        : await publish({ config, imageUrls, caption: item.caption }, undefined, onProgress);
    return { ok: true, mediaId };
  } catch (e) {
    // 사용자에게는 한국어 안내만 간다. 왜 거절됐는지는 **서버 콘솔에만** 남긴다 —
    // 안 남기면 원인을 알 길이 없다. 토큰은 가려서 넣는다(`publish-failure-log`).
    console.error("[예약 게시 실패]", publishFailureDetail(e, [configCheck.config.accessToken]));
    return { ok: false, message: friendlyPublishError(e) };
  } finally {
    clearPublishProgress(item.id);
  }
}

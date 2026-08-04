import { z } from "zod/v4";
import type { InstagramConfig, InstagramConnectionConfig } from "@/lib/instagram-config";

export type { InstagramConfig, InstagramConnectionConfig };

/**
 * 인스타그램 콘텐츠 게시(Graph API) 클라이언트 — 캐러셀(2~10장)과 한 장짜리 두 경로가 있다.
 * 한 장은 캐러셀로 못 올린다(Graph API 가 2장 미만 캐러셀을 거부한다, `CAROUSEL_MIN_ITEMS`).
 *
 * **사진이 서버 밖으로 나가는 지점**: 인스타그램 콘텐츠 게시 API 는 파일을 직접 받지 않는다.
 * 아래 `createCarouselItemContainer()`·`createSingleImageContainer()`가 `image_url`을 담아
 * 요청을 보내는 순간, 인스타그램
 * 서버가 **그 주소로 직접 사진을 가져간다** — 우리는 업로드하지 않고 "가져가라"고 알려 줄 뿐이다.
 * 그래서 그 주소는 반드시 인터넷에서 닿는 공개 주소여야 하고(`PUBLIC_BASE_URL` 기반), 이 함수가
 * 호출되는 순간부터 카드 이미지는 이 PC 를 벗어난다.
 *
 * 확인된 것과 확인 못한 것(정직성 우선):
 * - 3단계 흐름(아이템 컨테이너 → 캐러셀 컨테이너 → 게시), 엔드포인트·필드명, 상태값
 *   (`FINISHED`/`IN_PROGRESS`/`ERROR`/`EXPIRED`/`PUBLISHED`), Graph API 버전(`v25.0`), 호스트
 *   (`graph.instagram.com`), 캐러셀 장수(2~10장), 상태 확인 폴링은 **필수가 아니라 권장**이며
 *   권장 주기는 "분당 1회, 최대 5분" — 이상은 공식 문서
 *   (developers.facebook.com/docs/instagram-platform/content-publishing, 2026-08-02 확인)로
 *   직접 검증됨.
 * - 개별 에러의 정확한 `error_subcode` 숫자는 확인하지 못했다 — **확인 못함**. 그래서 에러 분류는
 *   숫자 코드 대신 (문서에서 반복적으로 보이는) 메시지 문구 매칭으로 방어적으로 설계했다. 인증
 *   실패(코드 190, OAuthException)만은 Graph API 전반에서 안정적으로 쓰이는 표준 오류라 코드
 *   값으로도 판정한다.
 * - 아이템 컨테이너 각각까지 개별로 상태를 기다려야 하는지, 최종 캐러셀 컨테이너만 기다리면
 *   되는지는 문서가 명시하지 않는다 — **확인 못함**. 안전한 쪽으로 **둘 다** 기다리도록
 *   구현했다(느려질 뿐 틀리진 않는다). 다만 폴링 자체가 권장 사항일 뿐이라 주기·상한은 문서
 *   권장치(분당 1회, 최대 5분)를 그대로 따른다 — 과하게 느리게 잡지 않는다.
 */

const GRAPH_API_VERSION = "v25.0"; // 공식 문서 예제 기준(2026-08-02 확인). 바뀌면 이 상수만 고치면 된다.

function graphApiBase(config: InstagramConnectionConfig): string {
  return `https://${config.graphHost}/${GRAPH_API_VERSION}`;
}

/** 컨테이너 준비 상태를 이 간격(ms)마다 확인한다 — 문서 권장치인 "분당 1회". */
const POLL_INTERVAL_MS = 60_000;
/** 이 횟수를 넘도록 준비되지 않으면 무한정 기다리지 않고 포기한다 — 문서 권장 상한 "최대 5분"
 * 안쪽으로(간격 60초 × 5회 = 첫 확인 이후 최대 4분 대기 후 시간 초과). */
const POLL_MAX_ATTEMPTS = 5;

/** 캐러셀 최소 장수. Graph API 는 2장 미만이면 CAROUSEL 컨테이너 생성 자체를 거부한다. */
export const CAROUSEL_MIN_ITEMS = 2;
/** 캐러셀 최대 장수. */
export const CAROUSEL_MAX_ITEMS = 10;

/** 올릴 수 있는 최소 장수. 1장은 캐러셀이 아니라 단일 게시로 나간다(정보전달이 여기 해당). */
export const PUBLISHABLE_MIN_ITEMS = 1;

/**
 * 장수를 보고 어느 경로로 올릴지 정한다. 올릴 수 없으면 `null`.
 *
 * **`/api/publish` 와 예약 실행기가 같은 판정을 써야 한다** — 둘이 어긋나면 손으로는 올라가는데
 * 예약하면 실패하는(또는 그 반대) 일이 생긴다. 그래서 갈림을 여기 한 곳에 둔다.
 */
export function publishKindFor(count: number): "single" | "carousel" | null {
  if (count < PUBLISHABLE_MIN_ITEMS || count > CAROUSEL_MAX_ITEMS) return null;
  return count < CAROUSEL_MIN_ITEMS ? "single" : "carousel";
}

/**
 * 사진 `itemCount`장을 캐러셀로 게시할 때 이론상 최악의 총 대기 시간(ms). 아이템 컨테이너
 * `itemCount`개 + 캐러셀(묶기) 컨테이너 1개, 총 `itemCount + 1`개가 각각 `waitUntilReady`의
 * 상한(`POLL_INTERVAL_MS × POLL_MAX_ATTEMPTS`)까지 걸릴 수 있다고 가정한 합이다 — 아이템별
 * 상한이 따로 걸리는 구조라서 전체 소요는 단일 컨테이너 상한(5분)보다 길어질 수 있다.
 *
 * 실측(2026-08-02, 사진 5장 게시): 이 값은 30분이지만 실제로는 6.6분 만에 끝났다 — 이
 * 함수가 돌려주는 값은 "화면이 보여줄 정직한 상한"이지, 보통 걸리는 시간이 아니다.
 */
export function maxPublishWaitMs(itemCount: number): number {
  return (itemCount + 1) * POLL_INTERVAL_MS * POLL_MAX_ATTEMPTS;
}

/** Graph API 가 비-2xx 로 응답했다. `body`는 로그·번역용이며 그대로 클라이언트에 보내지 않는다. */
export class InstagramApiError extends Error {
  readonly body: unknown;
  constructor(message: string, body: unknown) {
    super(message);
    this.name = "InstagramApiError";
    this.body = body;
  }
}

/** 컨테이너가 상한 시간 안에 준비되지 않았다. */
export class InstagramTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramTimeoutError";
  }
}

/**
 * 토큰 자체는 유효하지만, 그 토큰이 실제로 가리키는 계정(`/me`의 `user_id`)이
 * `INSTAGRAM_BUSINESS_ACCOUNT_ID`에 설정된 값과 다르다. Graph API가 던지는 오류가 아니라
 * 우리가 응답을 비교해 직접 판단한 것이라 `InstagramApiError`와 분리했다. `actualUsername`은
 * 토큰이 실제로 가리키는 계정 이름 — 사용자가 설정값을 고칠 때 참고하라고 담아 둔다(토큰
 * 값 자체는 담지 않는다).
 */
export class InstagramAccountMismatchError extends Error {
  readonly actualUsername: string;
  constructor(actualUsername: string) {
    super("설정된 계정 ID가 토큰이 가리키는 계정과 다릅니다");
    this.name = "InstagramAccountMismatchError";
    this.actualUsername = actualUsername;
  }
}

type GraphApiErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

function isGraphApiErrorBody(value: unknown): value is GraphApiErrorBody {
  return typeof value === "object" && value !== null && "error" in value;
}

function isAuthError(code: number | undefined, message: string): boolean {
  return code === 190 || message.includes("oauthexception") || message.includes("access token");
}

function isImageUnreachable(message: string): boolean {
  const aboutImage = message.includes("image") || message.includes("media");
  const unreachable =
    message.includes("download") ||
    message.includes("accessible") ||
    message.includes("could not") ||
    message.includes("does not exist");
  return aboutImage && unreachable;
}

function isDailyLimit(message: string): boolean {
  return message.includes("limit") && (message.includes("24 hour") || message.includes("publish") || message.includes("post"));
}

/**
 * 게시 실패를 한국어 안내로 바꾼다. 인스타그램이 준 영문 메시지를 그대로 보여 주지 않는다.
 * 최소 네 갈래(토큰 만료/권한 없음 · 이미지 주소 접근 불가 · 하루 게시 한도 초과 · 그 밖의 실패)로
 * 나눈다. 분류 근거는 이 파일 상단 주석 참고 — 인증 실패만 코드값(190)으로, 나머지는 메시지 문구
 * 매칭으로 판정한다(확인 못한 정확한 subcode 대신 방어적 heuristic).
 */
export function friendlyPublishError(e: unknown): string {
  if (e instanceof InstagramTimeoutError) {
    return "이미지 처리가 너무 오래 걸려 게시를 중단했어요. 잠시 후 다시 시도해 주세요.";
  }
  if (e instanceof InstagramApiError) {
    const error = isGraphApiErrorBody(e.body) ? e.body.error : undefined;
    const message = (error?.message ?? "").toLowerCase();

    if (isAuthError(error?.code, message)) {
      return "인스타그램 연결이 끊어졌어요. 액세스 토큰을 다시 발급받아 주세요.";
    }
    if (isImageUnreachable(message)) {
      return "인스타그램이 이미지 주소에 접근하지 못했어요. 공개 주소 설정을 확인해 주세요.";
    }
    if (isDailyLimit(message)) {
      return "오늘 게시할 수 있는 한도(24시간 기준 100건)를 다 썼어요. 24시간 뒤 다시 시도해 주세요.";
    }
  }
  return "인스타그램 게시에 실패했어요. 잠시 후 다시 시도해 주세요.";
}

/**
 * 연결 확인(`/api/instagram-verify`) 실패를 한국어 안내로 바꾼다. `friendlyPublishError`와
 * 갈래가 다르다 — 여기는 캐러셀 게시가 아니라 계정 조회라 "이미지 접근 불가"·"하루 한도"는
 * 해당 없고, 대신 "설정된 계정 ID가 틀림"(`InstagramAccountMismatchError`)이 있다.
 */
export function friendlyVerifyError(e: unknown): string {
  if (e instanceof InstagramAccountMismatchError) {
    return `설정된 인스타그램 계정 ID가 이 토큰이 가리키는 계정과 달라요. 토큰은 @${e.actualUsername} 계정을 가리키고 있어요 — INSTAGRAM_BUSINESS_ACCOUNT_ID 값을 확인해 주세요.`;
  }
  if (e instanceof InstagramApiError) {
    const error = isGraphApiErrorBody(e.body) ? e.body.error : undefined;
    const message = (error?.message ?? "").toLowerCase();

    if (isAuthError(error?.code, message)) {
      return "인스타그램 연결이 끊어졌어요. 액세스 토큰을 다시 발급받아 주세요.";
    }
    return "인스타그램 연결을 확인하지 못했어요. 계정 ID와 토큰을 확인해 주세요.";
  }
  return "네트워크 연결을 확인해 주세요. 인스타그램 서버에 닿지 못했어요.";
}

/**
 * 지금 설정된 토큰·계정 ID로 실제 Graph API 를 불러 연결이 유효한지 확인하고 계정 이름을
 * 돌려준다. `/me?fields=user_id,username`(공식 문서, 2026-08-02 확인)를 부른다 — 토큰
 * 자체가 "누구인지"를 답하는 엔드포인트라 `businessAccountId`를 URL에 넣지 않는다. 대신
 * 응답의 `user_id`를 설정값과 비교해 다르면(계정 ID를 잘못 넣은 경우) 계정 불일치로 알린다.
 *
 * 공개 주소는 쓰지 않는다 — 그래서 파라미터 타입이 `InstagramConfig`가 아니라
 * `InstagramConnectionConfig`다. 공개 주소가 아직 없어도(터널을 안 켠 상태) 이 함수는
 * 호출할 수 있다.
 */
export async function verifyInstagramConnection(config: InstagramConnectionConfig): Promise<{ username: string }> {
  const url = `${graphApiBase(config)}/me?fields=user_id,username&access_token=${encodeURIComponent(config.accessToken)}`;
  const { user_id, username } = await callGraphApi(url, undefined, MeResponse);
  if (user_id !== config.businessAccountId) {
    throw new InstagramAccountMismatchError(username);
  }
  return { username };
}

/** `/s/<토큰>/<n>.png`(공유 라우트) 를 공개 base URL 로 감싸 인스타그램이 가져갈 주소를 만든다. */
export function buildCarouselImageUrls(publicBaseUrl: string, token: string, count: number): string[] {
  const base = publicBaseUrl.replace(/\/+$/, "");
  return Array.from({ length: count }, (_, i) => `${base}/s/${token}/${i + 1}.png`);
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    const data: unknown = await res.json();
    return data;
  } catch {
    return undefined;
  }
}

const MediaContainerResponse = z.object({ id: z.string() });
const StatusCheckResponse = z.object({ status_code: z.string() });
const PublishResponse = z.object({ id: z.string() });
const MeResponse = z.object({ user_id: z.string(), username: z.string() });

async function callGraphApi<T>(url: string, init: RequestInit | undefined, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url, init);
  const body = await parseJson(res);
  if (!res.ok) {
    throw new InstagramApiError(`인스타그램 API 실패 (HTTP ${res.status})`, body);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new InstagramApiError("인스타그램 응답 형식이 예상과 달라요", body);
  }
  return parsed.data;
}

async function createCarouselItemContainer(config: InstagramConfig, imageUrl: string): Promise<string> {
  const params = new URLSearchParams({
    image_url: imageUrl,
    is_carousel_item: "true",
    access_token: config.accessToken,
  });
  const result = await callGraphApi(
    `${graphApiBase(config)}/${config.businessAccountId}/media`,
    { method: "POST", body: params },
    MediaContainerResponse,
  );
  return result.id;
}

async function createCarouselContainer(config: InstagramConfig, childIds: string[], caption: string): Promise<string> {
  const params = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
    access_token: config.accessToken,
  });
  const result = await callGraphApi(
    `${graphApiBase(config)}/${config.businessAccountId}/media`,
    { method: "POST", body: params },
    MediaContainerResponse,
  );
  return result.id;
}

/**
 * 한 장짜리 컨테이너. 캐러셀 아이템과 달리 `is_carousel_item` 을 **보내지 않고**, 캡션도
 * 여기서 함께 넣는다 — 묶는 단계가 없으므로 캡션을 붙일 다른 자리가 없다.
 */
async function createSingleImageContainer(
  config: InstagramConfig,
  imageUrl: string,
  caption: string,
): Promise<string> {
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: config.accessToken,
  });
  const result = await callGraphApi(
    `${graphApiBase(config)}/${config.businessAccountId}/media`,
    { method: "POST", body: params },
    MediaContainerResponse,
  );
  return result.id;
}

async function publishContainer(config: InstagramConfig, containerId: string): Promise<string> {
  const params = new URLSearchParams({ creation_id: containerId, access_token: config.accessToken });
  const result = await callGraphApi(
    `${graphApiBase(config)}/${config.businessAccountId}/media_publish`,
    { method: "POST", body: params },
    PublishResponse,
  );
  return result.id;
}

/** Graph API 의 컨테이너 `status_code` 를 셋 중 하나로 정리한다. 모르는 값은 아직 기다린다 —
 * 어차피 `POLL_MAX_ATTEMPTS` 상한이 무한정 대기를 막아 준다. */
function interpretContainerStatus(statusCode: string): "ready" | "pending" | "failed" {
  if (statusCode === "FINISHED" || statusCode === "PUBLISHED") return "ready";
  if (statusCode === "ERROR" || statusCode === "EXPIRED") return "failed";
  return "pending";
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 컨테이너가 준비될 때까지 기다린다. 상한(`POLL_MAX_ATTEMPTS`)을 넘으면 시간 초과로 실패한다 —
 * 무한정 기다리지 않는다. `sleep` 은 테스트에서 실제 대기 없이 주입할 수 있게 뺐다. */
async function waitUntilReady(
  config: InstagramConfig,
  containerId: string,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const url = `${graphApiBase(config)}/${containerId}?fields=status_code&access_token=${encodeURIComponent(config.accessToken)}`;
    const { status_code } = await callGraphApi(url, undefined, StatusCheckResponse);
    const state = interpretContainerStatus(status_code);
    if (state === "ready") return;
    if (state === "failed") {
      throw new InstagramApiError("인스타그램이 컨테이너 처리에 실패했어요", { error: { message: status_code } });
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new InstagramTimeoutError("컨테이너가 상한 시간 안에 준비되지 않았습니다");
}

export type PublishCarouselArgs = {
  config: InstagramConfig;
  /** 인스타그램이 직접 가져갈 공개 주소들. `buildCarouselImageUrls()` 로 만든다. */
  imageUrls: string[];
  caption: string;
};

/**
 * 게시 3단계 중 지금 어디에 있는지. `preparing`의 `total`은 캐러셀에 담긴 사진 장수 —
 * 화면이 "N장 중 M장 준비 중"처럼 보여줄 때 쓴다. 이 세 값 자체로는 "끝났음(성공/실패)"을
 * 표현하지 못한다 — 그건 이 함수를 부르는 쪽(호출부)이 `publishCarousel()`의 반환/예외로
 * 이미 알 수 있는 정보라 여기 포함하지 않는다(`@/lib/publish-progress-store`가 그 값을 더해
 * 완결된 진행 상태 타입을 만든다).
 */
export type PublishStageProgress =
  | { stage: "preparing"; index: number; total: number }
  | { stage: "bundling" }
  | { stage: "publishing" };

/**
 * 캐러셀 게시 3단계(아이템 컨테이너 → 캐러셀 컨테이너 → 게시)를 수행하고 게시물 id 를 돌려준다.
 * `sleep` 은 테스트 주입용(생략하면 실제로 기다린다) — 상한은 항상 지켜진다. `onProgress` 는
 * 관찰용 콜백(생략 가능) — 호출 순서·시점만 알려줄 뿐 3단계·폴링 간격·상한 동작 자체는
 * 하나도 바꾸지 않는다.
 */
export async function publishCarousel(
  { config, imageUrls, caption }: PublishCarouselArgs,
  sleep: (ms: number) => Promise<void> = defaultSleep,
  onProgress?: (progress: PublishStageProgress) => void,
): Promise<string> {
  const itemIds: string[] = [];
  const total = imageUrls.length;
  for (let i = 0; i < imageUrls.length; i++) {
    onProgress?.({ stage: "preparing", index: i + 1, total });
    const itemId = await createCarouselItemContainer(config, imageUrls[i]);
    await waitUntilReady(config, itemId, sleep);
    itemIds.push(itemId);
  }

  onProgress?.({ stage: "bundling" });
  const containerId = await createCarouselContainer(config, itemIds, caption);
  await waitUntilReady(config, containerId, sleep);

  onProgress?.({ stage: "publishing" });
  return publishContainer(config, containerId);
}

export type PublishSingleImageArgs = {
  config: InstagramConfig;
  /** 인스타그램이 직접 가져갈 공개 주소 하나. `buildCarouselImageUrls(..., 1)[0]` 로 만든다. */
  imageUrl: string;
  caption: string;
};

/**
 * 한 장 게시(컨테이너 → 게시). 정보전달처럼 이미지가 하나뿐인 경우에 쓴다 —
 * Graph API 는 2장 미만 캐러셀을 거부한다(`CAROUSEL_MIN_ITEMS`).
 *
 * 캐러셀의 '아이템 준비 → 묶기' 두 단계가 없어 더 단순하다. 진행 보고는 캐러셀과 **같은 타입**을
 * 쓰되 `bundling` 이 없다 — 묶을 것이 없으므로 없는 단계를 보고하지 않는다.
 */
export async function publishSingleImage(
  { config, imageUrl, caption }: PublishSingleImageArgs,
  sleep: (ms: number) => Promise<void> = defaultSleep,
  onProgress?: (progress: PublishStageProgress) => void,
): Promise<string> {
  onProgress?.({ stage: "preparing", index: 1, total: 1 });
  const containerId = await createSingleImageContainer(config, imageUrl, caption);
  await waitUntilReady(config, containerId, sleep);

  onProgress?.({ stage: "publishing" });
  return publishContainer(config, containerId);
}

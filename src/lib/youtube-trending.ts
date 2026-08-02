/**
 * 유튜브 인기 급상승(한국) 후보를 가져온다 — 트렌드 주제 파이프라인의 1단계.
 *
 * 공식 문서(developers.google.com/youtube/v3/docs/videos/list, 2026-08-02 확인) 기준:
 * `GET /youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=KR&maxResults=50&key=…`.
 * API 키만으로 호출된다(OAuth 불필요), 호출당 할당량 1유닛(무료 한도 하루 10,000).
 *
 * **전체 인기 급상승은 쓰지 않는다 — 카테고리로 좁혀서 가져온다.** 실측(2026-08-02, 카테고리
 * 필터 없이 상위 10개 확인): 음악·드라마 예고편·게임·연예 예능이 구조적으로 지배해 생활 정보
 * 후보가 0개였다("MOTION", "킬러들의 쇼핑몰 예고편", "게임 중독자로 살면" 등). 그래서
 * `videoCategoryId`로 생활 정보 적중률이 높은 카테고리만 골라(`LIFESTYLE_CATEGORIES`) 각각
 * 가져와 합친다 — 호출이 카테고리 수만큼 늘지만 여전히 호출당 1유닛이라 부담 없다.
 *
 * **카테고리 하나가 실패해도 전체가 죽지 않는다.** 실측 결과(아래 `LIFESTYLE_CATEGORIES`
 * 주석) 유튜브가 지역별로 `mostPopular` 자체를 지원하지 않는 카테고리가 있다 — 그런 경우
 * `notFound`로 실패한다. `fetchYoutubeTrendingCandidates`는 `Promise.allSettled`로 모든
 * 카테고리를 시도하고, 성공한 것만으로 계속 진행한다(`combineCategoryResults`). 실패한
 * 카테고리는 `skippedCategories`에 담아 감추지 않는다 — 화면이 "일부만 가져왔다"를 알 수
 * 있어야 한다. **전부 실패했을 때만** 오류로 다룬다.
 *
 * **영상 제목을 그대로 주제로 쓰지 않는다** — 카테고리를 좁혀도 낚시성이거나 특정 인물·사건에
 * 묶여 있을 수 있다. 여기서는 title·channelTitle·categoryId만 뽑아 돌려주고, 생활 정보
 * 주제로 다듬는 일은 다음 단계(`@/lib/topic-curation`)가 한다.
 */
import { z } from "zod/v4";

/** 공식 문서상 `maxResults`의 1회 요청 최대치. */
export const YOUTUBE_MAX_RESULTS = 50;

/**
 * `label` 은 유튜브 공식 영문 이름(문서 대조용), `displayName` 은 **사용자에게 보일 한국어
 * 이름**이다. 화면이 "어디서 가져왔는지"를 밝힐 때 이 이름을 쓰므로 영문이 새어 나가면 안 된다.
 */
export type YoutubeCategory = { id: string; label: string; displayName: string };

/**
 * 생활 정보 적중률이 높은 유튜브 공식 카테고리 — **실제 API 호출로 하나씩 검증한 것만**
 * 담는다(추측 금지). 검증 방법: 사용자 키로 `videoCategories.list?regionCode=KR`로 실제
 * assignable 카테고리 목록(14개)을 받은 뒤, 후보들에 `videos.list(chart=mostPopular,
 * regionCode=KR, videoCategoryId=…)`를 하나씩 호출했다(2026-08-02 실측).
 *
 * - `26` Howto & Style — 지원됨(실측 50개). 살림·요리·정리·육아 팁. 생활 정보 적중률이
 *   가장 높다.
 * - `22` People & Blogs — 지원됨(실측 2~50개, 날짜에 따라 편차가 크다). 일상 브이로그.
 *   육아·집안일 브이로그가 여기 속한다.
 * - `28` Science & Technology — 지원됨(실측 50개). 재테크 앱·스마트홈·가전처럼 생활 정보와
 *   맞닿는 콘텐츠가 있어 22의 적은 표본을 보완하려고 추가했다.
 *
 * **`27` Education은 한국에서 `mostPopular`를 지원하지 않는다(실측 `notFound`,
 * 2026-08-02)** — 다시 넣지 말 것. `19` Travel & Events도 같은 이유로 `notFound`였다.
 *
 * `24` Entertainment·`25` News & Politics·`17` Sports·`20` Gaming·`23` Comedy는 실측상
 * 전부 지원되지만(각 50개) 일부러 뺐다 — 다음 단계(`@/lib/topic-curation`)가 연예·정치·
 * 스포츠 결과를 제외 대상으로 명시하는데, 카테고리 자체가 그 잡음으로 가득 차 있어 신호
 * 대 잡음비를 해친다고 판단했다. 필요해지면 이 배열에 한 줄만 추가하면 된다 — 단, 추가
 * 전에 반드시 실제 호출로 지원 여부를 다시 확인할 것.
 */
export const LIFESTYLE_CATEGORIES: readonly YoutubeCategory[] = [
  { id: "26", label: "Howto & Style", displayName: "살림·요리·꿀팁" },
  { id: "22", label: "People & Blogs", displayName: "일상·브이로그" },
  { id: "28", label: "Science & Technology", displayName: "생활기술·가전" },
];

export function buildYoutubeTrendingUrl(
  apiKey: string,
  categoryId: string,
  maxResults: number = YOUTUBE_MAX_RESULTS,
): string {
  const params = new URLSearchParams({
    part: "snippet",
    chart: "mostPopular",
    regionCode: "KR",
    videoCategoryId: categoryId,
    maxResults: String(maxResults),
    key: apiKey,
  });
  return `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
}

export type YoutubeCandidate = {
  videoId: string;
  title: string;
  channelTitle: string;
  categoryId: string;
};

/** Graph API 계열과 같은 관례 — 비-2xx 응답을 감싸 던진다. `body`는 로그·번역용이며 그대로
 * 클라이언트에 보내지 않는다. */
export class YoutubeApiError extends Error {
  readonly body: unknown;
  constructor(message: string, body: unknown) {
    super(message);
    this.name = "YoutubeApiError";
    this.body = body;
  }
}

/** `LIFESTYLE_CATEGORIES`가 전부 실패했다(부분 실패는 여기까지 오지 않는다 —
 * `combineCategoryResults` 참고). `causes`는 카테고리별 실패 원인들. */
export class AllCategoriesFailedError extends Error {
  readonly causes: unknown[];
  constructor(causes: unknown[]) {
    super("모든 카테고리에서 유튜브 인기 급상승을 가져오지 못했습니다");
    this.name = "AllCategoriesFailedError";
    this.causes = causes;
  }
}

type YoutubeErrorBody = { error?: { message?: string; errors?: { reason?: string }[] } };

function isYoutubeErrorBody(value: unknown): value is YoutubeErrorBody {
  return typeof value === "object" && value !== null && "error" in value;
}

/** 실패를 한국어 안내로 바꾼다. 유튜브가 준 영문 사유(quotaExceeded 등)를 그대로 보여주지
 * 않는다. `YoutubeApiError`도 `AllCategoriesFailedError`도 아닌 값(네트워크 실패 등)은
 * 원문을 감추고 일반 문구를 준다. */
export function friendlyYoutubeError(e: unknown): string {
  if (e instanceof YoutubeApiError) {
    const error = isYoutubeErrorBody(e.body) ? e.body.error : undefined;
    const reason = error?.errors?.[0]?.reason ?? "";
    const message = (error?.message ?? "").toLowerCase();

    if (reason === "quotaExceeded") {
      return "유튜브 API 하루 사용량을 다 썼어요. 내일 다시 시도해 주세요.";
    }
    if (reason === "keyInvalid" || message.includes("api key not valid")) {
      return "유튜브 API 키가 올바르지 않아요. YOUTUBE_API_KEY 값을 확인해 주세요.";
    }
    return "유튜브 인기 급상승 목록을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
  if (e instanceof AllCategoriesFailedError) {
    return "유튜브 인기 급상승 목록을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
  return "유튜브 서버에 연결하지 못했어요. 네트워크를 확인해 주세요.";
}

const YoutubeResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({
        title: z.string(),
        channelTitle: z.string(),
        categoryId: z.string(),
      }),
    }),
  ),
});

async function parseJson(res: Response): Promise<unknown> {
  try {
    const data: unknown = await res.json();
    return data;
  } catch {
    return undefined;
  }
}

/** 카테고리 하나의 인기 급상승 목록을 가져온다. */
export async function fetchYoutubeTrendingByCategory(
  apiKey: string,
  categoryId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<YoutubeCandidate[]> {
  const res = await fetchImpl(buildYoutubeTrendingUrl(apiKey, categoryId));
  const body = await parseJson(res);
  if (!res.ok) {
    throw new YoutubeApiError(`유튜브 API 실패 (HTTP ${res.status})`, body);
  }
  const parsed = YoutubeResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new YoutubeApiError("유튜브 응답 형식이 예상과 달라요", body);
  }
  return parsed.data.items.map((item) => ({
    videoId: item.id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    categoryId: item.snippet.categoryId,
  }));
}

export type CategoryFetchResult =
  | { status: "fulfilled"; category: YoutubeCategory; candidates: YoutubeCandidate[] }
  | { status: "rejected"; category: YoutubeCategory; error: unknown };

export type CombinedCandidates = {
  candidates: YoutubeCandidate[];
  /** 실제로 후보를 가져온 카테고리들 — 화면이 **어디서 가져왔는지**를 밝힐 때 쓴다. */
  usedCategories: YoutubeCategory[];
  /** 실패해서 건너뛴 카테고리들 — 화면이 "일부만 가져왔다"를 알 수 있게 감추지 않는다. */
  skippedCategories: YoutubeCategory[];
};

/**
 * 카테고리별 결과를 합친다 — 순수 함수라 실제 fetch 없이 세 경우(전부 성공/일부 실패/전부
 * 실패)를 테스트할 수 있다. 하나라도 성공하면 그 결과들만 합쳐 돌려주고 실패한 카테고리는
 * `skippedCategories`에 담는다. **전부 실패했을 때만** 오류로 던진다.
 */
export function combineCategoryResults(results: CategoryFetchResult[]): CombinedCandidates {
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  if (fulfilled.length === 0) {
    throw new AllCategoriesFailedError(rejected.map((r) => r.error));
  }

  const seen = new Set<string>();
  const candidates: YoutubeCandidate[] = [];
  for (const result of fulfilled) {
    for (const c of result.candidates) {
      if (seen.has(c.videoId)) continue;
      seen.add(c.videoId);
      candidates.push(c);
    }
  }
  return {
    candidates,
    usedCategories: fulfilled.map((r) => r.category),
    skippedCategories: rejected.map((r) => r.category),
  };
}

/**
 * `LIFESTYLE_CATEGORIES`를 전부 병렬로 시도한다. 카테고리 하나가 실패해도(예: 지역에서
 * `mostPopular` 미지원) 나머지 결과로 계속 진행한다 — `combineCategoryResults` 참고.
 */
export async function fetchYoutubeTrendingCandidates(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CombinedCandidates> {
  const settled = await Promise.allSettled(
    LIFESTYLE_CATEGORIES.map((category) => fetchYoutubeTrendingByCategory(apiKey, category.id, fetchImpl)),
  );

  const results: CategoryFetchResult[] = settled.map((result, i) => {
    const category = LIFESTYLE_CATEGORIES[i];
    return result.status === "fulfilled"
      ? { status: "fulfilled", category, candidates: result.value }
      : { status: "rejected", category, error: result.reason };
  });

  return combineCategoryResults(results);
}

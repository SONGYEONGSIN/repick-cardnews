/**
 * 유튜브 키워드 검색 — 소재 찾기의 "키워드로 찾기" 모드.
 *
 * **호출당 100유닛이다**(급상승 `videos.list` 는 1유닛). 하루 10,000유닛이므로 **검색은 하루
 * 100번**이 상한이다. 화면은 이 사실을 감추면 안 된다 — 유튜브가 잔여량을 알려 주지 않으므로
 * 남은 횟수를 지어내지 말고 상한만 말한다.
 *
 * **영상 제목을 다듬지 않는다.** 낚시성 제목이어도 그대로 돌려주고 고를지는 사용자가 정한다 —
 * 여기서 Claude 를 부르면 1~2초짜리 모드가 100초짜리가 된다.
 */
import { z } from "zod/v4";
import { YoutubeApiError } from "./youtube-trending";

export const YOUTUBE_SEARCH_UNIT_COST = 100;
/** 하루 무료 할당량 10,000유닛 ÷ 호출당 100유닛. */
export const YOUTUBE_SEARCH_DAILY_LIMIT = 100;

const DEFAULT_MAX_RESULTS = 25;

export type MaterialItem = { videoId: string; title: string; channelTitle: string };

export function buildYoutubeSearchUrl(
  apiKey: string,
  query: string,
  maxResults: number = DEFAULT_MAX_RESULTS,
): string {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    regionCode: "KR",
    relevanceLanguage: "ko",
    q: query,
    maxResults: String(maxResults),
    key: apiKey,
  });
  return `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
}

/** 채널·재생목록 결과에는 `videoId` 가 없다 — 그래서 선택적으로 받고 걸러 낸다. */
const SearchResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.object({ videoId: z.string().optional() }),
      snippet: z.object({ title: z.string(), channelTitle: z.string() }),
    }),
  ),
});

async function parseJson(res: Response): Promise<unknown> {
  try {
    return (await res.json()) as unknown;
  } catch {
    return undefined;
  }
}

export async function fetchYoutubeSearchMaterials(
  apiKey: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MaterialItem[]> {
  const res = await fetchImpl(buildYoutubeSearchUrl(apiKey, query));
  const body = await parseJson(res);
  if (!res.ok) {
    throw new YoutubeApiError(`유튜브 검색 실패 (HTTP ${res.status})`, body);
  }
  const parsed = SearchResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new YoutubeApiError("유튜브 검색 응답 형식이 예상과 달라요", body);
  }
  return parsed.data.items
    .filter((item): item is typeof item & { id: { videoId: string } } => Boolean(item.id.videoId))
    .map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
    }));
}

type YoutubeErrorBody = { error?: { errors?: { reason?: string }[] } };

function reasonOf(e: YoutubeApiError): string {
  const body = e.body;
  if (typeof body !== "object" || body === null || !("error" in body)) return "";
  return (body as YoutubeErrorBody).error?.errors?.[0]?.reason ?? "";
}

export function friendlyYoutubeSearchError(e: unknown): string {
  if (e instanceof YoutubeApiError) {
    const reason = reasonOf(e);
    if (reason === "quotaExceeded") {
      return `오늘 쓸 수 있는 검색 횟수를 다 썼어요. 키워드 검색은 하루 ${YOUTUBE_SEARCH_DAILY_LIMIT}번까지예요 — 내일 다시 시도하거나 급상승에서 골라 보세요.`;
    }
    if (reason === "keyInvalid") {
      return "유튜브 API 키가 올바르지 않아요. YOUTUBE_API_KEY 값을 확인해 주세요.";
    }
    return "유튜브 검색에 실패했어요. 잠시 후 다시 시도해 주세요.";
  }
  return "유튜브 서버에 연결하지 못했어요. 네트워크를 확인해 주세요.";
}

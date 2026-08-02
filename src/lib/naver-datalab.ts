/**
 * 네이버 데이터랩 검색어트렌드로 후보 키워드 순위를 매긴다 — 트렌드 주제 파이프라인의
 * 4단계. `@/lib/topic-curation`이 추려준 키워드들을 30~40대 여성이 실제로 검색하는지
 * 상대값으로 확인해 정렬한다.
 *
 * 공식 문서(openapi.naver.com/v1/datalab/search, 2026-08-02 확인) 기준:
 * `POST https://openapi.naver.com/v1/datalab/search`, 헤더
 * `X-Naver-Client-Id`·`X-Naver-Client-Secret`·`Content-Type: application/json`. 본문은
 * `startDate`·`endDate`·`timeUnit`·`keywordGroups`(그룹명+키워드)·`device`·`ages`·`gender`.
 * **한 요청에 키워드 그룹 최대 5개**까지만 담을 수 있어 후보가 많으면 나눠 보낸다.
 *
 * **응답값은 절대 검색량이 아니라 상대값**이다(공식 문서) — 그래서 여기서 만드는 `score`도
 * 후보끼리 비교하는 용도로만 쓰고, 호출 쪽에서 "검색 N회"처럼 절대치로 포장하면 안 된다.
 *
 * **기간 선택(최근 30일, timeUnit=date)**: 후보가 유튜브 인기 급상승에서 온 것이라
 * 최신 화제성이 중요하다. `month` 단위는 이번 달 데이터가 다 안 쌓였을 수 있어 데이터
 * 포인트가 1~2개뿐이라 트렌드 판단에 부적합하고, 일 단위 평균은 단발성 급증을 완화하면서도
 * 오래된 데이터에 희석되지 않는다 — 자세한 근거는 topics-pipeline-report.md 참고.
 *
 * **확인 못한 것 — `ages` 코드와 실제 연령대의 대응**: 공식 문서가 숫자 코드의 정확한
 * 연령 구간을 명시하지 않는다. `NAVER_AGES_30S_40S` 아래 값은 관례상 알려진 대응
 * ("5"=30~34, "6"=35~39, "7"=40~44, "8"=45~49)을 그대로 쓴 것이며, 이 저장소 안에서
 * 공식 문서로 직접 검증하지 못했다. 데이터랩 화면(datalab.naver.com/keyword/trendSearch.naver)
 * 에서 성별+연령 필터를 걸어 응답과 대조해 확정되면 이 상수만 고치면 된다.
 */
import { z } from "zod/v4";

/** 확인 못함(문서 미기재) — 관례상 30~40대에 대응한다고 알려진 코드. 파일 상단 주석 참고. */
export const NAVER_AGES_30S_40S: readonly string[] = ["5", "6", "7", "8"];
export const NAVER_GENDER_FEMALE = "f";

/** 공식 문서상 한 요청에 담을 수 있는 키워드 그룹 최대치. */
export const MAX_GROUPS_PER_REQUEST = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 30;

export type DatalabPeriod = { startDate: string; endDate: string; timeUnit: "date" };

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 기준 시각으로부터 최근 30일 — 근거는 파일 상단 주석 참고. */
export function buildRecentPeriod(now: Date): DatalabPeriod {
  const start = new Date(now.getTime() - LOOKBACK_DAYS * MS_PER_DAY);
  return { startDate: toDateString(start), endDate: toDateString(now), timeUnit: "date" };
}

export type DatalabKeywordGroup = { groupName: string; keywords: string[] };
export type DatalabRequestBody = DatalabPeriod & {
  keywordGroups: DatalabKeywordGroup[];
  ages: string[];
  gender: string;
};

/** 키워드 각각을 자기 자신만 담은 독립 그룹으로 만든다 — 그룹별 순위가 곧 키워드별
 * 순위다. 그룹은 요청당 최대 5개까지만 담을 수 있어(공식 문서) `MAX_GROUPS_PER_REQUEST`
 * 개씩 나눠 여러 요청으로 쪼갠다. */
export function chunkKeywordsIntoRequests(keywords: string[], period: DatalabPeriod): DatalabRequestBody[] {
  const requests: DatalabRequestBody[] = [];
  for (let i = 0; i < keywords.length; i += MAX_GROUPS_PER_REQUEST) {
    const chunk = keywords.slice(i, i + MAX_GROUPS_PER_REQUEST);
    requests.push({
      ...period,
      keywordGroups: chunk.map((keyword) => ({ groupName: keyword, keywords: [keyword] })),
      ages: [...NAVER_AGES_30S_40S],
      gender: NAVER_GENDER_FEMALE,
    });
  }
  return requests;
}

/** 기간 내 `ratio` 점들의 평균 — 하루 단위 노이즈를 완화한 대표 점수. */
export function averageRatio(data: { period: string; ratio: number }[]): number {
  if (data.length === 0) return 0;
  return data.reduce((sum, point) => sum + point.ratio, 0) / data.length;
}

export type RankedTopic = { keyword: string; score: number };

export class NaverDatalabApiError extends Error {
  readonly body: unknown;
  constructor(message: string, body: unknown) {
    super(message);
    this.name = "NaverDatalabApiError";
    this.body = body;
  }
}

/** 실패를 한국어 안내로 바꾼다. 네이버가 준 영문 사유를 그대로 보여주지 않는다. */
export function friendlyNaverDatalabError(e: unknown): string {
  if (e instanceof NaverDatalabApiError) {
    return "네이버 데이터랩 순위를 가져오지 못했어요. 클라이언트 ID·시크릿을 확인해 주세요.";
  }
  return "네이버 서버에 연결하지 못했어요. 네트워크를 확인해 주세요.";
}

const DatalabResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      data: z.array(z.object({ period: z.string(), ratio: z.number() })),
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

export type NaverDatalabConfig = { clientId: string; clientSecret: string };

async function callDatalab(
  auth: NaverDatalabConfig,
  body: DatalabRequestBody,
  fetchImpl: typeof fetch,
): Promise<RankedTopic[]> {
  const res = await fetchImpl("https://openapi.naver.com/v1/datalab/search", {
    method: "POST",
    headers: {
      "X-Naver-Client-Id": auth.clientId,
      "X-Naver-Client-Secret": auth.clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new NaverDatalabApiError(`네이버 데이터랩 API 실패 (HTTP ${res.status})`, json);
  }
  const parsed = DatalabResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new NaverDatalabApiError("네이버 데이터랩 응답 형식이 예상과 달라요", json);
  }
  // 그룹명(title)이 곧 keywordGroups 를 만들 때 넣은 키워드 자신이다(chunkKeywordsIntoRequests 참고).
  return parsed.data.results.map((result) => ({ keyword: result.title, score: averageRatio(result.data) }));
}

/**
 * 후보 키워드들을 데이터랩에 보내 30~40대 여성 기준 상대값으로 순위를 매긴다(점수
 * 내림차순). 그룹 5개 제한 때문에 여러 요청으로 나눠 **순차** 호출한다 — 네이버 쪽 순간
 * 호출량을 늘리지 않기 위해서다(응답 시간이 늘어나는 대신 안전한 쪽을 택했다).
 */
export async function rankKeywordsByNaverDatalab(
  keywords: string[],
  auth: NaverDatalabConfig,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<RankedTopic[]> {
  const period = buildRecentPeriod(now);
  const requests = chunkKeywordsIntoRequests(keywords, period);
  const ranked: RankedTopic[] = [];
  for (const body of requests) {
    ranked.push(...(await callDatalab(auth, body, fetchImpl)));
  }
  return ranked.sort((a, b) => b.score - a.score);
}

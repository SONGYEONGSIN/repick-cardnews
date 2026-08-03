/**
 * 네이버 데이터랩 **쇼핑인사이트**로 후보 키워드 순위를 매긴다 — 검색어트렌드의 대안 렌즈.
 *
 * `@/lib/naver-datalab`(검색어트렌드)과 **같은 자격 증명, 다른 규칙**이다. 헷갈리면 400 이 난다:
 *
 * | | 검색어트렌드 | 쇼핑인사이트 |
 * |---|---|---|
 * | 경로 | `/search-trend/v1/search` | `/shopping/v1/category/keywords` |
 * | `ages` | `"1"`~`"11"` (5세 단위) | **`"10" "20" "30" "40" "50" "60"`** (10년 단위) |
 * | 분야 | 없음 | **`category` 필수** |
 *
 * 위 값은 전부 2026-08-03 실호출로 확인했다(`"70"`·`"1"`·`"5"` 는 거부, 키워드 6개는
 * `should NOT have more than 5 items`).
 *
 * **쇼핑 검색 클릭 기준이라 "물건" 키워드에만 의미가 있다.** `감자전 레시피` 같은 것은 데이터가
 * 비어 점수 0이 된다 — 사라지지는 않게 두고, 이 한계는 화면이 설명한다.
 *
 * 응답값은 **상대값**이다(검색어트렌드와 같음) — "검색 N회" 처럼 절대치로 포장하면 안 된다.
 */
import { z } from "zod/v4";
import { averageRatio, buildRecentPeriod, type NaverDatalabConfig, type RankedTopic } from "./naver-datalab";

const SHOPPING_URL = "https://naverapihub.apigw.ntruss.com/shopping/v1/category/keywords";

/** 실측 확인(2026-08-03): 6개를 넣으면 `should NOT have more than 5 items`. */
export const MAX_SHOPPING_KEYWORDS_PER_REQUEST = 5;

/** 쇼핑인사이트의 30~40대. **검색어트렌드의 `NAVER_AGES_30S_40S`(5세 단위)와 다르다.** */
export const SHOPPING_AGES_30S_40S: readonly string[] = ["30", "40"];
export const SHOPPING_GENDER_FEMALE = "f";

/**
 * 쇼핑 분야 — 대표 키워드로 역추적해 확인했다(2026-08-03). 예: `기저귀`는 `50000005` 에서만,
 * `쌀`은 `50000006` 에서만 데이터가 나왔다.
 */
export const SHOPPING_CATEGORIES: readonly { id: string; name: string }[] = [
  { id: "50000005", name: "출산·육아" },
  { id: "50000006", name: "식품" },
  { id: "50000008", name: "생활·건강" },
  { id: "50000004", name: "가구·인테리어" },
  { id: "50000002", name: "화장품·미용" },
  { id: "50000003", name: "디지털·가전" },
  { id: "50000000", name: "패션의류" },
  { id: "50000001", name: "패션잡화" },
  { id: "50000007", name: "스포츠·레저" },
];

export function isShoppingCategoryId(id: string): boolean {
  return SHOPPING_CATEGORIES.some((c) => c.id === id);
}

export class NaverShoppingApiError extends Error {
  readonly body: unknown;
  constructor(message: string, body: unknown) {
    super(message);
    this.name = "NaverShoppingApiError";
    this.body = body;
  }
}

const ShoppingResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      data: z.array(z.object({ period: z.string(), ratio: z.number() })),
    }),
  ),
});

export function chunkShoppingKeywords(keywords: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < keywords.length; i += MAX_SHOPPING_KEYWORDS_PER_REQUEST) {
    chunks.push(keywords.slice(i, i + MAX_SHOPPING_KEYWORDS_PER_REQUEST));
  }
  return chunks;
}

export async function rankKeywordsByNaverShopping(
  keywords: string[],
  categoryId: string,
  auth: NaverDatalabConfig,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<RankedTopic[]> {
  const period = buildRecentPeriod(now);
  const scored: RankedTopic[] = [];

  for (const chunk of chunkShoppingKeywords(keywords)) {
    const res = await fetchImpl(SHOPPING_URL, {
      method: "POST",
      headers: {
        "X-NCP-APIGW-API-KEY-ID": auth.clientId,
        "X-NCP-APIGW-API-KEY": auth.clientSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: period.startDate,
        endDate: period.endDate,
        timeUnit: period.timeUnit,
        category: categoryId,
        keyword: chunk.map((k) => ({ name: k, param: [k] })),
        gender: SHOPPING_GENDER_FEMALE,
        ages: SHOPPING_AGES_30S_40S,
      }),
    });

    const json: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      throw new NaverShoppingApiError(`쇼핑인사이트 API 실패 (HTTP ${res.status})`, json);
    }
    const parsed = ShoppingResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new NaverShoppingApiError("쇼핑인사이트 응답 형식이 예상과 달라요", json);
    }

    // 데이터가 빈 키워드도 점수 0으로 남긴다 — 쇼핑 데이터가 없다고 후보에서 지우면 안 된다.
    const byTitle = new Map(parsed.data.results.map((r) => [r.title, averageRatio(r.data)]));
    for (const keyword of chunk) {
      scored.push({ keyword, score: byTitle.get(keyword) ?? 0 });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}

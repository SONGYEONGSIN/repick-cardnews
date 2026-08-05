import crypto from "node:crypto";

/**
 * 쿠팡 파트너스 **베스트 카테고리** — "사람들이 지금 무엇을 사는가".
 *
 * 유튜브는 **보는 것**을, 네이버는 **찾는 것**을 준다. 쿠팡은 **사는 것**을 준다 — 축이 다르다.
 * 실측(2026-08-05): 주방용품 1~5위를 물안경·물총·비치볼이 먹었다. "지금이 물놀이 철" 이라는
 * 증거인데, 영상 급상승을 살림 카테고리로 좁혀서는 안 잡히는 신호다.
 *
 * **상품명을 주제로 쓰지 않는다.** `제습기` 는 주제가 아니다. 이 목록은 Claude 에게 넘길
 * **증거**이고, 주제로 바꾸는 것은 기존 `topic-curation` 이 한다.
 *
 * 확인한 것(2026-08-05, 실제 호출):
 * - 호스트 `api-gateway.coupang.com`, 인증은 `CEA` HMAC-SHA256 서명
 * - 베스트 카테고리 경로 `/v2/providers/affiliate_open_api/apis/openapi/products/bestcategories/{id}`
 * - 응답 항목 키: productId·productName·productPrice·productImage·productUrl·categoryName·keyword·rank
 * - `keyword` 는 **주제어가 아니다** — 질의어를 그대로 되돌려준다(골드박스는 전부 `"Gold box"`)
 * - 응답 `rMessage` 로 공정위 고지 의무를 알려 준다(제휴 링크를 실제로 쓸 때 필요)
 */

const HOST = "https://api-gateway.coupang.com";
const BEST_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/bestcategories";

/**
 * 계절이 드러나는 카테고리만 쓴다.
 *
 * 실측(2026-08-05): 생활용품(키친타월·건전지)·반려(배변패드)·출산유아(물티슈)는 **1년 내내
 * 같은 소모품**이 1위였다. 넣으면 주제가 그쪽으로 끌려가 잡음만 는다.
 */
export const COUPANG_SEASONAL_CATEGORIES = [
  { id: "1016", label: "가전디지털" },
  { id: "1020", label: "주방용품" },
  { id: "1012", label: "신선식품" },
  { id: "1018", label: "자동차용품" },
] as const;

export type CoupangKeys = { accessKey: string; secretKey: string };

/** 잘 팔리는 상품 한 개 — 이름과 카테고리만 쓴다. 가격·링크는 소재 찾기에 필요 없다. */
export type CoupangBestItem = { name: string; category: string };

export class CoupangFailed extends Error {}

export function coupangBestUrl(categoryId: string, limit: number): string {
  return `${HOST}${BEST_PATH}/${categoryId}?limit=${limit}`;
}

/**
 * 쿠팡 CEA 서명. 서명 대상은 `서명시각 + 메서드 + 경로 + 질의(물음표 제외)` 다.
 *
 * `at` 은 테스트에서 고정하려고 뺐다 — 서명은 시각이 들어가 재현이 안 되면 검증할 수 없다.
 * **시크릿은 서명에만 쓰고 헤더에 담지 않는다.**
 */
export function buildCoupangAuth(
  method: string,
  path: string,
  query: string,
  keys: CoupangKeys,
  at: Date = new Date(),
): string {
  const signedDate = at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "").slice(2);
  const signature = crypto
    .createHmac("sha256", keys.secretKey)
    .update(signedDate + method + path + query)
    .digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${keys.accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** 응답에서 상품 이름과 카테고리만 꺼낸다. 모양이 다르면 빈 배열 — 화면이 깨지느니 안 준다. */
export function parseCoupangBest(body: unknown, fallbackCategory: string): CoupangBestItem[] {
  const rows = asRecord(body)?.data;
  if (!Array.isArray(rows)) return [];

  const out: CoupangBestItem[] = [];
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r || typeof r.productName !== "string") continue;
    // `[로켓배송]` 같은 대괄호 표기는 상품이 아니라 배송 방식이다 — 주제 판단에 방해가 된다.
    const name = r.productName.replace(/\[[^\]]*\]/g, "").trim();
    if (name.length === 0) continue;
    out.push({ name, category: typeof r.categoryName === "string" ? r.categoryName : fallbackCategory });
  }
  return out;
}

/**
 * 계절 카테고리를 훑어 잘 팔리는 상품을 모은다.
 *
 * **한 카테고리가 죽어도 나머지로 간다** — 전부 버리면 아무 주제도 못 뽑는다. 다만 전부
 * 실패하면 던진다: 빈 목록으로 Claude 를 부르면 근거 없는 주제가 나온다.
 */
export async function fetchCoupangBestSellers(
  keys: CoupangKeys,
  perCategory = 5,
  fetchImpl: typeof fetch = fetch,
): Promise<CoupangBestItem[]> {
  const results = await Promise.allSettled(
    COUPANG_SEASONAL_CATEGORIES.map(async (category) => {
      const path = `${BEST_PATH}/${category.id}`;
      const query = `limit=${perCategory}`;
      const res = await fetchImpl(`${HOST}${path}?${query}`, {
        headers: { Authorization: buildCoupangAuth("GET", path, query, keys) },
      });
      if (!res.ok) throw new CoupangFailed(`쿠팡 응답 ${res.status}`);
      return parseCoupangBest(await res.json(), category.label);
    }),
  );

  const ok = results.filter((r) => r.status === "fulfilled");
  if (ok.length === 0) {
    throw new CoupangFailed("쿠팡에서 아무 카테고리도 가져오지 못했습니다");
  }
  return ok.flatMap((r) => (r as PromiseFulfilledResult<CoupangBestItem[]>).value);
}

/** 실패를 한국어 안내로. 원문에는 키가 섞일 수 있으므로 **절대 그대로 내보내지 않는다.** */
export function friendlyCoupangError(_e: unknown): string {
  return "쿠팡에서 잘 팔리는 상품을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";
}

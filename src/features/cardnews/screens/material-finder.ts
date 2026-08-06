import { inKorean } from "./errors";

/**
 * 소재 찾기 화면의 **판정 모듈** — 모드·렌즈 목록과 응답 해석을 모두 여기 둔다.
 *
 * 이 저장소 vitest 는 `environment: "node"` 라 렌더 테스트를 붙일 수 없다. 그래서 판단은 전부
 * 순수 함수로 빼고 컴포넌트에는 JSX 와 배선만 남긴다.
 *
 * **후보는 언제나 유튜브에서 온다.** 네이버(검색어트렌드·쇼핑인사이트)는 후보를 만들 수 없고
 * 줄 세우기만 한다 — 모드(어디서 가져오나)와 렌즈(무엇으로 줄 세우나)를 섞지 않는 이유다.
 */

export type FinderMode = "trending" | "search" | "curated";
export type RankLens = "search-trend" | "shopping" | "claude";

/**
 * `@/lib/youtube-search` 의 동명 타입과 **일부러 따로 둔다.** 저쪽은 유튜브 응답을 파싱한
 * 결과이고 이쪽은 **우리 API 응답을 검증해 얻은 것**이다 — 서버가 필드를 바꾸면 여기서
 * `toMaterialsView` 가 걸러 내야지, 타입을 공유해 조용히 통과시키면 안 된다. 클라이언트가
 * 서버 전용 모듈(zod·fetch 를 끌고 온다)을 import 하지 않게 하는 효과도 있다.
 */
export type MaterialItem = { videoId: string; title: string; channelTitle: string };

export type FinderChoice = { id: string; name: string };

/**
 * 화면이 그릴 목록들 — **서버 모듈에서 가져오지 않고 여기 따로 둔다.**
 *
 * `@/lib/youtube-trending`·`@/lib/naver-shopping` 은 zod 와 API 호출 코드를 품은 서버 모듈이라,
 * 상수 배열 하나 때문에 import 하면 그것들이 브라우저 번들로 딸려 온다.
 *
 * 대신 **어긋나면 테스트가 깨진다** — `material-finder.test.ts` 가 서버 목록과 id·이름을
 * 대조한다. 서버에서 카테고리를 늘리거나 이름을 바꾸면 여기서 잡힌다.
 */
export const FINDER_CATEGORIES: readonly FinderChoice[] = [
  { id: "26", name: "살림·요리·꿀팁" },
  { id: "22", name: "일상·브이로그" },
  { id: "28", name: "생활기술·가전" },
];

/** 쇼핑인사이트 분야. 순서도 서버와 같게 둔다 — 화면에 그대로 나열된다. */
export const FINDER_SHOPPING_CATEGORIES: readonly FinderChoice[] = [
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

/**
 * 쿠팡 소재와 짝이 맞는 쇼핑인사이트 분야의 id.
 *
 * 쿠팡은 **네 분야만** 긁는다(`@/lib/coupang-best` 의 `COUPANG_SEASONAL_CATEGORIES`):
 * 가전디지털 · 주방용품 · 신선식품 · 자동차용품. 그런데 쇼핑인사이트 분야는 아홉이라
 * 패션의류처럼 쿠팡이 가져오지도 않는 분야를 고를 수 있었다. 고르면 데이터가 없어 Claude
 * 순위로 밀린다 — 유튜브에 쇼핑인사이트를 걸었을 때와 똑같은 헛수고다.
 *
 * 짝을 이렇게 봤다(**측정값이 아니라 판단이다**):
 * | 쿠팡 | 쇼핑인사이트 |
 * |---|---|
 * | 가전디지털 | 디지털·가전 |
 * | 신선식품 | 식품 |
 * | 주방용품 | 생활·건강 · 가구·인테리어 |
 * | 자동차용품 | **없음** — 쇼핑인사이트에 대응 분야가 없다 |
 *
 * 자동차용품 소재는 어느 분야로도 제대로 줄 서지 않는다. 그래서 분야를 늘리는 대신 그 한계를
 * 여기 적어 둔다 — 없는 분야를 만들어 주는 것보다 낫다.
 */
export const SELLING_SHOPPING_CATEGORY_IDS: ReadonlySet<string> = new Set([
  "50000003", // 디지털·가전
  "50000006", // 식품
  "50000008", // 생활·건강
  "50000004", // 가구·인테리어
]);

/** 위 id 로 추린 목록. **손으로 다시 적지 않고 걸러 낸다** — 이름이 두 곳에서 갈리지 않게. */
export const SELLING_SHOPPING_CATEGORIES: readonly FinderChoice[] = FINDER_SHOPPING_CATEGORIES.filter((c) =>
  SELLING_SHOPPING_CATEGORY_IDS.has(c.id),
);

/** 모드는 **속도**로 갈린다 — 앞의 둘은 Claude 를 안 써서 1~2초, 마지막은 100초. */
export const FINDER_MODES: readonly { id: FinderMode; label: string; hint: string }[] = [
  {
    id: "trending",
    label: "급상승",
    hint: "유튜브에서 지금 인기인 영상 제목을 그대로 보여 줘요. 1~2초면 나와요.",
  },
  {
    id: "search",
    label: "키워드로 찾기",
    hint: "찾고 싶은 걸 적으면 관련 영상 제목을 보여 줘요. 1~2초면 나오지만 하루 100번까지예요.",
  },
  {
    id: "curated",
    label: "소재 추천",
    hint: "요즘 보는 것(유튜브)이나 사는 것(쿠팡)에서 모아 Claude가 생활 정보 주제로 다듬어 줘요. 보통 1분 40초쯤 걸려요.",
  },
];

export const RANK_LENSES: readonly { id: RankLens; label: string; hint: string }[] = [
  {
    id: "search-trend",
    label: "검색어트렌드",
    hint: "30~40대 여성이 통합검색에서 얼마나 찾는지로 줄 세워요.",
  },
  {
    id: "shopping",
    label: "쇼핑인사이트",
    hint: "쇼핑에서 얼마나 눌리는지로 줄 세워요. 물건 소재일 때만 의미가 있어요 — 분야를 함께 골라 주세요.",
  },
  { id: "claude", label: "Claude 판단", hint: "네이버 없이 Claude가 본 관련성 순서로 줄 세워요." },
];

/**
 * 렌즈를 고를 수 있는지. **막되 숨기지 않는다** — 왜 못 쓰는지 알아야 풀 수 있다.
 *
 * 막는 이유가 둘이고 성격이 다르다:
 *
 * 1. **네이버 키가 없다** — 설정 문제라 화면에서 무엇을 눌러도 안 풀린다. 그래서 먼저 말한다.
 * 2. **쇼핑인사이트인데 후보가 유튜브에서 온다** — 쇼핑인사이트는 쇼핑 클릭 비중으로 줄
 *    세우는데 유튜브 후보에는 물건이 아닌 것이 많다(`감자전 레시피`). 데이터가 없어 결국
 *    Claude 순위로 폴백되는데, 그걸 100초 기다린 뒤에 알게 된다. 고르기 전에 막는다.
 *
 * 서버(`/api/topics`)는 이 조합을 계속 받아 준다 — 거기서는 폴백이 옳은 답이다(`rankedBy` 로
 * 무엇으로 줄 세웠는지 밝힌다). 여기서 막는 것은 **사람의 100초를 아끼려는 것**이지 조합이
 * 위험해서가 아니다.
 */
export function lensAvailability(
  lens: RankLens,
  naverConfigured: boolean,
  source: TopicSourceId = "youtube",
): { enabled: boolean; reason: string | null } {
  if (lens === "claude") return { enabled: true, reason: null };
  if (!naverConfigured) return { enabled: false, reason: "네이버 클라이언트 ID·시크릿을 넣으면 쓸 수 있어요." };
  if (lens === "shopping" && source !== "selling") {
    return { enabled: false, reason: "‘요즘 사는 것’으로 찾을 때만 쓸 수 있어요 — 물건이라야 쇼핑 데이터가 있어요." };
  }
  return { enabled: true, reason: null };
}

/**
 * 출처를 바꾼 뒤에 쓸 렌즈. 고른 렌즈가 여전히 쓸 수 있으면 **그대로 둔다** — 사용자가 고른
 * 것을 함부로 바꾸지 않는다. 못 쓰게 됐을 때만 쓸 수 있는 것으로 되돌린다.
 *
 * 이걸 안 하면 흐려진 렌즈가 선택된 채 남고, 그 조합으로 요청이 나간다.
 */
export function lensAfterSourceChange(lens: RankLens, naverConfigured: boolean, source: TopicSourceId): RankLens {
  if (lensAvailability(lens, naverConfigured, source).enabled) return lens;
  if (lensAvailability("search-trend", naverConfigured, source).enabled) return "search-trend";
  return "claude";
}

export function buildMaterialsQuery(mode: FinderMode, opts: { categoryIds: string[]; query: string }): string {
  const params = new URLSearchParams({ mode });
  if (mode === "search") params.set("q", opts.query);
  else params.set("categories", opts.categoryIds.join(","));
  return params.toString();
}

/** 후보를 어디서 가져올지. 유튜브는 **보는 것**, 쿠팡은 **사는 것**을 준다. */
export type TopicSourceId = "youtube" | "selling";

export const TOPIC_SOURCES: readonly { id: TopicSourceId; label: string; hint: string }[] = [
  { id: "youtube", label: "요즘 보는 것", hint: "유튜브 인기 급상승에서 찾아요" },
  { id: "selling", label: "요즘 사는 것", hint: "쿠팡에서 잘 팔리는 것으로 찾아요" },
];

export function buildTopicsQuery(
  lens: RankLens,
  shoppingCategoryId: string,
  source: TopicSourceId = "youtube",
): string {
  // 출처가 바뀌어도 순위를 매기는 자(렌즈)는 그대로다 — 자가 달라지면 두 결과를 견줄 수 없다.
  const params = new URLSearchParams({ lens, source });
  // 분야는 쇼핑인사이트일 때만 뜻이 있다 — 다른 렌즈에 실어 보내면 서버가 헷갈린다.
  if (lens === "shopping") params.set("shoppingCategory", shoppingCategoryId);
  return params.toString();
}

export type MaterialsView =
  | { kind: "items"; items: MaterialItem[]; mode: FinderMode; query: string; categories: string[]; skipped: string[] }
  | { kind: "empty"; mode: FinderMode; query: string; categories: string[]; skipped: string[] }
  | { kind: "error"; message: string };

const FALLBACK_ERROR = "소재를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toItems(value: unknown): MaterialItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: MaterialItem[] = [];
  for (const raw of value) {
    const record = asRecord(raw);
    const videoId = record && asString(record.videoId);
    const title = record && asString(record.title);
    if (!record || !videoId || !title) return null;
    items.push({ videoId, title, channelTitle: asString(record.channelTitle) ?? "" });
  }
  return items;
}

/** 응답이 밝힌 모드만 인정한다 — 모르면 출처를 지어내느니 오류로 접는다. */
function toMode(value: unknown): FinderMode | null {
  return value === "trending" || value === "search" || value === "curated" ? value : null;
}

export function toMaterialsView(status: number, body: unknown): MaterialsView {
  const record = asRecord(body);
  if (status !== 200) {
    return { kind: "error", message: inKorean(asString(record?.error) ?? "", FALLBACK_ERROR) };
  }
  const items = record && toItems(record.items);
  // 모드는 **응답에서** 읽는다. 화면의 현재 탭에서 가져오면, 탭을 바꿨을 때 남아 있는 결과의
  // 출처를 거짓으로 말하게 된다(이 화면은 탭을 바꿔도 결과를 지우지 않는다).
  const mode = record && toMode(record.mode);
  if (!record || !items || !mode) return { kind: "error", message: FALLBACK_ERROR };

  const query = asString(record.query) ?? "";
  const categories = toStringList(record.youtubeCategories);
  const skipped = toStringList(record.skippedYoutubeCategories);
  if (items.length === 0) return { kind: "empty", mode, query, categories, skipped };
  return { kind: "items", items, mode, query, categories, skipped };
}

/** 결과 위에 붙일 후보 출처 한 줄. **그 결과를 만든 요청**을 따른다. */
export function materialsSourceLine(view: MaterialsView): string | null {
  if (view.kind === "error") return null;
  if (view.mode === "search") return `유튜브 검색 · “${view.query}”`;
  const base = "유튜브 인기 급상승(한국)";
  return view.categories.length > 0 ? `${base} · ${view.categories.join(", ")}` : base;
}

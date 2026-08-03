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
    hint: "급상승에서 모아 Claude가 생활 정보 주제로 다듬어 줘요. 보통 1분 40초쯤 걸려요.",
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

/** 네이버 키가 없으면 네이버 렌즈는 **막되 숨기지 않는다** — 왜 못 쓰는지 알아야 넣을 수 있다. */
export function lensAvailability(lens: RankLens, naverConfigured: boolean): { enabled: boolean; reason: string | null } {
  if (lens === "claude" || naverConfigured) return { enabled: true, reason: null };
  return { enabled: false, reason: "네이버 클라이언트 ID·시크릿을 넣으면 쓸 수 있어요." };
}

export function buildMaterialsQuery(mode: FinderMode, opts: { categoryIds: string[]; query: string }): string {
  const params = new URLSearchParams({ mode });
  if (mode === "search") params.set("q", opts.query);
  else params.set("categories", opts.categoryIds.join(","));
  return params.toString();
}

export function buildTopicsQuery(lens: RankLens, shoppingCategoryId: string): string {
  const params = new URLSearchParams({ lens });
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

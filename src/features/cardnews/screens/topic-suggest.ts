import { inKorean } from "./errors";

/**
 * `GET /api/topics` 응답을 **화면이 그릴 상태**로 바꾸는 판정 모듈.
 *
 * 응답 형태의 근거는 `src/app/api/topics/route.ts` 하나다. 이 파일은 그 응답을 읽어
 * "결과 있음 / 없음 / 오류" 중 무엇인지, 순위 근거를 어떻게 보여 줄지만 정한다 — 문구를
 * 새로 짓지 않고 **서버가 준 `note`·`message` 를 그대로 들고 간다**. 근거 문구가 서버와
 * 화면 두 곳에 갈라지면 라우트를 고쳤을 때 화면만 옛말을 하게 된다.
 *
 * 컴포넌트(`TopicSuggestPanel`)에는 JSX 와 배선만 남긴다 — 이 저장소의 vitest 는
 * `environment: "node"` 라 렌더 테스트를 붙일 수 없어서, 판단은 전부 여기로 뺀다.
 */

/** Claude 추리기가 포함된 호출이라 실측 100초 안팎이 걸린다(2026-08-02, `/api/topics` 주석 참고). */
export const TOPICS_EXPECTED_SECONDS = 100;

export type TopicItem = { keyword: string; reason: string };

/**
 * 순위 근거. `rankedBy` 세 값 중 **"설정은 있는데 연결하지 못함"만 사용자가 할 일이 있는
 * 상태**(자격 증명 확인)라 따로 표시해야 한다 — 나머지 둘은 정상이다. 그래서 값 자체가 아니라
 * "눈에 띄게 보여 줄 것인가"로 좁혀 넘긴다.
 */
export type BasisView = { note: string; needsAttention: boolean };

export type TopicsResults = {
  kind: "results";
  topics: TopicItem[];
  basis: BasisView;
  /** 후보가 상한보다 적을 때 서버가 주는 설명. 없으면 null. */
  message: string | null;
  /** 실제로 후보를 가져온 유튜브 카테고리 이름(한국어) — 출처를 밝히는 데 쓴다. */
  categories: string[];
  /** 오늘 가져오지 못한 유튜브 카테고리 이름 — 감추지 않는다. */
  skipped: string[];
};
export type TopicsEmpty = {
  kind: "empty";
  basis: BasisView;
  message: string | null;
  categories: string[];
  skipped: string[];
};
export type TopicsError = { kind: "error"; message: string };
export type TopicsView = TopicsResults | TopicsEmpty | TopicsError;

const FALLBACK_ERROR = "트렌드 주제를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toItems(value: unknown): TopicItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: TopicItem[] = [];
  for (const raw of value) {
    const record = asRecord(raw);
    const keyword = record && asString(record.keyword);
    if (!record || !keyword) return null;
    // 데이터랩 정렬 경로는 짝을 못 찾은 후보에 빈 이유를 담는다(route.ts) — 이유는 없을 수 있다.
    items.push({ keyword, reason: asString(record.reason) ?? "" });
  }
  return items;
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** 오류 문구는 언제나 한국어다 — 서버가 준 한국어는 그대로, 그 밖(브라우저 영문·JSON)은 안내로 바꾼다. */
export function errorView(raw: string): TopicsError {
  return { kind: "error", message: inKorean(raw, FALLBACK_ERROR) };
}

export function toTopicsView(status: number, body: unknown): TopicsView {
  const record = asRecord(body);
  if (status !== 200) return errorView(asString(record?.error) ?? "");
  const topics = record && toItems(record.topics);
  // 200 인데 형태가 어긋나면(빈 본문·HTML 등) 사용자에게 raw 를 보이지 않고 오류로 접는다.
  if (!record || !topics) return errorView("");

  const basis: BasisView = {
    note: asString(record.note) ?? "",
    needsAttention: record.rankedBy === "claude-naver-unavailable",
  };
  const message = asString(record.message);
  const categories = toStringList(record.youtubeCategories);
  const skipped = toStringList(record.skippedYoutubeCategories);

  if (topics.length === 0) return { kind: "empty", basis, message, categories, skipped };
  return { kind: "results", topics, basis, message, categories, skipped };
}

/**
 * **후보는 언제나 유튜브에서 온다.** 데이터랩은 그 후보를 줄 세울 뿐 후보를 만들지 않는다 —
 * 화면에서 둘이 "어느 쪽에서 가져왔나" 로 경쟁하는 것처럼 보이면 사용자가 헷갈린다.
 */
export const CANDIDATE_SOURCE = "유튜브 인기 급상승(한국)";

/** 후보 출처 한 줄. 실제로 쓴 카테고리를 알면 붙이고, 모르면 출처 이름만 말한다. */
export function candidateSourceLine(view: TopicsView): string | null {
  if (view.kind === "error") return null;
  return view.categories.length > 0 ? `${CANDIDATE_SOURCE} · ${view.categories.join(", ")}` : CANDIDATE_SOURCE;
}

/** 경과·예상 시간을 사람이 읽는 단위로. 초 단위 숫자가 화면에서 그대로 커지지 않게 한다. */
export function elapsedLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total}초`;
  const rest = total % 60;
  return rest === 0 ? `${Math.floor(total / 60)}분` : `${Math.floor(total / 60)}분 ${rest}초`;
}

const EXPECTED_LABEL = elapsedLabel(TOPICS_EXPECTED_SECONDS);

/**
 * 누르기 전 안내 — **버튼을 눌러야 시작한다는 것**, 얼마나 걸리는지, 그리고 **어디서
 * 가져오는지**를 미리 말한다. 두 출처의 역할이 다르다는 것(유튜브=후보, 데이터랩=순위)이
 * 여기서부터 드러나야 결과를 보고 헷갈리지 않는다. 데이터랩은 **검색어트렌드**임을 밝힌다 —
 * 쇼핑인사이트와 다른 API 다.
 */
export const TOPICS_IDLE_HINT = `${CANDIDATE_SOURCE}에서 생활 정보로 다듬을 만한 후보를 모으고, 네이버 데이터랩 검색어트렌드로 30~40대 여성 검색 비중 순으로 정렬해요. 누른 뒤 보통 ${EXPECTED_LABEL}쯤 걸려요.`;

/**
 * 기다리는 동안 읽어 줄 한 줄. 예상 시간을 넘기면 문구가 바뀐다 — 같은 문장이 계속 있으면
 * 멈춘 것으로 읽힌다. 경과 초는 이 문장에 넣지 않는다(1초마다 스크린리더가 다시 읽는다).
 */
export function waitingStatus(elapsedSeconds: number): string {
  return elapsedSeconds < TOPICS_EXPECTED_SECONDS
    ? `요즘 뜨는 것을 훑어 주제를 고르는 중이에요. 보통 ${EXPECTED_LABEL}쯤 걸려요.`
    : `아직 고르는 중이에요. 보통 ${EXPECTED_LABEL}쯤 걸리는데 조금 더 걸리고 있어요. 그만두고 직접 입력해도 돼요.`;
}

/** 지금 주제 칸의 값이 후보 중 하나와 같으면 그것이 고른 주제다 — 고른 상태를 따로 저장하지 않는다. */
export function selectedKeyword(topics: TopicItem[], keyword: string): string | null {
  const trimmed = keyword.trim();
  return topics.some((t) => t.keyword === trimmed) ? trimmed : null;
}

/** 결과·없음·오류 어느 쪽이든 스크린리더가 읽을 한 줄. 목록 자체는 라이브 영역 밖에 둔다. */
export function panelStatus(view: TopicsView, keyword: string): string {
  if (view.kind === "error") return view.message;
  if (view.kind === "empty") {
    const guide = "주제 칸에 직접 입력해 주세요.";
    return view.message ? `${view.message} ${guide}` : guide;
  }
  const chosen = selectedKeyword(view.topics, keyword);
  if (chosen) return `주제를 ‘${chosen}’ 로 골랐어요. 주제 칸에서 고치거나 다른 것을 눌러 바꿀 수 있어요.`;
  return `주제 ${view.topics.length}개를 가져왔어요. 하나를 누르면 주제 칸에 들어가요.`;
}

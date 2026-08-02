# 소재 찾기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주제를 직접 타이핑하는 대신, 뜨는 소재를 **빠르게 훑거나(1~2초)** 다듬어 받아(100초) 골라 오는 전용 화면을 만든다.

**Architecture:** 후보는 언제나 유튜브에서 온다(급상승 `videos.list` / 키워드 검색 `search.list`). 네이버(검색어트렌드·쇼핑인사이트)는 후보를 만들 수 없고 **줄 세우기만** 한다. 빠른 두 모드는 영상 제목을 날것으로 돌려주는 새 라우트 `/api/materials` 가 맡고, 느린 소재 추천 모드는 기존 `/api/topics` 에 순위 렌즈 선택을 붙여 쓴다. 화면은 `state.step` 을 건드리지 않는 별도 뷰다.

**Tech Stack:** Next.js App Router, TypeScript, zod v4, Tailwind, vitest(`environment: "node"`)

## Global Constraints

- **네이버는 후보를 만들 수 없다.** 검색어트렌드·쇼핑인사이트 모두 `keyword` 를 **입력으로 요구**한다. "네이버에서 가져오기" 를 만들지 마라.
- **사용자에게 영어·raw JSON 을 절대 보이지 마라.** 모든 오류는 한국어. `inKorean(raw, fallback)`(`src/features/cardnews/screens/errors.ts`) 을 쓴다.
- **비밀값 금지**: API 키·시크릿은 응답·오류·로그 어디에도 담지 않는다. `.env.local` 을 열지 마라.
- **`git add -A` 금지.** 만든 경로만 명시적으로 add 한다(`.claude/` 미추적, `.env.local` 에 실제 자격증명).
- **무채색**: 액센트 색 없음. 강조는 검정 채움·테두리 2px·굵기로만. 이모지 금지. 하드코딩 색상 금지(토큰만). `npm run design:audit` 이 게이트다.
- **렌더 테스트 불가**: vitest 가 `environment: "node"` 다. 판단 로직은 순수 함수로 빼서 테스트하고 컴포넌트에는 JSX·배선만 남긴다.
- **RED 먼저**: 모든 구현은 실패하는 테스트를 확인한 뒤 작성한다.
- **`/api/topics` 실호출 금지**(Claude 할당량 1회 100초). Task 8 최종 확인에서 **한 번만**. `/api/materials` 는 Claude 를 안 쓰므로 자유롭게 확인한다.
- **로컬 전용**: 새 라우트도 `isLocalHost(req.headers.get("host"))`(`@/lib/local-guard`) 로 막는다. 실패 시 403 + 한국어.

### 실측으로 확정된 값 — 그대로 쓴다

| 항목 | 값 | 근거 |
|---|---|---|
| API HUB 호스트 | `https://naverapihub.apigw.ntruss.com` | 2026-08-02 실호출 |
| 인증 헤더 | `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY` | 2026-08-02 실호출 |
| 검색어트렌드 경로 | `/search-trend/v1/search` | 2026-08-02 실호출 |
| 쇼핑인사이트 경로 | `/shopping/v1/category/keywords` | 2026-08-03 실호출 |
| 쇼핑 키워드 상한 | **5개** (`should NOT have more than 5 items`) | 2026-08-03 실호출 |
| 쇼핑 `gender` | `"f"` / `"m"` (`"female"` 거부) | 2026-08-03 실호출 |
| 쇼핑 `ages` | **`"10" "20" "30" "40" "50" "60"`** (`"70"`·`"1"`·`"5"`·`"15"` 거부) | 2026-08-03 실호출 |
| 검색어트렌드 `ages` | `"1"`~`"11"` (5세 단위) — **쇼핑과 체계가 다르다** | 2026-08-02 확인 |
| 쇼핑 분야 ID | `50000000` 패션의류 / `50000001` 패션잡화 / `50000002` 화장품·미용 / `50000003` 디지털·가전 / `50000004` 가구·인테리어 / `50000005` 출산·육아 / `50000006` 식품 / `50000007` 스포츠·레저 / `50000008` 생활·건강 | 2026-08-03 대표 키워드 역추적 |
| `videos.list` 유닛 | 1 | 공식 문서 |
| `search.list` 유닛 | **100** (하루 10,000 → 100회) | 공식 문서 |
| KR `mostPopular` 지원 카테고리 | `26` `22` `28` (`27`·`19` 는 `notFound`) | 2026-08-02 실측 |

> **`ages` 를 두 API 사이에서 절대 공유하지 마라.** 검색어트렌드의 30~40대는 `["5","6","7","8"]`,
> 쇼핑인사이트의 30~40대는 `["30","40"]` 이다. 상수를 재사용하면 400 이 난다.

---

## File Structure

**신규**
- `src/lib/youtube-search.ts` — `search.list` 키워드 검색. 100유닛 상수·한국어 오류
- `src/lib/youtube-search.test.ts`
- `src/lib/naver-shopping.ts` — 쇼핑인사이트 순위. 분야 목록·연령 체계는 데이터랩과 별개
- `src/lib/naver-shopping.test.ts`
- `src/app/api/materials/route.ts` — 빠른 두 모드(급상승·키워드 검색). Claude 안 씀
- `src/app/api/materials/route.test.ts`
- `src/features/cardnews/screens/material-finder.ts` — 모드·렌즈·응답 판정(순수)
- `src/features/cardnews/screens/material-finder.test.ts`
- `src/features/cardnews/screens/MaterialFinderScreen.tsx` — 소재 찾기 화면

**수정**
- `src/lib/youtube-trending.ts` — 카테고리를 인자로 받게
- `src/lib/youtube-trending.test.ts`
- `src/app/api/topics/route.ts` — 순위 렌즈 선택(`lens`·`shoppingCategory`)
- `src/app/api/topics/route.test.ts`
- `src/features/cardnews/screens/TopicScreen.tsx` — 패널 제거, 열기 버튼
- `src/features/cardnews/CardnewsFlow.tsx` — 화면 전환
- `src/features/cardnews/screens/TopicSuggestPanel.tsx` — 소재 추천 모드로 흡수(파일 유지, 화면에서 재사용)

---

### Task 1: 급상승 카테고리를 고를 수 있게

**Files:**
- Modify: `src/lib/youtube-trending.ts`
- Test: `src/lib/youtube-trending.test.ts`

**Interfaces:**
- Consumes: 기존 `LIFESTYLE_CATEGORIES`, `combineCategoryResults`, `fetchYoutubeTrendingByCategory`
- Produces:
  - `parseCategoryIds(raw: string | null): YoutubeCategory[]` — 쉼표로 구분된 id 문자열을 알려진 카테고리로 바꾼다. 빈 값·`null`·전부 미지 → `LIFESTYLE_CATEGORIES` 전체
  - `fetchYoutubeTrendingCandidates(apiKey: string, categories?: readonly YoutubeCategory[], fetchImpl?: typeof fetch): Promise<CombinedCandidates>` — 두 번째 인자 추가(기본값은 전체)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/youtube-trending.test.ts` 에 추가 (import 에 `parseCategoryIds` 추가):

```ts
describe("parseCategoryIds — 요청한 카테고리만 고른다", () => {
  it("쉼표로 구분된 id 를 알려진 카테고리로 바꾼다", () => {
    expect(parseCategoryIds("26,28").map((c) => c.id)).toEqual(["26", "28"]);
  });

  it("목록에 없는 id 는 조용히 버린다 — 지원 확인된 카테고리만 부른다", () => {
    expect(parseCategoryIds("26,27,99").map((c) => c.id)).toEqual(["26"]);
  });

  it("빈 값이면 전체를 쓴다", () => {
    expect(parseCategoryIds(null)).toEqual(LIFESTYLE_CATEGORIES);
    expect(parseCategoryIds("")).toEqual(LIFESTYLE_CATEGORIES);
  });

  it("전부 모르는 id 면 전체로 되돌린다 — 빈손으로 부르지 않는다", () => {
    expect(parseCategoryIds("99,100")).toEqual(LIFESTYLE_CATEGORIES);
  });

  it("공백과 중복을 정리한다", () => {
    expect(parseCategoryIds(" 26 , 26 ,22 ").map((c) => c.id)).toEqual(["26", "22"]);
  });
});

describe("fetchYoutubeTrendingCandidates — 카테고리 선택", () => {
  it("건네준 카테고리만 부른다", async () => {
    const called: string[] = [];
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      called.push(new URL(String(input)).searchParams.get("videoCategoryId") ?? "");
      return { ok: true, status: 200, json: async () => ({ items: [] }) };
    });

    await fetchYoutubeTrendingCandidates("key", [LIFESTYLE_CATEGORIES[0]], mockFetch as unknown as typeof fetch);

    expect(called).toEqual(["26"]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/youtube-trending.test.ts`
Expected: FAIL — `parseCategoryIds is not a function`

- [ ] **Step 3: 구현**

`src/lib/youtube-trending.ts` 에 추가:

```ts
/**
 * 요청받은 카테고리 id 를 **지원이 확인된 것만** 골라 돌려준다. 모르는 id 를 그대로 부르면
 * `notFound` 로 실패하므로(파일 상단 주석 참고) 여기서 걸러 낸다. 아무것도 안 남으면 전체로
 * 되돌린다 — 빈손으로 부르는 것보다 낫다.
 */
export function parseCategoryIds(raw: string | null): readonly YoutubeCategory[] {
  const wanted = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const picked: YoutubeCategory[] = [];
  for (const id of wanted) {
    if (seen.has(id)) continue;
    const found = LIFESTYLE_CATEGORIES.find((c) => c.id === id);
    if (!found) continue;
    seen.add(id);
    picked.push(found);
  }
  return picked.length > 0 ? picked : LIFESTYLE_CATEGORIES;
}
```

`fetchYoutubeTrendingCandidates` 시그니처 교체:

```ts
export async function fetchYoutubeTrendingCandidates(
  apiKey: string,
  categories: readonly YoutubeCategory[] = LIFESTYLE_CATEGORIES,
  fetchImpl: typeof fetch = fetch,
): Promise<CombinedCandidates> {
  const settled = await Promise.allSettled(
    categories.map((category) => fetchYoutubeTrendingByCategory(apiKey, category.id, fetchImpl)),
  );

  const results: CategoryFetchResult[] = settled.map((result, i) => {
    const category = categories[i];
    return result.status === "fulfilled"
      ? { status: "fulfilled", category, candidates: result.value }
      : { status: "rejected", category, error: result.reason };
  });

  return combineCategoryResults(results);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 전부 통과, tsc 출력 없음. **`/api/topics/route.ts` 의 호출부가 2인자 `fetchImpl` 을 넘기고 있지 않은지 확인** — 기존 호출은 `fetchYoutubeTrendingCandidates(config.youtubeApiKey)` 라 그대로 동작한다.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/youtube-trending.ts src/lib/youtube-trending.test.ts
git commit -m "feat: 급상승 카테고리를 고를 수 있게"
```

---

### Task 2: 유튜브 키워드 검색

**Files:**
- Create: `src/lib/youtube-search.ts`, `src/lib/youtube-search.test.ts`

**Interfaces:**
- Consumes: `YoutubeApiError`(`@/lib/youtube-trending`) 를 재사용한다 — 새 오류 클래스를 만들지 마라
- Produces:
  - `MaterialItem = { videoId: string; title: string; channelTitle: string }`
  - `YOUTUBE_SEARCH_UNIT_COST = 100`, `YOUTUBE_SEARCH_DAILY_LIMIT = 100`
  - `buildYoutubeSearchUrl(apiKey: string, query: string, maxResults?: number): string`
  - `fetchYoutubeSearchMaterials(apiKey: string, query: string, fetchImpl?: typeof fetch): Promise<MaterialItem[]>`
  - `friendlyYoutubeSearchError(e: unknown): string`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/youtube-search.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { YoutubeApiError } from "./youtube-trending";
import {
  YOUTUBE_SEARCH_DAILY_LIMIT,
  YOUTUBE_SEARCH_UNIT_COST,
  buildYoutubeSearchUrl,
  fetchYoutubeSearchMaterials,
  friendlyYoutubeSearchError,
} from "./youtube-search";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("buildYoutubeSearchUrl", () => {
  it("search.list 를 한국·영상 한정으로 부른다", () => {
    const url = new URL(buildYoutubeSearchUrl("key", "에어컨 전기세"));

    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/youtube/v3/search");
    expect(url.searchParams.get("part")).toBe("snippet");
    expect(url.searchParams.get("type")).toBe("video");
    expect(url.searchParams.get("regionCode")).toBe("KR");
    expect(url.searchParams.get("q")).toBe("에어컨 전기세");
    expect(url.searchParams.get("key")).toBe("key");
  });
});

describe("호출 비용", () => {
  it("search.list 는 호출당 100유닛이라 하루 100회다", () => {
    expect(YOUTUBE_SEARCH_UNIT_COST).toBe(100);
    expect(YOUTUBE_SEARCH_DAILY_LIMIT).toBe(10_000 / YOUTUBE_SEARCH_UNIT_COST);
  });
});

describe("fetchYoutubeSearchMaterials", () => {
  it("영상 제목과 채널명을 뽑아 온다", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse(200, {
        items: [
          { id: { videoId: "v1" }, snippet: { title: "제목1", channelTitle: "채널1" } },
          { id: { videoId: "v2" }, snippet: { title: "제목2", channelTitle: "채널2" } },
        ],
      }),
    );

    const items = await fetchYoutubeSearchMaterials("key", "질문", mockFetch as unknown as typeof fetch);

    expect(items).toEqual([
      { videoId: "v1", title: "제목1", channelTitle: "채널1" },
      { videoId: "v2", title: "제목2", channelTitle: "채널2" },
    ]);
  });

  it("영상이 아닌 결과(채널·재생목록)는 videoId 가 없어 걸러진다", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse(200, {
        items: [
          { id: { channelId: "c1" }, snippet: { title: "채널", channelTitle: "채널" } },
          { id: { videoId: "v1" }, snippet: { title: "제목1", channelTitle: "채널1" } },
        ],
      }),
    );

    const items = await fetchYoutubeSearchMaterials("key", "질문", mockFetch as unknown as typeof fetch);

    expect(items.map((i) => i.videoId)).toEqual(["v1"]);
  });

  it("HTTP 실패는 YoutubeApiError 로 감싸 던진다", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(403, { error: { errors: [{ reason: "quotaExceeded" }] } }));

    await expect(
      fetchYoutubeSearchMaterials("key", "질문", mockFetch as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(YoutubeApiError);
  });
});

describe("friendlyYoutubeSearchError — 언제나 한국어", () => {
  it("하루 한도 초과는 검색이 100유닛이라는 사실까지 알려 준다", () => {
    const message = friendlyYoutubeSearchError(
      new YoutubeApiError("HTTP 403", { error: { errors: [{ reason: "quotaExceeded" }] } }),
    );

    expect(message).toContain("100번");
    expect(/[가-힣]/.test(message)).toBe(true);
  });

  it("모르는 실패도 영문을 노출하지 않는다", () => {
    const message = friendlyYoutubeSearchError(new Error("Failed to fetch"));

    expect(message).not.toContain("fetch");
    expect(/[가-힣]/.test(message)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/youtube-search.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/lib/youtube-search.ts`:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/youtube-search.test.ts && npx tsc --noEmit`
Expected: 전부 통과, tsc 출력 없음

- [ ] **Step 5: 커밋**

```bash
git add src/lib/youtube-search.ts src/lib/youtube-search.test.ts
git commit -m "feat: 유튜브 키워드 검색으로 소재 후보 가져오기"
```

---

### Task 3: `/api/materials` — 빠른 두 모드

**Files:**
- Create: `src/app/api/materials/route.ts`, `src/app/api/materials/route.test.ts`

**Interfaces:**
- Consumes: `parseCategoryIds`·`fetchYoutubeTrendingCandidates`·`friendlyYoutubeError`(Task 1), `fetchYoutubeSearchMaterials`·`friendlyYoutubeSearchError`·`MaterialItem`(Task 2), `checkYoutubeConfig`(`@/lib/topics-config`), `isLocalHost`(`@/lib/local-guard`)
- Produces: `GET /api/materials`
  - `?mode=trending&categories=26,22` → `{ items, mode: "trending", youtubeCategories: string[], skippedYoutubeCategories?: string[] }`
  - `?mode=search&q=<검색어>` → `{ items, mode: "search", query: string }`
  - `items: MaterialItem[]`
  - 오류: `{ error: "<한국어>" }` + 상태코드

**참고**: 이 라우트는 **Claude 를 부르지 않는다.** 1~2초 안에 끝나야 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/api/materials/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

function makeRequest(host: string, query: string) {
  return new Request(`http://${host}/api/materials?${query}`, { headers: { host } });
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const OLD_ENV = { ...process.env };

beforeEach(() => {
  process.env.YOUTUBE_API_KEY = "yt-key";
});
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/materials — 로컬 전용", () => {
  it("다른 기기에서 부르면 403 과 한국어 안내를 준다", async () => {
    const res = await GET(makeRequest("192.168.0.5:3500", "mode=trending"));

    expect(res.status).toBe(403);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
  });
});

describe("GET /api/materials — 급상승", () => {
  it("요청한 카테고리만 부르고 영상 제목을 그대로 돌려준다", async () => {
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const id = new URL(String(input)).searchParams.get("videoCategoryId") ?? "";
        asked.push(id);
        return jsonResponse(200, {
          items: [{ id: `v-${id}`, snippet: { title: `제목-${id}`, channelTitle: "채널", categoryId: id } }],
        });
      }),
    );

    const res = await GET(makeRequest("localhost:3500", "mode=trending&categories=26"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(asked).toEqual(["26"]);
    expect(data.mode).toBe("trending");
    expect(data.items).toEqual([{ videoId: "v-26", title: "제목-26", channelTitle: "채널" }]);
    expect(data.youtubeCategories).toEqual(["살림·요리·꿀팁"]);
  });

  it("카테고리 하나가 실패해도 나머지로 진행하고 건너뛴 것을 한국어로 밝힌다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const id = new URL(String(input)).searchParams.get("videoCategoryId") ?? "";
        if (id === "22") return jsonResponse(404, { error: { errors: [{ reason: "notFound" }] } });
        return jsonResponse(200, {
          items: [{ id: `v-${id}`, snippet: { title: `제목-${id}`, channelTitle: "채널", categoryId: id } }],
        });
      }),
    );

    const data = await (await GET(makeRequest("localhost:3500", "mode=trending"))).json();

    expect(data.skippedYoutubeCategories).toEqual(["일상·브이로그"]);
    expect(data.items.length).toBeGreaterThan(0);
  });
});

describe("GET /api/materials — 키워드 검색", () => {
  it("검색어를 유튜브에 그대로 넘기고 결과를 돌려준다", async () => {
    let seen = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        seen = new URL(String(input)).searchParams.get("q") ?? "";
        return jsonResponse(200, {
          items: [{ id: { videoId: "v1" }, snippet: { title: "제목1", channelTitle: "채널1" } }],
        });
      }),
    );

    const data = await (await GET(makeRequest("localhost:3500", "mode=search&q=%EC%A0%84%EA%B8%B0%EC%84%B8"))).json();

    expect(seen).toBe("전기세");
    expect(data.mode).toBe("search");
    expect(data.query).toBe("전기세");
    expect(data.items).toEqual([{ videoId: "v1", title: "제목1", channelTitle: "채널1" }]);
  });

  it("검색어가 비면 400 과 한국어 안내를 준다 — 100유닛을 헛되이 쓰지 않는다", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await GET(makeRequest("localhost:3500", "mode=search&q=%20"));

    expect(res.status).toBe(400);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("하루 한도를 넘기면 한국어로 상한을 알려 준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(403, { error: { errors: [{ reason: "quotaExceeded" }] } })));

    const res = await GET(makeRequest("localhost:3500", "mode=search&q=%EC%A0%84%EA%B8%B0%EC%84%B8"));

    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("100번");
  });
});

describe("GET /api/materials — 잘못된 요청", () => {
  it("모르는 mode 는 400 과 한국어 안내를 준다", async () => {
    const res = await GET(makeRequest("localhost:3500", "mode=nope"));

    expect(res.status).toBe(400);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
  });

  it("유튜브 키가 없으면 400 과 무엇이 없는지 한국어로 알려 준다", async () => {
    delete process.env.YOUTUBE_API_KEY;

    const res = await GET(makeRequest("localhost:3500", "mode=trending"));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("유튜브");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/api/materials/route.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/app/api/materials/route.ts`:

```ts
/**
 * GET /api/materials — **빠른** 소재 찾기(급상승·키워드 검색).
 *
 * `/api/topics` 와 나눈 이유는 속도다. 여기는 **Claude 를 부르지 않아 1~2초**에 끝나고, 영상
 * 제목을 **날것 그대로** 돌려준다. 다듬는 일(100초)은 `/api/topics` 가 맡는다. 하나로 합치면
 * 빠른 길이 사라진다.
 *
 * 후보는 언제나 유튜브에서 온다 — 네이버는 후보를 만들 수 없다(검색어트렌드·쇼핑인사이트 모두
 * 키워드를 입력으로 요구한다).
 *
 * `/api/topics` 와 같은 이유로 이 PC 브라우저에서만 부를 수 있다(`@/lib/local-guard`).
 */
import { checkYoutubeConfig } from "@/lib/topics-config";
import { isLocalHost } from "@/lib/local-guard";
import { fetchYoutubeTrendingCandidates, friendlyYoutubeError, parseCategoryIds } from "@/lib/youtube-trending";
import { fetchYoutubeSearchMaterials, friendlyYoutubeSearchError, type MaterialItem } from "@/lib/youtube-search";

export async function GET(req: Request) {
  if (!isLocalHost(req.headers.get("host"))) {
    return Response.json({ error: "소재 찾기는 이 컴퓨터의 브라우저에서만 할 수 있어요." }, { status: 403 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  if (mode !== "trending" && mode !== "search") {
    return Response.json({ error: "어떤 방식으로 찾을지 알 수 없어요." }, { status: 400 });
  }

  const configCheck = checkYoutubeConfig(process.env);
  if (!configCheck.ready) {
    return Response.json({ error: `소재를 찾을 설정이 없어요: ${configCheck.missing.join(", ")}` }, { status: 400 });
  }
  const { youtubeApiKey } = configCheck.config;

  if (mode === "search") {
    const query = (url.searchParams.get("q") ?? "").trim();
    // 빈 검색어로 부르면 100유닛을 헛되이 쓴다 — 나가기 전에 막는다.
    if (!query) {
      return Response.json({ error: "무엇을 찾을지 알려 주세요." }, { status: 400 });
    }
    try {
      const items = await fetchYoutubeSearchMaterials(youtubeApiKey, query);
      return Response.json({ items, mode, query });
    } catch (e) {
      return Response.json({ error: friendlyYoutubeSearchError(e) }, { status: 502 });
    }
  }

  const categories = parseCategoryIds(url.searchParams.get("categories"));
  try {
    const result = await fetchYoutubeTrendingCandidates(youtubeApiKey, categories);
    const items: MaterialItem[] = result.candidates.map(({ videoId, title, channelTitle }) => ({
      videoId,
      title,
      channelTitle,
    }));
    const skipped = result.skippedCategories.map((c) => c.displayName);
    return Response.json({
      items,
      mode,
      youtubeCategories: result.usedCategories.map((c) => c.displayName),
      ...(skipped.length > 0 ? { skippedYoutubeCategories: skipped } : {}),
    });
  } catch (e) {
    return Response.json({ error: friendlyYoutubeError(e) }, { status: 502 });
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 전부 통과, tsc 출력 없음

- [ ] **Step 5: 실제로 불러 본다** (Claude 를 안 쓰므로 할당량 부담 없음)

dev 서버가 3500 포트에 떠 있어야 한다.

```bash
curl -s "http://localhost:3500/api/materials?mode=trending&categories=26" | head -c 400
curl -s "http://localhost:3500/api/materials?mode=search&q=에어컨%20전기세" | head -c 400
curl -s -o /dev/null -w "%{http_code}\n" "http://$(ipconfig getifaddr en0):3500/api/materials?mode=trending"
```

Expected: 앞의 둘은 `items` 가 담긴 200, 마지막은 **403**

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/materials/route.ts src/app/api/materials/route.test.ts
git commit -m "feat: 빠른 소재 찾기 라우트(급상승·키워드 검색)"
```

---

### Task 4: 네이버 쇼핑인사이트 순위

**Files:**
- Create: `src/lib/naver-shopping.ts`, `src/lib/naver-shopping.test.ts`

**Interfaces:**
- Consumes: `NaverDatalabConfig`·`RankedTopic`·`buildRecentPeriod`·`averageRatio`(`@/lib/naver-datalab`) 를 재사용한다
- Produces:
  - `SHOPPING_CATEGORIES: readonly { id: string; name: string }[]`
  - `SHOPPING_AGES_30S_40S: readonly string[]` = `["30", "40"]`
  - `MAX_SHOPPING_KEYWORDS_PER_REQUEST = 5`
  - `rankKeywordsByNaverShopping(keywords: string[], categoryId: string, auth: NaverDatalabConfig, fetchImpl?: typeof fetch, now?: Date): Promise<RankedTopic[]>`
  - `friendlyNaverShoppingError(e: unknown): string`

> **`ages` 를 데이터랩과 공유하지 마라.** 검색어트렌드는 `"1"`~`"11"`, 쇼핑인사이트는 `"10" "20" "30" "40" "50" "60"` 이다. `NAVER_AGES_30S_40S` 를 그대로 넘기면 **400** 이 난다(2026-08-03 실측).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/naver-shopping.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { NAVER_AGES_30S_40S } from "./naver-datalab";
import {
  MAX_SHOPPING_KEYWORDS_PER_REQUEST,
  SHOPPING_AGES_30S_40S,
  SHOPPING_CATEGORIES,
  friendlyNaverShoppingError,
  rankKeywordsByNaverShopping,
} from "./naver-shopping";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const auth = { clientId: "client-id", clientSecret: "client-secret" };

describe("실측으로 확정한 상수", () => {
  it("쇼핑 연령 코드는 10년 단위이며 데이터랩(5세 단위)과 다르다", () => {
    expect(SHOPPING_AGES_30S_40S).toEqual(["30", "40"]);
    expect(SHOPPING_AGES_30S_40S).not.toEqual(NAVER_AGES_30S_40S);
  });

  it("한 요청에 키워드 5개까지다", () => {
    expect(MAX_SHOPPING_KEYWORDS_PER_REQUEST).toBe(5);
  });

  it("분야 이름은 전부 한국어다 — 화면에 그대로 나간다", () => {
    expect(SHOPPING_CATEGORIES.length).toBeGreaterThan(0);
    for (const category of SHOPPING_CATEGORIES) {
      expect(category.name).not.toMatch(/[A-Za-z]/);
      expect(category.id).toMatch(/^5000000\d$/);
    }
  });

  it("30~40대 맘이 쓸 분야를 담고 있다", () => {
    const ids = SHOPPING_CATEGORIES.map((c) => c.id);
    expect(ids).toContain("50000005"); // 출산·육아
    expect(ids).toContain("50000006"); // 식품
    expect(ids).toContain("50000008"); // 생활·건강
  });
});

describe("rankKeywordsByNaverShopping", () => {
  it("API HUB 쇼핑 경로를 게이트웨이 헤더로 부르고 분야·성별·연령을 싣는다", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://naverapihub.apigw.ntruss.com/shopping/v1/category/keywords");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers["X-NCP-APIGW-API-KEY-ID"]).toBe("client-id");
      expect(headers["X-NCP-APIGW-API-KEY"]).toBe("client-secret");
      const body = JSON.parse(String(init?.body));
      expect(body.category).toBe("50000005");
      expect(body.gender).toBe("f");
      expect(body.ages).toEqual(["30", "40"]);
      return jsonResponse(200, {
        results: [{ title: "기저귀", keyword: ["기저귀"], data: [{ period: "2026-07-01", ratio: 40 }] }],
      });
    });

    await rankKeywordsByNaverShopping(["기저귀"], "50000005", auth, mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("5개 넘는 키워드는 나눠 부르고 점수 내림차순으로 합친다", async () => {
    const ratios: Record<string, number> = { k1: 10, k2: 90, k3: 20, k4: 30, k5: 40, k6: 50 };
    const mockFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return jsonResponse(200, {
        results: body.keyword.map((g: { name: string }) => ({
          title: g.name,
          keyword: [g.name],
          data: [{ period: "2026-07-01", ratio: ratios[g.name] }],
        })),
      });
    });

    const ranked = await rankKeywordsByNaverShopping(
      ["k1", "k2", "k3", "k4", "k5", "k6"],
      "50000005",
      auth,
      mockFetch as unknown as typeof fetch,
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(ranked.map((r) => r.keyword)).toEqual(["k2", "k6", "k5", "k4", "k3", "k1"]);
  });

  it("데이터가 없는 키워드는 점수 0으로 남는다 — 사라지지 않는다", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse(200, { results: [{ title: "감자전", keyword: ["감자전"], data: [] }] }),
    );

    const ranked = await rankKeywordsByNaverShopping(["감자전"], "50000006", auth, mockFetch as unknown as typeof fetch);

    expect(ranked).toEqual([{ keyword: "감자전", score: 0 }]);
  });
});

describe("friendlyNaverShoppingError — 언제나 한국어", () => {
  it("영문 원문이나 키 값을 노출하지 않는다", () => {
    const message = friendlyNaverShoppingError(new Error("NID AUTH Result Invalid (1000)"));

    expect(message).not.toContain("NID");
    expect(/[가-힣]/.test(message)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/naver-shopping.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/lib/naver-shopping.ts`:

```ts
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

/** 오류 원문(영문·키 값이 섞일 수 있다)을 절대 사용자에게 넘기지 않는다. */
export function friendlyNaverShoppingError(_e: unknown): string {
  return "네이버 쇼핑인사이트에 연결하지 못했어요. 클라이언트 ID·시크릿 설정을 확인해 주세요.";
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/naver-shopping.test.ts && npx tsc --noEmit`
Expected: 전부 통과, tsc 출력 없음

- [ ] **Step 5: 커밋**

```bash
git add src/lib/naver-shopping.ts src/lib/naver-shopping.test.ts
git commit -m "feat: 네이버 쇼핑인사이트로 순위 매기기"
```

---

### Task 5: `/api/topics` 에 순위 렌즈 선택 붙이기

**Files:**
- Modify: `src/app/api/topics/route.ts`
- Test: `src/app/api/topics/route.test.ts`

**Interfaces:**
- Consumes: `rankKeywordsByNaverShopping`·`isShoppingCategoryId`·`SHOPPING_CATEGORIES`(Task 4)
- Produces: `GET /api/topics?lens=search-trend|shopping|claude&shoppingCategory=50000005`
  - `lens` 없으면 `search-trend`(기존 동작)
  - `rankedBy` 에 값 추가: `"naver-shopping"`, `"claude-shopping-unavailable"`
  - `lens=shopping` 인데 `shoppingCategory` 가 없거나 모르는 값이면 **400 + 한국어**

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/api/topics/route.test.ts` 에 추가:

```ts
describe("GET /api/topics — 순위 렌즈 선택", () => {
  it("lens=claude 면 네이버 설정이 있어도 부르지 않는다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    process.env.NAVER_CLIENT_ID = "naver-id";
    process.env.NAVER_CLIENT_SECRET = "naver-secret";
    const mockFetch = stubYoutubeSuccess();
    vi.stubGlobal("fetch", mockFetch);
    vi.mocked(runClaudeCli).mockResolvedValueOnce({ topics: [{ keyword: "키워드", reason: "이유", rank: 1 }] });

    const data = await (await GET(makeRequest("localhost:3500", "lens=claude"))).json();

    expect(data.rankedBy).toBe("claude-lens-chosen");
    const naverCalls = mockFetch.mock.calls.filter((c) => String(c[0]).includes("ntruss.com"));
    expect(naverCalls).toHaveLength(0);
  });

  it("lens=shopping 이면 쇼핑 경로를 고른 분야로 부른다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    process.env.NAVER_CLIENT_ID = "naver-id";
    process.env.NAVER_CLIENT_SECRET = "naver-secret";
    let shoppingBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/shopping/v1/category/keywords")) {
          shoppingBody = JSON.parse(String(init?.body));
          return jsonResponse(200, {
            results: [{ title: "키워드", keyword: ["키워드"], data: [{ period: "2026-07-01", ratio: 50 }] }],
          });
        }
        return jsonResponse(200, {
          items: [{ id: "v1", snippet: { title: "제목", channelTitle: "채널", categoryId: "26" } }],
        });
      }),
    );
    vi.mocked(runClaudeCli).mockResolvedValueOnce({ topics: [{ keyword: "키워드", reason: "이유", rank: 1 }] });

    const data = await (
      await GET(makeRequest("localhost:3500", "lens=shopping&shoppingCategory=50000005"))
    ).json();

    expect(data.rankedBy).toBe("naver-shopping");
    expect(shoppingBody).not.toBeNull();
    expect(shoppingBody!.category).toBe("50000005");
    expect(data.note).toContain("쇼핑인사이트");
  });

  it("lens=shopping 인데 분야가 없으면 400 과 한국어 안내를 준다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";

    const res = await GET(makeRequest("localhost:3500", "lens=shopping"));

    expect(res.status).toBe(400);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
  });

  it("모르는 분야 id 도 400 이다 — 그대로 네이버에 넘기지 않는다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";

    const res = await GET(makeRequest("localhost:3500", "lens=shopping&shoppingCategory=99"));

    expect(res.status).toBe(400);
  });

  it("쇼핑인사이트가 실패해도 502 로 죽지 않고 Claude 순위로 폴백한다", async () => {
    process.env.YOUTUBE_API_KEY = "yt-key";
    process.env.NAVER_CLIENT_ID = "naver-id";
    process.env.NAVER_CLIENT_SECRET = "naver-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input).includes("/shopping/")) return jsonResponse(401, { errorCode: "024" });
        return jsonResponse(200, {
          items: [{ id: "v1", snippet: { title: "제목", channelTitle: "채널", categoryId: "26" } }],
        });
      }),
    );
    vi.mocked(runClaudeCli).mockResolvedValueOnce({ topics: [{ keyword: "키워드", reason: "이유", rank: 1 }] });

    const res = await GET(makeRequest("localhost:3500", "lens=shopping&shoppingCategory=50000005"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rankedBy).toBe("claude-shopping-unavailable");
    expect(data.topics).toHaveLength(1);
  });
});
```

**주의**: 기존 `makeRequest(host)` 헬퍼가 쿼리를 안 받으면 `makeRequest(host, query = "")` 로 넓혀라 — 기존 호출부는 그대로 동작해야 한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/api/topics/route.test.ts`
Expected: FAIL — `rankedBy` 가 새 값을 안 줌

- [ ] **Step 3: 구현**

`src/app/api/topics/route.ts`:

`RankedBy` 와 `NOTE_BY_BASIS` 를 넓힌다.

```ts
type RankedBy =
  | "naver-datalab"
  | "naver-shopping"
  | "claude-no-naver-config"
  | "claude-naver-unavailable"
  | "claude-shopping-unavailable"
  | "claude-lens-chosen";

const NOTE_BY_BASIS: Record<RankedBy, string> = {
  "naver-datalab":
    "네이버 데이터랩 검색어트렌드에서 30~40대 여성 기준 상대 검색 비중을 조회해 정렬했어요(절대 검색량이 아니라 후보끼리의 상대 비교예요).",
  "naver-shopping":
    "네이버 데이터랩 쇼핑인사이트에서 30~40대 여성 기준 상대 검색 클릭 비중을 조회해 정렬했어요(물건이 아닌 주제는 데이터가 없어 뒤로 밀릴 수 있어요).",
  "claude-no-naver-config":
    "네이버 데이터랩 검색어트렌드 설정이 없어 Claude가 판단한 관련성 순서로 정렬했어요(실제 검색 비중은 반영되지 않았어요).",
  "claude-naver-unavailable":
    "네이버 데이터랩 검색어트렌드에 연결하지 못해 Claude가 판단한 관련성 순서로 정렬했어요 — 클라이언트 ID·시크릿 설정을 확인해 주세요(실제 검색 비중은 반영되지 않았어요).",
  "claude-shopping-unavailable":
    "네이버 데이터랩 쇼핑인사이트에 연결하지 못해 Claude가 판단한 관련성 순서로 정렬했어요 — 클라이언트 ID·시크릿 설정을 확인해 주세요(실제 검색 비중은 반영되지 않았어요).",
  "claude-lens-chosen": "Claude가 판단한 관련성 순서로 정렬했어요(실제 검색 비중은 반영되지 않았어요).",
};
```

`GET` 안에서 렌즈를 읽는다. `checkTopicsConfig` 뒤, 유튜브 호출 **앞**에 둔다 — 잘못된 요청으로 100초를 쓰지 않게 한다.

```ts
  const url = new URL(req.url);
  const lens = url.searchParams.get("lens") ?? "search-trend";
  if (lens !== "search-trend" && lens !== "shopping" && lens !== "claude") {
    return Response.json({ error: "어떤 기준으로 순위를 매길지 알 수 없어요." }, { status: 400 });
  }
  // 분야가 틀린 채로 100초짜리 Claude 단계를 지나가면 헛수고가 된다 — 먼저 막는다.
  const shoppingCategory = url.searchParams.get("shoppingCategory") ?? "";
  if (lens === "shopping" && !isShoppingCategoryId(shoppingCategory)) {
    return Response.json({ error: "쇼핑인사이트로 순위를 매기려면 분야를 골라 주세요." }, { status: 400 });
  }
```

Claude 추리기 뒤의 분기를 교체한다(기존 `if (!config.naver) … try { datalab } catch { fallback }` 자리):

```ts
  if (lens === "claude") {
    return respond(topResultsByRank(curated), "claude-lens-chosen", youtubeCategories, skippedYoutubeCategories);
  }

  if (!config.naver) {
    return respond(topResultsByRank(curated), "claude-no-naver-config", youtubeCategories, skippedYoutubeCategories);
  }

  const keywords = curated.map((t) => t.keyword);
  const reasonByKeyword = new Map(curated.map((t) => [t.keyword, t.reason]));

  try {
    const ranked =
      lens === "shopping"
        ? await rankKeywordsByNaverShopping(keywords, shoppingCategory, config.naver)
        : await rankKeywordsByNaverDatalab(keywords, config.naver);
    const topics = ranked
      .slice(0, TOP_N)
      .map((r) => ({ keyword: r.keyword, reason: reasonByKeyword.get(r.keyword) ?? "" }));
    return respond(
      topics,
      lens === "shopping" ? "naver-shopping" : "naver-datalab",
      youtubeCategories,
      skippedYoutubeCategories,
    );
  } catch {
    // 순위는 선택 기능이다 — 실패해도 Claude 가 만들어 둔 결과를 버리지 않는다.
    return respond(
      topResultsByRank(curated),
      lens === "shopping" ? "claude-shopping-unavailable" : "claude-naver-unavailable",
      youtubeCategories,
      skippedYoutubeCategories,
    );
  }
```

import 를 추가한다:

```ts
import { isShoppingCategoryId, rankKeywordsByNaverShopping } from "@/lib/naver-shopping";
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 전부 통과, tsc 출력 없음. **`/api/topics` 를 실제로 부르지 마라.**

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/topics/route.ts src/app/api/topics/route.test.ts
git commit -m "feat: 주제 순위 렌즈를 고를 수 있게"
```

---

### Task 6: 소재 찾기 판정 모듈 (순수 함수)

**Files:**
- Create: `src/features/cardnews/screens/material-finder.ts`, `src/features/cardnews/screens/material-finder.test.ts`

**Interfaces:**
- Consumes: `inKorean`(`./errors`), `toTopicsView`·`TopicsView`(`./topic-suggest`) — 소재 추천 모드는 기존 판정을 그대로 쓴다
- Produces:
  - `FINDER_MODES: readonly { id: FinderMode; label: string; hint: string }[]`, `FinderMode = "trending" | "search" | "curated"`
  - `RANK_LENSES: readonly { id: RankLens; label: string; hint: string }[]`, `RankLens = "search-trend" | "shopping" | "claude"`
  - `MaterialsView = { kind: "items"; items: MaterialItem[]; categories: string[]; skipped: string[] } | { kind: "empty"; categories: string[]; skipped: string[] } | { kind: "error"; message: string }`
  - `toMaterialsView(status: number, body: unknown): MaterialsView`
  - `buildMaterialsQuery(mode: FinderMode, opts: { categoryIds: string[]; query: string }): string`
  - `buildTopicsQuery(lens: RankLens, shoppingCategoryId: string): string`
  - `lensAvailability(lens: RankLens, naverConfigured: boolean): { enabled: boolean; reason: string | null }`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/cardnews/screens/material-finder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  FINDER_MODES,
  RANK_LENSES,
  buildMaterialsQuery,
  buildTopicsQuery,
  lensAvailability,
  toMaterialsView,
} from "./material-finder";

describe("모드와 렌즈 목록", () => {
  it("세 모드가 있고 이름·설명이 전부 한국어다", () => {
    expect(FINDER_MODES.map((m) => m.id)).toEqual(["trending", "search", "curated"]);
    for (const mode of FINDER_MODES) {
      expect(mode.label).not.toMatch(/[A-Za-z]/);
      expect(/[가-힣]/.test(mode.hint)).toBe(true);
    }
  });

  it("키워드 검색 설명은 하루 100번 상한을 밝힌다", () => {
    expect(FINDER_MODES.find((m) => m.id === "search")!.hint).toContain("100번");
  });

  it("소재 추천 설명은 오래 걸린다는 것을 미리 말한다", () => {
    expect(FINDER_MODES.find((m) => m.id === "curated")!.hint).toContain("1분 40초");
  });

  it("쇼핑인사이트 렌즈는 물건에만 맞는다는 한계를 밝힌다", () => {
    expect(RANK_LENSES.find((l) => l.id === "shopping")!.hint).toContain("물건");
  });
});

describe("lensAvailability — 네이버 키가 없으면 고를 수 없다", () => {
  it("네이버가 없으면 검색어트렌드·쇼핑인사이트는 막고 이유를 준다", () => {
    for (const lens of ["search-trend", "shopping"] as const) {
      const state = lensAvailability(lens, false);
      expect(state.enabled).toBe(false);
      expect(/[가-힣]/.test(state.reason ?? "")).toBe(true);
    }
  });

  it("Claude 판단은 네이버 없이도 언제나 고를 수 있다", () => {
    expect(lensAvailability("claude", false)).toEqual({ enabled: true, reason: null });
  });

  it("네이버가 있으면 셋 다 열린다", () => {
    for (const lens of ["search-trend", "shopping", "claude"] as const) {
      expect(lensAvailability(lens, true).enabled).toBe(true);
    }
  });
});

describe("쿼리 만들기", () => {
  it("급상승은 고른 카테고리를 쉼표로 잇는다", () => {
    expect(buildMaterialsQuery("trending", { categoryIds: ["26", "28"], query: "" })).toBe(
      "mode=trending&categories=26%2C28",
    );
  });

  it("키워드 검색은 검색어를 인코딩해 싣는다", () => {
    expect(buildMaterialsQuery("search", { categoryIds: [], query: "에어컨 전기세" })).toBe(
      "mode=search&q=%EC%97%90%EC%96%B4%EC%BB%A8+%EC%A0%84%EA%B8%B0%EC%84%B8",
    );
  });

  it("소재 추천은 렌즈를 싣고, 쇼핑일 때만 분야를 함께 싣는다", () => {
    expect(buildTopicsQuery("search-trend", "")).toBe("lens=search-trend");
    expect(buildTopicsQuery("claude", "50000005")).toBe("lens=claude");
    expect(buildTopicsQuery("shopping", "50000005")).toBe("lens=shopping&shoppingCategory=50000005");
  });
});

describe("toMaterialsView", () => {
  const body = {
    items: [{ videoId: "v1", title: "제목1", channelTitle: "채널1" }],
    mode: "trending",
    youtubeCategories: ["살림·요리·꿀팁"],
  };

  it("결과가 있으면 목록과 출처를 들고 온다", () => {
    const view = toMaterialsView(200, body);

    expect(view.kind).toBe("items");
    if (view.kind !== "items") return;
    expect(view.items).toHaveLength(1);
    expect(view.categories).toEqual(["살림·요리·꿀팁"]);
    expect(view.skipped).toEqual([]);
  });

  it("결과가 0개면 '없음' 상태다 — 빈 목록을 그냥 두지 않는다", () => {
    const view = toMaterialsView(200, { ...body, items: [] });

    expect(view.kind).toBe("empty");
  });

  it("건너뛴 카테고리를 감추지 않는다", () => {
    const view = toMaterialsView(200, { ...body, skippedYoutubeCategories: ["일상·브이로그"] });

    expect(view.kind === "items" && view.skipped).toEqual(["일상·브이로그"]);
  });

  it("오류는 한국어로 바꿔 준다", () => {
    expect(toMaterialsView(502, { error: "Internal Server Error" })).toEqual({
      kind: "error",
      message: expect.stringMatching(/[가-힣]/),
    });
  });

  it("200 인데 형태가 어긋나면 raw 를 보이지 않고 오류로 접는다", () => {
    for (const bad of [null, {}, { items: "nope" }, "<html>"]) {
      const view = toMaterialsView(200, bad);
      expect(view.kind).toBe("error");
      expect(view.kind === "error" && /[가-힣]/.test(view.message)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/cardnews/screens/material-finder.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/features/cardnews/screens/material-finder.ts`:

```ts
import { inKorean } from "./errors";

/**
 * 소재 찾기 화면의 **판정 모듈** — 모드·렌즈 목록과 응답 해석을 모두 여기 둔다.
 *
 * 이 저장소 vitest 는 `environment: "node"` 라 렌더 테스트를 붙일 수 없다. 그래서 판단은 전부
 * 순수 함수로 빼고 컴포넌트에는 JSX 와 배선만 남긴다.
 *
 * **후보는 언제나 유튜브에서 온다.** 네이버(검색어트렌드·쇼핑인사이트)는 후보를 만들 수 없고
 * 줄 세우기만 한다 — 모드와 렌즈를 섞지 않는 이유다.
 */

export type FinderMode = "trending" | "search" | "curated";
export type RankLens = "search-trend" | "shopping" | "claude";

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

export function lensAvailability(lens: RankLens, naverConfigured: boolean): { enabled: boolean; reason: string | null } {
  if (lens === "claude" || naverConfigured) return { enabled: true, reason: null };
  return { enabled: false, reason: "네이버 클라이언트 ID·시크릿을 넣으면 쓸 수 있어요." };
}

export function buildMaterialsQuery(
  mode: FinderMode,
  opts: { categoryIds: string[]; query: string },
): string {
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
  | { kind: "items"; items: MaterialItem[]; categories: string[]; skipped: string[] }
  | { kind: "empty"; categories: string[]; skipped: string[] }
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

export function toMaterialsView(status: number, body: unknown): MaterialsView {
  const record = asRecord(body);
  if (status !== 200) {
    return { kind: "error", message: inKorean(asString(record?.error) ?? "", FALLBACK_ERROR) };
  }
  const items = record && toItems(record.items);
  if (!record || !items) return { kind: "error", message: FALLBACK_ERROR };

  const categories = toStringList(record.youtubeCategories);
  const skipped = toStringList(record.skippedYoutubeCategories);
  if (items.length === 0) return { kind: "empty", categories, skipped };
  return { kind: "items", items, categories, skipped };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/cardnews/screens/material-finder.test.ts && npx tsc --noEmit`
Expected: 전부 통과, tsc 출력 없음

- [ ] **Step 5: 커밋**

```bash
git add src/features/cardnews/screens/material-finder.ts src/features/cardnews/screens/material-finder.test.ts
git commit -m "feat: 소재 찾기 판정 모듈"
```

---

### Task 7: 소재 찾기 화면

**Files:**
- Create: `src/features/cardnews/screens/MaterialFinderScreen.tsx`
- Modify: `src/features/cardnews/screens/TopicSuggestPanel.tsx` (렌즈 선택을 받도록 props 확장)

**Interfaces:**
- Consumes: Task 6 전부, `TopicSuggestPanel`(소재 추천 모드 본체), `StudioFrame`·`SectionHead`·`SolidButton`·`LineButton`(`@/features/shell/StudioFrame`), `FOCUS_RING`(`@/components/ui`), `LIFESTYLE_CATEGORIES`(`@/lib/youtube-trending`), `SHOPPING_CATEGORIES`(`@/lib/naver-shopping`)
- Produces: `MaterialFinderScreen({ keyword, naverConfigured, onPick, onClose })`
  - `onPick(keyword: string)` — 소재를 고르면 주제 칸에 넣고 화면을 닫는다
  - `onClose()` — 그만두고 주제 화면으로

**화면 규칙** (Global Constraints 외 추가):
- `<StudioFrame step={0} title="소재 찾기">` — **스텝은 0(주제) 그대로**. 소재 찾기는 선택적 도구라 스텝을 늘리지 않는다
- 모드는 탭(`role="tablist"`)으로. 모드를 바꿔도 **이미 가져온 결과를 지우지 않는다**
- 급상승 카테고리는 **다중 선택**(체크박스). 전부 끄면 다음 호출에서 전체로 되돌아간다(`parseCategoryIds` 가 처리)
- 렌즈는 **소재 추천 모드에서만** 보인다. 급상승·키워드 검색에는 "유튜브 순위 그대로"라고 적는다
- `lensAvailability` 가 막은 렌즈는 `disabled` + 이유 표시. 숨기지 마라
- 쇼핑인사이트를 고르면 분야 선택이 나타난다. 안 고르면 실행 버튼을 잠근다
- 로딩 중 중복 실행 금지, `AbortController` 로 취소, 화면 이탈 시 abort
- 결과 목록의 각 항목은 버튼. 누르면 `onPick(title)`
- 결과 0개 → "직접 입력하세요"로 되돌리는 안내 + 닫기 버튼

- [ ] **Step 1: 화면 작성**

이 태스크는 JSX 라 순수 함수 테스트가 없다(판단은 Task 6 에서 이미 잠갔다). 대신 **폭 스위프와 디자인 게이트로 검증**한다.

`MaterialFinderScreen.tsx` 는 다음 구조를 갖는다:

```
StudioFrame(step=0, title="소재 찾기")
 ├ 헤더: "어떤 소재로 만들까요?" + [그만두기]
 ├ 탭: 급상승 / 키워드로 찾기 / 소재 추천   (선택된 탭 설명 한 줄)
 ├ 조건 영역 (탭에 따라)
 │   ├ 급상승     → 카테고리 체크박스 3개
 │   ├ 키워드     → 입력 칸 + "하루 100번까지" 안내
 │   └ 소재 추천  → 렌즈 라디오 3개 (+ 쇼핑이면 분야 선택)
 ├ 실행 버튼 (+ 도는 중이면 경과 시간·그만두기)
 ├ 출처 두 줄 (후보 / 순위)
 └ 결과 목록 (버튼 목록) 또는 없음 안내
```

**소재 추천 모드는 `TopicSuggestPanel` 을 그대로 재사용한다** — 로딩·경과 시간·출처·오류 처리가 이미 검증돼 있다. 렌즈를 고를 수 있도록 props 를 넓힌다:

```tsx
export function TopicSuggestPanel({
  keyword,
  query,
  onSelect,
}: {
  keyword: string;
  /** `buildTopicsQuery` 가 만든 쿼리 문자열. 렌즈·분야가 담긴다. */
  query: string;
  onSelect: (keyword: string) => void;
}) {
```

내부 `fetch("/api/topics")` 를 `fetch(\`/api/topics?${query}\`)` 로 바꾼다. 그 밖의 동작은 건드리지 마라.

- [ ] **Step 2: 타입·테스트 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc 출력 없음, 전부 통과

- [ ] **Step 3: 폭 스위프와 디자인 게이트**

Run: `npm run design:audit`
Expected: 전부 통과(가로 오버플로 0)

- [ ] **Step 4: 실제로 눌러 본다** (급상승·키워드 검색만 — Claude 안 씀)

```bash
curl -s "http://localhost:3500/api/materials?mode=trending&categories=26" | head -c 200
curl -s -o /dev/null -w "/cardnews: %{http_code}\n" http://localhost:3500/cardnews
```

- [ ] **Step 5: 커밋**

```bash
git add src/features/cardnews/screens/MaterialFinderScreen.tsx src/features/cardnews/screens/TopicSuggestPanel.tsx
git commit -m "feat: 소재 찾기 화면"
```

---

### Task 8: 주제 화면 연결과 마무리

**Files:**
- Modify: `src/features/cardnews/screens/TopicScreen.tsx`, `src/features/cardnews/CardnewsFlow.tsx`
- Create: `src/app/api/topics-config/route.ts` — 네이버 설정 여부만 알려 준다

**Interfaces:**
- Consumes: `MaterialFinderScreen`(Task 7), `checkNaverDatalabConfig`(`@/lib/topics-config`), `isLocalHost`
- Produces:
  - `GET /api/topics-config` → `{ naverConfigured: boolean }` — **키 값은 절대 담지 않는다**
  - `TopicScreen` 에 `onOpenFinder: () => void` prop
  - `CardnewsFlow` 가 `finderOpen` 로컬 상태로 화면을 바꾼다

- [ ] **Step 1: 설정 조회 라우트 테스트 작성**

`src/app/api/topics-config/route.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { GET } from "./route";

const OLD_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...OLD_ENV };
});

function makeRequest(host: string) {
  return new Request(`http://${host}/api/topics-config`, { headers: { host } });
}

describe("GET /api/topics-config", () => {
  it("네이버 키가 있으면 true 를 주되 값 자체는 절대 담지 않는다", async () => {
    process.env.NAVER_CLIENT_ID = "super-secret-id";
    process.env.NAVER_CLIENT_SECRET = "super-secret-value";

    const res = await GET(makeRequest("localhost:3500"));
    const text = await res.text();

    expect(JSON.parse(text)).toEqual({ naverConfigured: true });
    expect(text).not.toContain("super-secret");
  });

  it("네이버 키가 없으면 false 다", async () => {
    delete process.env.NAVER_CLIENT_ID;
    delete process.env.NAVER_CLIENT_SECRET;

    expect(await (await GET(makeRequest("localhost:3500"))).json()).toEqual({ naverConfigured: false });
  });

  it("다른 기기에서는 403 이다", async () => {
    const res = await GET(makeRequest("192.168.0.5:3500"));

    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/api/topics-config/route.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 라우트 구현**

`src/app/api/topics-config/route.ts`:

```ts
/**
 * GET /api/topics-config — 화면이 "네이버 렌즈를 고를 수 있는지"를 알기 위한 최소 조회.
 *
 * **불리언 하나만 돌려준다.** 키 값이나 그 일부를 응답에 담으면 안 된다 — 이 응답은 브라우저로
 * 나가고 개발자 도구에 그대로 남는다.
 */
import { checkNaverDatalabConfig } from "@/lib/topics-config";
import { isLocalHost } from "@/lib/local-guard";

export async function GET(req: Request) {
  if (!isLocalHost(req.headers.get("host"))) {
    return Response.json({ error: "이 컴퓨터의 브라우저에서만 확인할 수 있어요." }, { status: 403 });
  }
  return Response.json({ naverConfigured: checkNaverDatalabConfig(process.env).configured });
}
```

- [ ] **Step 4: 주제 화면과 흐름 배선**

`TopicScreen.tsx`: `TopicSuggestPanel` 을 걷어내고 그 자리에 여는 버튼을 둔다.

```tsx
<div className="flex flex-wrap items-center gap-4">
  <LineButton onClick={onOpenFinder}>
    <Sparkles size={16} aria-hidden="true" />
    소재 찾기
  </LineButton>
  <p className="text-[14px] text-ink-2">
    뭘 만들지 안 정해졌으면 요즘 뜨는 것 중에서 골라 올 수 있어요.
  </p>
</div>
```

`CardnewsFlow.tsx`: 로컬 상태로 화면을 바꾼다. **`state.step` 은 건드리지 않는다** — 소재 찾기는 스텝이 아니다.

```tsx
const [finderOpen, setFinderOpen] = useState(false);

// step 0 자리:
{state.step === 0 &&
  (finderOpen ? (
    <MaterialFinderScreen
      keyword={state.keyword}
      onPick={(keyword) => {
        dispatch({ type: "SET_KEYWORD", keyword });
        setFinderOpen(false);
      }}
      onClose={() => setFinderOpen(false)}
    />
  ) : (
    <TopicScreen
      state={state}
      dispatch={dispatch}
      onNext={() => go(1)}
      onOpenFinder={() => setFinderOpen(true)}
    />
  ))}
```

`naverConfigured` 는 `MaterialFinderScreen` 이 마운트될 때 `/api/topics-config` 를 한 번 불러 스스로 채운다(실패하면 `false` 로 두고 렌즈를 막되 이유를 적는다).

- [ ] **Step 5: 전체 검증**

```bash
npx tsc --noEmit
npx vitest run
npm run design:audit
for U in / /cardnews /info; do curl -s -o /dev/null -w "$U: %{http_code}\n" "http://localhost:3500$U"; done
curl -s -o /dev/null -w "LAN: %{http_code}\n" "http://$(ipconfig getifaddr en0):3500/api/materials?mode=trending"
```

Expected: tsc 출력 없음 · 전부 통과 · 게이트 통과 · 페이지 200 · **LAN 403**

- [ ] **Step 6: 소재 추천 모드 실호출 — 이번 계획에서 딱 한 번**

Claude 할당량을 쓴다(약 100초). 렌즈를 바꿔 두 번 부르지 말고 **한 번만** 부른 뒤 결과를 기록한다.

```bash
curl -s --max-time 300 "http://localhost:3500/api/topics?lens=search-trend" | head -c 400
```

Expected: `rankedBy: "naver-datalab"`, `topics` 에 주제, `youtubeCategories` 에 한국어 카테고리

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/topics-config/route.ts src/app/api/topics-config/route.test.ts \
        src/features/cardnews/screens/TopicScreen.tsx src/features/cardnews/CardnewsFlow.tsx
git commit -m "feat: 주제 화면에서 소재 찾기 열기"
```

---

## 사람이 확인해야 하는 것

브라우저가 로컬 dev 서버에 닿지 않아 자동 검증이 불가능한 부분이다.

- `/cardnews` → **소재 찾기** → 세 탭이 전환되고, 탭을 바꿔도 이미 가져온 결과가 남는가
- **급상승**에서 카테고리를 하나만 켜면 그 카테고리 것만 나오는가
- **키워드로 찾기**에 검색어를 넣으면 1~2초 안에 목록이 나오는가
- **소재 추천**에서 쇼핑인사이트를 고르면 분야 선택이 나타나고, 분야를 안 고르면 실행 버튼이 잠기는가
- 네이버 키가 없을 때 검색어트렌드·쇼핑인사이트가 **막힌 채 이유가 보이는가**
- 소재를 고르면 주제 화면으로 돌아오며 주제 칸이 채워지는가
- 키보드만으로 탭 전환·체크박스·목록 선택이 되는가

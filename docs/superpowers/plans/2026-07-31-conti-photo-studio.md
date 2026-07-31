# 콘티 — 사진 기반 카드뉴스 스튜디오 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 직접 보정한 사진 폴더를 받아 드래그로 순서를 정하고, Claude가 사진을 보고 쓴 카피를 얹어 인스타 카드 PNG로 뽑는 스튜디오를 카드뉴스·정보전달 두 개의 별도 화면으로 만든다.

**Architecture:** 순수 로직(`src/lib/**`)은 DOM 없이 vitest로 TDD하고, JSX는 브라우저로 검증한다. 카드뉴스(`/cardnews`, 5스텝)와 정보전달(`/info`, 4스텝)은 각자의 reducer와 스텝을 갖되 앱 셸·사진 처리·UI 원자·카드 템플릿·API를 공유한다. AI 출력 zod 스키마는 건드리지 않고, 사진 배정·레이아웃·초점은 클라이언트 상태로 분리한다.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 · TypeScript · vitest(node env) · @anthropic-ai/sdk · zod v4 · html-to-image · @dnd-kit · lucide-react

**Spec:** [docs/superpowers/specs/2026-07-31-conti-photo-studio-design.md](../specs/2026-07-31-conti-photo-studio-design.md)

## Global Constraints

- **테스트 환경 제약**: `vitest.config.ts`는 `environment: "node"`, `include: ["src/**/*.test.ts"]`. 테스트 파일은 반드시 `.ts`(`.tsx` 아님)이고 DOM API를 쓸 수 없다. DOM·canvas·FileReader를 만지는 코드는 별도 파일로 분리하고 브라우저로 검증한다.
- **TDD**: 순수 로직은 RED(실패 확인) → GREEN → REFACTOR. RED를 건너뛴 테스트는 무효다.
- **디자인 토큰**: 컴포넌트에 하드코딩 색상(`#xxx`, `rgb()`, `oklch()`) 금지. `src/lib/design-tokens.ts` 또는 Tailwind 클래스만 쓴다. Tailwind arbitrary value(`bg-[#xxx]`)는 **인접 라인에 일회성 사유 주석이 있을 때만** 허용하고, 같은 값이 3회 이상 나오면 토큰으로 올린다.
- **인라인 스타일**: `src/templates/**` 에서만 허용(PNG export용). 그 외 전부 Tailwind. **예외 하나** — 테마 색(`themes.ts`의 `bg`/`fg`)을 미리보기로 칠하는 자리는 값이 런타임 데이터라 Tailwind 클래스로 표현할 수 없으므로 `style` 을 쓴다. 토큰 하드코딩이 아니라 `themes.ts` 값을 그대로 비추는 것이고, 해당 자리에 사유 주석을 단다.
- **원시 `<img>`**: `src/templates/**` 와 사진 프리뷰에서만 허용. 해당 라인 위에 **한국어 사유 주석** 한 줄. eslint가 이 프로젝트에 설치돼 있지 않으므로 `eslint-disable` 주석은 절대 달지 않는다.
- **액센트**: 플럼 `#7A2E6B` 단 1색. 링·활성·진행률에만.
- **폰트 웨이트**: 400 / 600 / 800 정확히 3종.
- **숫자**: 카드 번호·해상도·용량·글자수는 `tabular-nums`.
- **아이콘**: lucide-react. UI 크롬에 이모지 0개.
- **접근성**: `focus-visible` 링 필수(`outline-none` 단독 금지). 키보드로 전 경로 도달. `motion-reduce` 게이팅.
- **UI 카피**: 한국어. 해요체.
- **파일 크기**: 400줄 이하.
- **금지**: `any`, `@ts-ignore`, `eslint-disable`, `console.log` 잔존, `useEffect` 내 fetch.
- **커밋**: Conventional Commits, 한국어 본문. 각 태스크 끝에 커밋.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/lib/design-tokens.ts` | 색·간격·반경 토큰 단일 출처 |
| `src/lib/photos.ts` | 사진 **순수 계산** — dataURL 파싱, 비율 판정, 다운스케일 치수, 파일명 정렬. `Photo` 타입 |
| `src/lib/photos-client.ts` | 사진 **DOM 처리** — File → Photo (FileReader·Image·canvas) |
| `src/lib/reorder.ts` | 배열 재배치 `move` (사진·항목 공용) |
| `src/lib/layout-assign.ts` | `CardLayout` 타입 + 카드뉴스 기본 레이아웃 배정 |
| `src/lib/prompt.ts` | 시스템 프롬프트 + vision 유저 콘텐츠 블록 빌더 |
| `src/lib/ledger.ts` | 원장 append + 최근 N건 읽기 |
| `src/templates/layout-utils.ts` | `objectPosition` · `scrimGradient` 순수 문자열 빌더 |
| `src/templates/themes.ts` | 테마 3종 (watermark 제거, `onPhoto` 추가) |
| `src/templates/CardFrame.tsx` | 1080×1350 캔버스 + 워터마크. 패딩 없음 |
| `src/templates/bodies/*.tsx` | 카피 본문 렌더 (인포그래픽 / 카드뉴스) |
| `src/templates/layouts/*.tsx` | full-bleed · split · text-only 3종 |
| `src/templates/CardRenderer.tsx` | `RenderCard` → 레이아웃 분기 |
| `src/components/ui/*.tsx` | Button · Field · SegmentedControl · Badge · Panel · ContiMark |
| `src/features/shell/*.tsx` | 앱 셸 (사이드바 스텝 레일 + 탑바 + 푸터 내비) |
| `src/features/photos/*.tsx` | Dropzone · PhotoGrid (양쪽 플로우 공용) |
| `src/features/cardnews/reducer.ts` | 카드뉴스 상태 — 정원 5~6, 슬롯/트레이 |
| `src/features/cardnews/**` | 카드뉴스 5스텝 + 3-페인 편집기 |
| `src/features/infosend/reducer.ts` | 정보전달 상태 — 대표 1장, items 3~6 |
| `src/features/infosend/**` | 정보전달 4스텝 + 2-페인 편집기 |
| `src/app/page.tsx` | 허브 (서버 컴포넌트, ledger 최근 5건) |
| `src/app/cardnews/page.tsx` · `src/app/info/page.tsx` | 각 플로우 마운트 |

**삭제**: `src/app/studio.tsx` · `src/templates/InfographicCard.tsx` · `src/templates/CardnewsSlide.tsx` (본문은 `bodies/`로 이동)

---

## Task 1: 디자인 토큰 · 아이덴티티 기반

**Files:**
- Create: `src/lib/design-tokens.ts`
- Create: `src/components/ui/ContiMark.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx:4-7` (metadata)

**Interfaces:**
- Consumes: 없음
- Produces: `colors` · `radii` 토큰 객체. `<ContiMark size={n} />` 컴포넌트. Tailwind 유틸 `bg-plum` `text-plum` `border-hair` `bg-canvas` `text-ink` `text-ink-2` `text-ink-3`

- [ ] **Step 1: 토큰 파일 작성**

`src/lib/design-tokens.ts`:

```ts
export const colors = {
  canvas: "#FBFAFB",
  surface: "#FFFFFF",
  hair: "#E7E4E8",
  hairSoft: "#F1EFF2",
  ink: "#16151A",
  ink2: "#57545C",
  ink3: "#8B8791",
  plum: "#7A2E6B",
  plumSoft: "#F6EAF3",
  danger: "#B4231F",
} as const;

export const radii = {
  control: "0.5rem",
  panel: "0.75rem",
} as const;
```

- [ ] **Step 2: globals.css에 토큰 노출**

`src/app/globals.css` 전체를 아래로 교체:

```css
@import "tailwindcss";

@theme inline {
  --color-canvas: #FBFAFB;
  --color-surface: #FFFFFF;
  --color-hair: #E7E4E8;
  --color-hair-soft: #F1EFF2;
  --color-ink: #16151A;
  --color-ink-2: #57545C;
  --color-ink-3: #8B8791;
  --color-plum: #7A2E6B;
  --color-plum-soft: #F6EAF3;
  --color-danger: #B4231F;

  --color-background: #FFFFFF;
  --color-foreground: #16151A;
  --font-sans: "Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif;
  --font-display: "Gaegu", "Pretendard Variable", cursive;
}

html { -webkit-text-size-adjust: 100%; }

body {
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-sans);
  word-break: keep-all;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: 콘티 마크 컴포넌트**

`src/components/ui/ContiMark.tsx`:

```tsx
export function ContiMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4.5" y="4.5" width="23" height="23" rx="3" stroke="currentColor" strokeWidth="2.2" opacity=".45" />
      <rect x="8" y="8" width="16" height="9.5" rx="1.5" fill="currentColor" />
      <rect x="8" y="20.3" width="16" height="2.4" rx="1.2" fill="currentColor" opacity=".55" />
    </svg>
  );
}
```

- [ ] **Step 4: 메타데이터 교체**

`src/app/layout.tsx`의 `metadata`를 교체:

```tsx
export const metadata: Metadata = {
  title: "콘티 — 카드 스튜디오",
  description: "직접 작업한 사진으로 인스타 카드뉴스·정보전달 이미지를 만듭니다.",
};
```

- [ ] **Step 5: 빌드 검증**

Run: `npm run build`
Expected: 성공. (스타일·설정 변경이라 TDD 예외 — `rules/tdd.md`. 검증은 빌드로 한다.)

- [ ] **Step 6: 커밋**

```bash
git add src/lib/design-tokens.ts src/components/ui/ContiMark.tsx src/app/globals.css src/app/layout.tsx
git commit -m "feat: 콘티 디자인 토큰과 브랜드 마크 추가"
```

---

## Task 2: `lib/photos.ts` — 사진 순수 계산

**Files:**
- Create: `src/lib/photos.ts`
- Test: `src/lib/photos.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type Photo = { id: string; name: string; dataUrl: string; thumbUrl: string; width: number; height: number; bytes: number }`
  - `parseDataUrl(dataUrl: string): { mediaType: string; base64: string }`
  - `isFourFive(width: number, height: number): boolean`
  - `downscaleSize(width: number, height: number, max: number): { width: number; height: number }`
  - `compareFileNames(a: string, b: string): number`
  - `THUMB_MAX = 1024`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/photos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseDataUrl, isFourFive, downscaleSize, compareFileNames, THUMB_MAX } from "@/lib/photos";

describe("parseDataUrl", () => {
  it("media type과 base64 본문을 분리한다", () => {
    expect(parseDataUrl("data:image/jpeg;base64,AAAB")).toEqual({ mediaType: "image/jpeg", base64: "AAAB" });
  });
  it("png도 분리한다", () => {
    expect(parseDataUrl("data:image/png;base64,QUJD")).toEqual({ mediaType: "image/png", base64: "QUJD" });
  });
  it("dataURL 형식이 아니면 던진다", () => {
    expect(() => parseDataUrl("https://example.com/a.jpg")).toThrow();
  });
});

describe("isFourFive", () => {
  it("1080x1350은 4:5다", () => {
    expect(isFourFive(1080, 1350)).toBe(true);
  });
  it("2160x2700도 4:5다", () => {
    expect(isFourFive(2160, 2700)).toBe(true);
  });
  it("정사각형은 4:5가 아니다", () => {
    expect(isFourFive(1000, 1000)).toBe(false);
  });
  it("가로 사진은 4:5가 아니다", () => {
    expect(isFourFive(1600, 900)).toBe(false);
  });
  it("허용 오차 안이면 4:5로 본다", () => {
    expect(isFourFive(1080, 1340)).toBe(true);
  });
});

describe("downscaleSize", () => {
  it("최장변이 max 이하면 그대로 둔다", () => {
    expect(downscaleSize(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });
  it("세로가 길면 세로를 max에 맞춘다", () => {
    expect(downscaleSize(1080, 1350, 1024)).toEqual({ width: 819, height: 1024 });
  });
  it("가로가 길면 가로를 max에 맞춘다", () => {
    expect(downscaleSize(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
  });
  it("THUMB_MAX는 1024다", () => {
    expect(THUMB_MAX).toBe(1024);
  });
});

describe("compareFileNames", () => {
  it("숫자를 사전순이 아니라 수의 크기로 비교한다", () => {
    const sorted = ["10.jpg", "2.jpg", "1.jpg"].sort(compareFileNames);
    expect(sorted).toEqual(["1.jpg", "2.jpg", "10.jpg"]);
  });
  it("접두사가 있어도 숫자 순으로 정렬한다", () => {
    const sorted = ["img-12.png", "img-3.png"].sort(compareFileNames);
    expect(sorted).toEqual(["img-3.png", "img-12.png"]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/photos.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/photos"`

- [ ] **Step 3: 최소 구현**

`src/lib/photos.ts`:

```ts
export const THUMB_MAX = 1024;

/** 4:5 판정 허용 오차 — 보정 과정에서 1~2px 어긋난 사진을 경고하지 않기 위한 폭 */
const RATIO_TOLERANCE = 0.02;

export type Photo = {
  id: string;
  name: string;
  /** 원본 dataURL — PNG 캡처용 */
  dataUrl: string;
  /** 최장변 THUMB_MAX로 줄인 dataURL — Claude 전송용 */
  thumbUrl: string;
  width: number;
  height: number;
  bytes: number;
};

export function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("base64 dataURL이 아닙니다");
  return { mediaType: m[1], base64: m[2] };
}

export function isFourFive(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return Math.abs(width / height - 0.8) <= RATIO_TOLERANCE;
}

export function downscaleSize(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const collator = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

export function compareFileNames(a: string, b: string): number {
  return collator.compare(a, b);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/photos.test.ts`
Expected: PASS — 14 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/photos.ts src/lib/photos.test.ts
git commit -m "feat: 사진 순수 계산 유틸 (dataURL 파싱·비율 판정·다운스케일·파일명 정렬)"
```

---

## Task 3: `lib/reorder.ts` — 배열 재배치

**Files:**
- Create: `src/lib/reorder.ts`
- Test: `src/lib/reorder.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `move<T>(items: readonly T[], from: number, to: number): T[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/reorder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { move } from "@/lib/reorder";

describe("move", () => {
  it("앞에서 뒤로 옮긴다", () => {
    expect(move(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });
  it("뒤에서 앞으로 옮긴다", () => {
    expect(move(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });
  it("같은 자리면 그대로다", () => {
    expect(move(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });
  it("원본을 바꾸지 않는다", () => {
    const src = ["a", "b", "c"];
    move(src, 0, 2);
    expect(src).toEqual(["a", "b", "c"]);
  });
  it("범위 밖 인덱스면 복사본을 그대로 돌려준다", () => {
    expect(move(["a", "b"], -1, 1)).toEqual(["a", "b"]);
    expect(move(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/reorder.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/reorder"`

- [ ] **Step 3: 최소 구현**

`src/lib/reorder.ts`:

```ts
export function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/reorder.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/reorder.ts src/lib/reorder.test.ts
git commit -m "feat: 배열 재배치 유틸 move 추가"
```

---

## Task 4: `lib/layout-assign.ts` — 레이아웃 타입과 기본 배정

**Files:**
- Create: `src/lib/layout-assign.ts`
- Test: `src/lib/layout-assign.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type CardLayout = "full-bleed" | "split" | "text-only"`
  - `CARD_LAYOUTS: readonly CardLayout[]`
  - `LAYOUT_LABELS: Record<CardLayout, string>`
  - `assignLayouts(count: number): CardLayout[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/layout-assign.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { assignLayouts, CARD_LAYOUTS, LAYOUT_LABELS } from "@/lib/layout-assign";

describe("assignLayouts", () => {
  it("5장이면 표지 full-bleed · 중간 split · 마지막 text-only", () => {
    expect(assignLayouts(5)).toEqual(["full-bleed", "split", "split", "split", "text-only"]);
  });
  it("6장도 같은 규칙을 따른다", () => {
    expect(assignLayouts(6)).toEqual(["full-bleed", "split", "split", "split", "split", "text-only"]);
  });
  it("2장이면 표지와 마무리만 남는다", () => {
    expect(assignLayouts(2)).toEqual(["full-bleed", "text-only"]);
  });
  it("1장이면 full-bleed 하나다", () => {
    expect(assignLayouts(1)).toEqual(["full-bleed"]);
  });
  it("0장이면 빈 배열이다", () => {
    expect(assignLayouts(0)).toEqual([]);
  });
});

describe("카탈로그", () => {
  it("레이아웃은 3종이다", () => {
    expect(CARD_LAYOUTS).toEqual(["full-bleed", "split", "text-only"]);
  });
  // 라벨은 편집 화면 세그먼트 컨트롤에 그대로 노출되는 사용자 대면 문자열이다.
  // 길이만 재면 전부 "x" 여도 통과하므로 리터럴로 대조한다.
  it("사용자에게 보이는 한국어 라벨이 정확하다", () => {
    expect(LAYOUT_LABELS).toEqual({
      "full-bleed": "사진 전면",
      split: "사진 + 글",
      "text-only": "글만",
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/layout-assign.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/layout-assign"`

- [ ] **Step 3: 최소 구현**

`src/lib/layout-assign.ts`:

```ts
export type CardLayout = "full-bleed" | "split" | "text-only";

export const CARD_LAYOUTS = ["full-bleed", "split", "text-only"] as const satisfies readonly CardLayout[];

export const LAYOUT_LABELS: Record<CardLayout, string> = {
  "full-bleed": "사진 전면",
  split: "사진 + 글",
  "text-only": "글만",
};

/** 표지는 사진을 꽉 채우고, 마무리(CTA)는 글만 남기는 것이 기본 문법이다. */
export function assignLayouts(count: number): CardLayout[] {
  if (count <= 0) return [];
  if (count === 1) return ["full-bleed"];
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? "full-bleed" : i === count - 1 ? "text-only" : "split",
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/layout-assign.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/layout-assign.ts src/lib/layout-assign.test.ts
git commit -m "feat: 카드 레이아웃 타입과 기본 배정 규칙 추가"
```

---

## Task 5: `lib/prompt.ts` — vision 프롬프트 빌더

**Files:**
- Modify: `src/lib/prompt.ts:13-36` (`buildSystemPrompt` 시그니처 확장)
- Modify: `src/lib/prompt.test.ts` (기존 테스트 유지 + 추가)

**Interfaces:**
- Consumes: `parseDataUrl` (Task 2)
- Produces:
  - `type ContentBlock = { type: "image"; source: { type: "base64"; media_type: string; data: string } } | { type: "text"; text: string }`
  - `buildSystemPrompt(type, vault, hasPhotos: boolean): string` — 3번째 인자 추가
  - `buildUserContent(keyword: string, photos: readonly string[]): ContentBlock[]`

- [ ] **Step 1: 기존 테스트 확인**

Run: `npx vitest run src/lib/prompt.test.ts`
Expected: PASS. 기존 호출부가 `buildSystemPrompt(type, vault)` 2인자인지 확인한다. 3번째 인자는 필수로 추가하므로 기존 테스트도 함께 고친다.

- [ ] **Step 2: 실패하는 테스트 추가**

`src/lib/prompt.test.ts` 파일 끝에 아래를 추가하고, 기존 `buildSystemPrompt(...)` 호출에 3번째 인자 `false`를 붙인다:

```ts
import { buildUserContent } from "@/lib/prompt";

describe("buildUserContent", () => {
  const P1 = "data:image/jpeg;base64,AAA";
  const P2 = "data:image/png;base64,BBB";

  it("사진이 없으면 텍스트 블록 하나만 만든다", () => {
    const blocks = buildUserContent("에어컨 전기세", []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
  });

  it("사진을 먼저 순서대로 넣고 텍스트를 마지막에 넣는다", () => {
    const blocks = buildUserContent("에어컨 전기세", [P1, P2]);
    expect(blocks.map((b) => b.type)).toEqual(["image", "image", "text"]);
  });

  it("이미지 블록에 media type과 base64를 갈라 담는다", () => {
    const [first] = buildUserContent("k", [P1]);
    expect(first).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "AAA" },
    });
  });

  it("사진이 있으면 텍스트에 장수와 순서를 알린다", () => {
    const blocks = buildUserContent("에어컨 전기세", [P1, P2]);
    const text = blocks[blocks.length - 1];
    if (text.type !== "text") throw new Error("마지막은 텍스트 블록이어야 합니다");
    expect(text.text).toContain("2장");
    expect(text.text).toContain("에어컨 전기세");
  });
});

describe("buildSystemPrompt 사진 규칙", () => {
  const vault = { brandVoice: "보이스", copyFormulas: "공식" };

  it("사진이 없으면 사진 규칙을 넣지 않는다", () => {
    expect(buildSystemPrompt("cardnews", vault, false)).not.toContain("사진");
  });
  it("카드뉴스는 N번째 사진이 N번째 카드라고 알린다", () => {
    expect(buildSystemPrompt("cardnews", vault, true)).toContain("N번째 사진");
  });
  it("정보전달은 대표 이미지 규칙을 쓴다", () => {
    expect(buildSystemPrompt("informationsend", vault, true)).toContain("대표 이미지");
  });
  it("사진이 있으면 없는 것을 지어내지 말라고 공통으로 못박는다", () => {
    expect(buildSystemPrompt("cardnews", vault, true)).toContain("보이지 않는 것");
    expect(buildSystemPrompt("informationsend", vault, true)).toContain("보이지 않는 것");
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/prompt.test.ts`
Expected: FAIL — `buildUserContent is not a function` 및 `buildSystemPrompt` 인자 수 불일치

- [ ] **Step 4: 구현**

`src/lib/prompt.ts`의 `buildSystemPrompt`를 교체하고 아래를 추가한다. 파일 상단 import에 `parseDataUrl`을 더한다:

```ts
import { parseDataUrl } from "@/lib/photos";

export type ContentBlock =
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "text"; text: string };

const PHOTO_RULES: Record<"informationsend" | "cardnews", string> = {
  cardnews:
    "첨부된 N번째 사진이 N번째 카드에 쓰입니다. 각 카드의 카피는 그 카드의 사진에 실제로 보이는 것에 근거해 쓰세요.",
  informationsend:
    "첨부된 사진 1장은 이 인포그래픽의 대표 이미지입니다. title·subtitle이 사진과 어긋나지 않게 쓰고, items는 키워드 주제를 따르세요.",
};

const PHOTO_RULE_COMMON = "사진에 보이지 않는 것을 사실처럼 쓰지 마세요.";

export function buildSystemPrompt(
  type: "informationsend" | "cardnews",
  vault: { brandVoice: string; copyFormulas: string },
  hasPhotos: boolean,
): string {
  const rule =
    type === "informationsend"
      ? "산출물 유형은 informationsend(1장 인포그래픽). title, 선택 subtitle, items 3~4개(각 keyword+desc), 선택 tip을 생성하라."
      : "산출물 유형은 cardnews(5~6장 설득 시퀀스). cards 배열을 생성하라. 첫 카드는 반드시 role=hook, 마지막은 반드시 role=cta. 중간은 problem/evidence/solution 흐름.";
  // 스키마는 items 3~6 을 허용하지만 5개 이상은 사진 밴드를 최소로 줄여도 카드에 안 들어간다.
  // 생성 단계에서 3~4개를 요청해 평소엔 큰 글자가 나오게 하고, 사용자가 직접 늘렸을 때만 축소된다.

  const lines = [
    "당신은 RE:픽의 인스타그램 콘텐츠 카피라이터입니다.",
    "아래 브랜드 보이스와 카피 공식을 반드시 지켜 한국어 카피를 작성하세요.",
    "",
    "=== 브랜드 보이스 ===",
    vault.brandVoice.trim(),
    "",
    "=== 카피 공식 ===",
    vault.copyFormulas.trim(),
    "",
    "=== 출력 규칙 ===",
    rule,
    "각 문자열은 스키마의 최대 길이를 넘지 않게 짧고 임팩트 있게. 이모지는 카드당 0~2개.",
  ];

  if (hasPhotos) {
    lines.push("", "=== 사진 규칙 ===", PHOTO_RULES[type], PHOTO_RULE_COMMON);
  }

  return lines.join("\n");
}

export function buildUserContent(keyword: string, photos: readonly string[]): ContentBlock[] {
  const blocks: ContentBlock[] = photos.map((dataUrl) => {
    const { mediaType, base64 } = parseDataUrl(dataUrl);
    return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
  });

  const text =
    photos.length > 0
      ? `키워드: "${keyword}"\n첨부한 사진 ${photos.length}장은 순서대로 1번부터 ${photos.length}번입니다.\n위 키워드와 사진으로 콘텐츠 카피를 생성하세요.`
      : `키워드: "${keyword}"\n위 키워드로 콘텐츠 카피를 생성하세요.`;

  blocks.push({ type: "text", text });
  return blocks;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/lib/prompt.test.ts`
Expected: PASS — 기존 테스트 + 신규 8개

- [ ] **Step 6: 커밋**

```bash
git add src/lib/prompt.ts src/lib/prompt.test.ts
git commit -m "feat: vision 유저 콘텐츠 블록 빌더와 유형별 사진 규칙 추가"
```

---

## Task 6: `/api/generate` — 사진 수용

**Files:**
- Modify: `src/app/api/generate/route.ts:10-17` (BodySchema), `:49-57` (messages)
- Modify: `src/app/api/generate/route.test.ts`

**Interfaces:**
- Consumes: `buildUserContent` · `buildSystemPrompt` (Task 5)
- Produces: `POST /api/generate` 가 `{ keyword, type, photos?: string[] }` 를 받는다

- [ ] **Step 1: 실패하는 테스트 추가**

`src/app/api/generate/route.test.ts` 끝에 추가:

```ts
describe("parseBody photos", () => {
  const base = { keyword: "에어컨", type: "cardnews" as const };

  it("photos가 없으면 빈 배열로 채운다", () => {
    expect(parseBody(base).photos).toEqual([]);
  });
  it("dataURL 배열을 받는다", () => {
    const photos = ["data:image/jpeg;base64,AAA"];
    expect(parseBody({ ...base, photos }).photos).toEqual(photos);
  });
  it("6장을 넘으면 거부한다", () => {
    const photos = Array.from({ length: 7 }, () => "data:image/jpeg;base64,AAA");
    expect(() => parseBody({ ...base, photos })).toThrow();
  });
  it("dataURL이 아니면 거부한다", () => {
    expect(() => parseBody({ ...base, photos: ["https://example.com/a.jpg"] })).toThrow();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/api/generate/route.test.ts`
Expected: FAIL — `photos` 가 `undefined`

- [ ] **Step 3: 구현**

`src/app/api/generate/route.ts`의 `BodySchema`를 교체:

```ts
const BodySchema = z.object({
  keyword: z.string().trim().min(1, "키워드를 입력하세요").max(60),
  type: z.enum(["informationsend", "cardnews"]),
  // 허용 형식은 Anthropic 이 base64 이미지로 받는 4종과 정확히 같아야 한다.
  // 더 넓게 열면 zod 는 통과시키고 prompt.ts 의 media type 가드가 던져서 400 이어야 할 것이 500 이 된다.
  photos: z
    .array(
      z
        .string()
        .regex(
          /^data:image\/(jpeg|png|gif|webp);base64,/,
          "사진은 jpeg·png·gif·webp 형식의 base64 dataURL이어야 합니다",
        ),
    )
    .max(6)
    .default([]),
});
```

import에 `buildUserContent`를 더하고, `messages.parse` 호출부를 교체:

```ts
    const system = buildSystemPrompt(body.type, vault, body.photos.length > 0);
```

```ts
      messages: [{ role: "user", content: buildUserContent(body.keyword, body.photos) }],
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/api/generate/route.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 테스트 · 타입 확인**

Run: `npm test && npx tsc --noEmit`
Expected: 전부 통과, 타입 에러 0

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/generate/route.ts src/app/api/generate/route.test.ts
git commit -m "feat: generate API가 사진 dataURL을 받아 vision 입력으로 넘기도록"
```

---

## Task 7: `lib/ledger.ts` — 최근 N건 읽기

**Files:**
- Modify: `src/lib/ledger.ts`
- Modify: `src/lib/ledger.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `readRecent(limit: number, opts?: { file?: string }): Promise<LedgerEntry[]>` — 최신순

- [ ] **Step 1: 실패하는 테스트 추가**

`src/lib/ledger.test.ts` 끝에 추가 (`readRecent`를 import에 더한다):

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readRecent } from "@/lib/ledger";

describe("readRecent", () => {
  async function fixture(lines: string[]): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "ledger-"));
    const file = path.join(dir, "ledger.jsonl");
    await writeFile(file, lines.join("\n") + "\n", "utf8");
    return file;
  }

  const entry = (keyword: string) =>
    JSON.stringify({
      ts: "2026-07-31T00:00:00.000Z",
      type: "cardnews",
      keyword,
      count: 5,
      templateIds: [],
      model: "claude-opus-4-8",
      paths: [],
      perf: null,
    });

  it("최신순으로 돌려준다", async () => {
    const file = await fixture([entry("첫째"), entry("둘째"), entry("셋째")]);
    const rows = await readRecent(2, { file });
    expect(rows.map((r) => r.keyword)).toEqual(["셋째", "둘째"]);
  });

  it("파일이 없으면 빈 배열이다", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "ledger-"));
    expect(await readRecent(5, { file: path.join(dir, "없는파일.jsonl") })).toEqual([]);
  });

  it("빈 줄을 건너뛴다", async () => {
    const file = await fixture([entry("하나"), "", entry("둘")]);
    expect(await readRecent(5, { file })).toHaveLength(2);
  });

  it("0건을 요청하면 빈 배열이다", async () => {
    const file = await fixture([entry("하나"), entry("둘")]);
    expect(await readRecent(0, { file })).toEqual([]);
  });

  it("ENOENT 가 아닌 에러는 삼키지 않고 다시 던진다", async () => {
    // 파일 자리에 디렉터리를 두면 readFile 이 EISDIR 로 실패한다 — 빈 상태가 아니라 진짜 고장이다.
    const dir = await mkdtemp(path.join(tmpdir(), "ledger-"));
    await expect(readRecent(5, { file: dir })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/ledger.test.ts`
Expected: FAIL — `readRecent is not a function`

- [ ] **Step 3: 구현**

`src/lib/ledger.ts`의 import를 `import { appendFile, readFile } from "node:fs/promises";` 로 바꾸고 파일 끝에 추가:

```ts
/** 원장이 아직 없는 첫 실행은 실패가 아니라 빈 상태다. */
export async function readRecent(limit: number, opts?: { file?: string }): Promise<LedgerEntry[]> {
  // slice(-0) 은 slice(0) 과 같아 전체를 돌려준다 — 0건 요청을 전체 반환으로 뒤집지 않도록 먼저 막는다.
  if (limit <= 0) return [];
  let raw: string;
  try {
    raw = await readFile(opts?.file ?? DEFAULT_FILE, "utf8");
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return [];
    throw e;
  }
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as LedgerEntry)
    .slice(-limit)
    .reverse();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/ledger.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/ledger.ts src/lib/ledger.test.ts
git commit -m "feat: 원장에서 최근 N건을 최신순으로 읽는 readRecent 추가"
```

---

## Task 8: `templates/layout-utils.ts` — 초점·스크림 계산

**Files:**
- Create: `src/templates/layout-utils.ts`
- Test: `src/templates/layout-utils.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type Focal = { x: number; y: number }`
  - `DEFAULT_FOCAL: Focal` (`{ x: 0.5, y: 0.5 }`)
  - `DEFAULT_SCRIM = 0.72` · `DEFAULT_BAND_CARDNEWS = 0.6` · `DEFAULT_BAND_INFO = 0.35`
  - `objectPosition(focal: Focal): string`
  - `scrimGradient(strength: number): string`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/templates/layout-utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  objectPosition,
  scrimGradient,
  DEFAULT_FOCAL,
  DEFAULT_SCRIM,
  DEFAULT_BAND_CARDNEWS,
  DEFAULT_BAND_INFO,
} from "@/templates/layout-utils";

describe("objectPosition", () => {
  it("0~1 좌표를 퍼센트로 바꾼다", () => {
    expect(objectPosition({ x: 0.5, y: 0.3 })).toBe("50% 30%");
  });
  it("반올림해 정수 퍼센트로 만든다", () => {
    expect(objectPosition({ x: 0.333, y: 0.666 })).toBe("33% 67%");
  });
  it("범위를 벗어나면 0~100으로 자른다", () => {
    expect(objectPosition({ x: -1, y: 2 })).toBe("0% 100%");
  });
  it("기본 초점은 정중앙이다", () => {
    expect(objectPosition(DEFAULT_FOCAL)).toBe("50% 50%");
  });
});

describe("scrimGradient", () => {
  it("아래에서 위로 옅어지는 그라데이션을 만든다", () => {
    expect(scrimGradient(0.8)).toBe(
      "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 34%, rgba(0,0,0,0) 68%)",
    );
  });
  it("강도를 0~1로 자른다", () => {
    expect(scrimGradient(2)).toContain("rgba(0,0,0,1)");
    expect(scrimGradient(-1)).toContain("rgba(0,0,0,0) 0%");
  });
  it("소수 둘째 자리로 반올림해 결정론을 지킨다", () => {
    expect(scrimGradient(0.333)).toContain("rgba(0,0,0,0.33)");
  });
});

describe("기본값", () => {
  it("스크림 기본값은 대비를 확보하는 0.72다", () => {
    expect(DEFAULT_SCRIM).toBe(0.72);
  });
  it("밴드 기본값은 카드뉴스 0.45 · 정보전달 0.35다", () => {
    expect(DEFAULT_BAND_CARDNEWS).toBe(0.45);
    expect(DEFAULT_BAND_INFO).toBe(0.35);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/templates/layout-utils.test.ts`
Expected: FAIL — `Failed to resolve import "@/templates/layout-utils"`

- [ ] **Step 3: 구현**

`src/templates/layout-utils.ts`:

```ts
export type Focal = { x: number; y: number };

export const DEFAULT_FOCAL: Focal = { x: 0.5, y: 0.5 };
/** 흰 텍스트가 사진 위에서 대비 4.5:1을 확보하는 하한 */
export const DEFAULT_SCRIM = 0.72;
/**
 * 사진 45% / 글 55%. 0.6 이면 글 영역이 372px 로 줄어 steps 를 가진 solution 카드(~935px 소요)가
 * CardFrame 의 overflow:hidden 에 잘려 나간다 — 에러 없이 PNG 만 깨지는 종류라 기본값으로 둘 수 없다.
 */
export const DEFAULT_BAND_CARDNEWS = 0.45;
export const DEFAULT_BAND_INFO = 0.35;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function objectPosition(focal: Focal): string {
  return `${Math.round(clamp01(focal.x) * 100)}% ${Math.round(clamp01(focal.y) * 100)}%`;
}

export function scrimGradient(strength: number): string {
  const a = round2(clamp01(strength));
  const mid = round2(a * 0.75);
  return `linear-gradient(to top, rgba(0,0,0,${a}) 0%, rgba(0,0,0,${mid}) 34%, rgba(0,0,0,0) 68%)`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/templates/layout-utils.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: 커밋**

```bash
git add src/templates/layout-utils.ts src/templates/layout-utils.test.ts
git commit -m "feat: 카드 초점·스크림 계산 유틸 추가"
```

---

## Task 9: 테마·프레임 개편 (워터마크 분리)

**Files:**
- Modify: `src/templates/themes.ts`
- Modify: `src/templates/CardFrame.tsx`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `Theme = { label, bg, fg, accent, highlight, displayFont, onPhoto }` — `watermark` 제거, `onPhoto` 추가
  - `<CardFrame theme={t} handle={string}>` — 패딩 없음, `handle`이 빈 문자열이면 워터마크 미렌더

- [ ] **Step 1: 테마 교체**

`src/templates/themes.ts` 전체를 교체:

```ts
export type ThemeId = "violet-doodle" | "mint-clean" | "mono-bold";

export type Theme = {
  label: string;
  bg: string;
  fg: string;
  accent: string;
  highlight: string;
  displayFont: string;
  /** 사진 위 스크림에 얹는 텍스트 색 */
  onPhoto: string;
};

export const THEMES: Record<ThemeId, Theme> = {
  "violet-doodle": {
    label: "보라 두들",
    bg: "#fbfaff",
    fg: "#1a1330",
    accent: "#6E56CF",
    highlight: "#e9defb",
    displayFont: '"Gaegu", cursive',
    onPhoto: "#ffffff",
  },
  "mint-clean": {
    label: "민트 클린",
    bg: "#ffffff",
    fg: "#16302a",
    accent: "#0f9d76",
    highlight: "#fff6a8",
    displayFont: '"Do Hyeon", sans-serif',
    onPhoto: "#ffffff",
  },
  "mono-bold": {
    label: "모노 볼드",
    bg: "#0f0f10",
    fg: "#ffffff",
    accent: "#ff5a36",
    highlight: "#3a3a3d",
    displayFont: '"Do Hyeon", sans-serif',
    onPhoto: "#ffffff",
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
```

- [ ] **Step 2: 프레임 교체**

`src/templates/CardFrame.tsx` 전체를 교체. 패딩을 없애고 레이아웃이 직접 여백을 잡게 한다:

```tsx
import type { Theme } from "@/templates/themes";

/** 1080×1350 캔버스. 패딩은 레이아웃이 각자 잡는다 (full-bleed는 0이어야 하므로). */
export function CardFrame({
  theme,
  handle,
  children,
}: {
  theme: Theme;
  handle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: theme.bg,
        color: theme.fg,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
      {handle.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 44,
            fontSize: 26,
            color: theme.accent,
            fontFamily: theme.displayFont,
            opacity: 0.85,
            zIndex: 2,
          }}
        >
          {handle}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 타입 확인**

Run: `npx tsc --noEmit`
Expected: `studio.tsx` · `InfographicCard.tsx` · `CardnewsSlide.tsx` 에서 에러가 난다. Task 10~11에서 해소하므로 이 시점 에러는 예상된 것이다. 에러가 그 세 파일에만 있는지 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add src/templates/themes.ts src/templates/CardFrame.tsx
git commit -m "refactor: 워터마크를 테마 고정값에서 분리하고 프레임 패딩을 레이아웃으로 이관"
```

---

## Task 10: 카피 본문 컴포넌트 추출

**Files:**
- Create: `src/templates/bodies/InfographicBody.tsx`
- Create: `src/templates/bodies/CardnewsBody.tsx`
- Delete: `src/templates/InfographicCard.tsx` · `src/templates/CardnewsSlide.tsx`

**Interfaces:**
- Consumes: `Theme` (Task 9)
- Produces:
  - `<InfographicBody spec={InfographicSpec} theme={Theme} />`
  - `<CardnewsBody card={CardnewsCard} theme={Theme} onPhoto={boolean} />` — `onPhoto`가 true면 사진 위 색으로 렌더

- [ ] **Step 1: 인포그래픽 본문 추출**

`src/templates/bodies/InfographicBody.tsx`. 기존 `InfographicCard.tsx`의 내용에서 `CardFrame` 래퍼만 걷어낸 것이다:

```tsx
import type { InfographicSpec } from "@/lib/schema";
import type { Theme } from "@/templates/themes";

export function InfographicBody({ spec, theme: t }: { spec: InfographicSpec; theme: Theme }) {
  return (
    <>
      <h1 style={{ fontFamily: t.displayFont, fontSize: 66, lineHeight: 1.2, margin: 0 }}>{spec.title}</h1>
      {spec.subtitle && (
        <p style={{ fontSize: 32, marginTop: 16, marginBottom: 8, opacity: 0.85 }}>{spec.subtitle}</p>
      )}
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>
        {spec.items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div
              style={{
                flex: "0 0 auto",
                width: 52,
                height: 52,
                borderRadius: 999,
                background: t.accent,
                color: t.bg,
                fontFamily: t.displayFont,
                fontSize: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  background: t.highlight,
                  padding: "2px 8px",
                  borderRadius: 6,
                  boxDecorationBreak: "clone",
                  WebkitBoxDecorationBreak: "clone",
                }}
              >
                {it.keyword}
              </span>
              <p style={{ fontSize: 27, lineHeight: 1.45, marginTop: 10, marginBottom: 0, opacity: 0.9 }}>
                {it.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
      {spec.tip && (
        <div style={{ marginTop: 20, padding: 22, borderRadius: 18, border: `2px solid ${t.accent}` }}>
          {/* ✅ 는 brand-voice.md 가 TIP 앞자리에 명시 승인한 이모지다. 하네스의 이모지 금지는
              UI 크롬에 대한 것이고 카드는 산출물이므로 여기서는 유지한다. */}
          <span style={{ fontFamily: t.displayFont, fontSize: 30, color: t.accent }}>✅ TIP </span>
          <span style={{ fontSize: 27 }}>{spec.tip}</span>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: 카드뉴스 본문 추출**

`src/templates/bodies/CardnewsBody.tsx`:

```tsx
import type { CardnewsCard } from "@/lib/schema";
import type { Theme } from "@/templates/themes";

export function CardnewsBody({
  card,
  theme: t,
  onPhoto = false,
}: {
  card: CardnewsCard;
  theme: Theme;
  onPhoto?: boolean;
}) {
  const fg = onPhoto ? t.onPhoto : t.fg;
  const tagBg = onPhoto ? t.onPhoto : t.accent;
  const tagFg = onPhoto ? "#111111" : t.bg;

  const Heading = ({ children }: { children: React.ReactNode }) => (
    <h1 style={{ fontFamily: t.displayFont, fontSize: 72, lineHeight: 1.22, margin: 0, color: fg }}>
      {children}
    </h1>
  );
  const Body = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize: 34, lineHeight: 1.5, marginTop: 28, opacity: 0.92, color: fg }}>{children}</p>
  );
  const RoleTag = ({ label }: { label: string }) => (
    <span
      style={{
        display: "inline-block",
        fontFamily: t.displayFont,
        fontSize: 30,
        color: tagFg,
        background: tagBg,
        padding: "6px 20px",
        borderRadius: 999,
        marginBottom: 28,
      }}
    >
      {label}
    </span>
  );

  if (card.role === "hook") {
    return (
      <>
        {card.badge && <RoleTag label={card.badge} />}
        <Heading>{card.heading}</Heading>
        {card.sub && <Body>{card.sub}</Body>}
      </>
    );
  }
  if (card.role === "problem" || card.role === "evidence") {
    return (
      <>
        <RoleTag label={card.role === "problem" ? "문제" : "증거"} />
        <Heading>{card.heading}</Heading>
        <Body>{card.body}</Body>
      </>
    );
  }
  if (card.role === "solution") {
    return (
      <>
        <RoleTag label="해결책" />
        <Heading>{card.heading}</Heading>
        <Body>{card.body}</Body>
        {card.steps && (
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            {card.steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 30, color: fg }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: t.highlight,
                    color: t.fg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: t.displayFont,
                  }}
                >
                  {i + 1}
                </span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }
  return (
    <div style={{ textAlign: "center" }}>
      <Heading>{card.heading}</Heading>
      <div
        style={{
          marginTop: 40,
          display: "inline-block",
          fontFamily: t.displayFont,
          fontSize: 40,
          color: tagFg,
          background: tagBg,
          padding: "18px 40px",
          borderRadius: 20,
        }}
      >
        {card.action}
      </div>
      {card.handle && <p style={{ marginTop: 28, fontSize: 30, opacity: 0.8, color: fg }}>{card.handle}</p>}
    </div>
  );
}
```

- [ ] **Step 3: 옛 카드 컴포넌트 삭제**

```bash
rm src/templates/InfographicCard.tsx src/templates/CardnewsSlide.tsx
```

- [ ] **Step 4: 커밋**

```bash
git add -A src/templates
git commit -m "refactor: 카피 본문을 프레임에서 분리해 bodies/로 추출"
```

---

> **리뷰 반영 (2026-07-31)** — 아래 Task 10·11 코드 블록은 초안이다. 리뷰가 찾은 Important 4건을
> 반영해 실제 구현은 다음이 추가됐다(정본은 git):
> ① `FullBleedCard` 의 스크림을 `photoUrl` 가드 안으로 넣고 배지를 `SplitPhotoCard` 와 같은
>    반투명 검정 칩으로 — 사진 없는 full-bleed 에서 대비 1.6:1 이 나오던 것과, 스크림이 닿지 않는
>    상단 432px 에 흰 배지가 놓이던 것을 막는다.
> ② `CardnewsBody` 에 `compact` prop 추가 — `split` 에서만 타이포를 줄인다.
> ③ `InfographicBody` 에 `onPhoto` prop 추가 — `CardnewsBody` 와 같은 사진 위 색 경로.
> ⑤ `InfographicBody` 에 `compact` prop 추가 — 항목 5개 이상일 때만 타이포를 줄인다. 실측 결과
>    항목 6개는 기본 타이포로 1253px 이 필요한데 밴드 하한(0.15)의 가용은 979px 이라 잘렸다.
>    `CardRenderer` 가 `compact={card.copy.items.length >= 5}` 로 판단해 넘긴다.
> ④ `CardRenderer` 가 `compact={card.layout === "split"}` 와 `onPhoto` 를 두 본문에 전달.

## Task 11: 레이아웃 3종 + CardRenderer

**Files:**
- Create: `src/templates/layouts/FullBleedCard.tsx` · `SplitPhotoCard.tsx` · `TextOnlyCard.tsx`
- Modify: `src/templates/CardRenderer.tsx` (전체 교체)

**Interfaces:**
- Consumes: `CardFrame` (Task 9) · `InfographicBody`·`CardnewsBody` (Task 10) · `objectPosition`·`scrimGradient` (Task 8) · `CardLayout` (Task 4)
- Produces:
  - `type RenderCard = { layout: CardLayout; photoUrl: string | null; focal: Focal; scrim: number; band: number; badge: string; copy: CardnewsCard | InfographicSpec }`
  - `<CardRenderer card={RenderCard} themeId={ThemeId} handle={string} />`

- [ ] **Step 1: 풀블리드 레이아웃**

`src/templates/layouts/FullBleedCard.tsx`:

```tsx
import type { Theme } from "@/templates/themes";
import { objectPosition, scrimGradient, type Focal } from "@/templates/layout-utils";

export function FullBleedCard({
  theme,
  photoUrl,
  focal,
  scrim,
  badge,
  children,
}: {
  theme: Theme;
  photoUrl: string | null;
  focal: Focal;
  scrim: number;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {photoUrl && (
        // html-to-image가 캡처하려면 dataURL을 문 원시 img여야 한다 (next/image는 dataURL 최적화 불가)
        <img
          src={photoUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: 1080,
            height: 1350,
            objectFit: "cover",
            objectPosition: objectPosition(focal),
          }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, background: scrimGradient(scrim) }} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 72,
          paddingBottom: 96,
        }}
      >
        {badge && (
          <div style={{ position: "absolute", top: 72, right: 72, fontSize: 26, color: theme.onPhoto, opacity: 0.9 }}>
            {badge}
          </div>
        )}
        {children}
      </div>
    </>
  );
}
```

**주의:** 이 프로젝트에는 eslint가 설치돼 있지 않다(`package.json`에 의존성·스크립트 없음, 설정 파일 없음). 따라서 `eslint-disable` 주석은 달지 않는다 — 아무 일도 하지 않으면서 Global Constraints의 금지 항목만 어긴다. 원시 `<img>`를 쓰는 사유는 위와 같이 **한국어 주석 한 줄**로만 남긴다.

- [ ] **Step 2: 분할 레이아웃**

`src/templates/layouts/SplitPhotoCard.tsx`:

```tsx
import { objectPosition, type Focal } from "@/templates/layout-utils";

export function SplitPhotoCard({
  photoUrl,
  focal,
  band,
  badge,
  accent,
  children,
}: {
  photoUrl: string | null;
  focal: Focal;
  band: number;
  badge: string;
  accent: string;
  children: React.ReactNode;
}) {
  const photoHeight = Math.round(1350 * band);
  return (
    <>
      <div style={{ position: "relative", height: photoHeight, flex: "0 0 auto", overflow: "hidden" }}>
        {photoUrl && (
          // html-to-image 캡처를 위해 원시 img를 쓴다 (next/image는 dataURL 최적화 불가)
          <img
            src={photoUrl}
            alt=""
            style={{
              width: 1080,
              height: photoHeight,
              objectFit: "cover",
              objectPosition: objectPosition(focal),
              display: "block",
            }}
          />
        )}
        {badge && (
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 44,
              fontSize: 26,
              color: "#ffffff",
              background: "rgba(0,0,0,0.45)",
              padding: "6px 18px",
              borderRadius: 999,
            }}
          >
            {badge}
          </div>
        )}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          paddingBottom: 96,
          borderTop: `6px solid ${accent}`,
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </>
  );
}
```

- [ ] **Step 3: 텍스트 전용 레이아웃**

`src/templates/layouts/TextOnlyCard.tsx`:

```tsx
export function TextOnlyCard({
  badge,
  accent,
  children,
}: {
  badge: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 72,
        paddingBottom: 96,
      }}
    >
      {badge && (
        <div style={{ position: "absolute", top: 72, right: 72, fontSize: 26, color: accent }}>{badge}</div>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 4: CardRenderer 교체**

`src/templates/CardRenderer.tsx` 전체를 교체:

```tsx
import type { CardnewsCard, InfographicSpec } from "@/lib/schema";
import type { CardLayout } from "@/lib/layout-assign";
import { THEMES, type ThemeId } from "@/templates/themes";
import { CardFrame } from "@/templates/CardFrame";
import { InfographicBody } from "@/templates/bodies/InfographicBody";
import { CardnewsBody } from "@/templates/bodies/CardnewsBody";
import { FullBleedCard } from "@/templates/layouts/FullBleedCard";
import { SplitPhotoCard } from "@/templates/layouts/SplitPhotoCard";
import { TextOnlyCard } from "@/templates/layouts/TextOnlyCard";
import type { Focal } from "@/templates/layout-utils";

export type RenderCard = {
  layout: CardLayout;
  photoUrl: string | null;
  focal: Focal;
  scrim: number;
  band: number;
  /** "1 / 5" 형태. 빈 문자열이면 렌더하지 않는다 */
  badge: string;
  copy: CardnewsCard | InfographicSpec;
};

export function CardRenderer({
  card,
  themeId,
  handle,
}: {
  card: RenderCard;
  themeId: ThemeId;
  handle: string;
}) {
  const theme = THEMES[themeId];
  const onPhoto = card.layout === "full-bleed" && card.photoUrl !== null;
  const body =
    "type" in card.copy ? (
      <InfographicBody spec={card.copy} theme={theme} />
    ) : (
      <CardnewsBody card={card.copy} theme={theme} onPhoto={onPhoto} />
    );

  return (
    <CardFrame theme={theme} handle={handle}>
      {card.layout === "full-bleed" && (
        <FullBleedCard
          theme={theme}
          photoUrl={card.photoUrl}
          focal={card.focal}
          scrim={card.scrim}
          badge={card.badge}
        >
          {body}
        </FullBleedCard>
      )}
      {card.layout === "split" && (
        <SplitPhotoCard
          photoUrl={card.photoUrl}
          focal={card.focal}
          band={card.band}
          badge={card.badge}
          accent={theme.accent}
        >
          {body}
        </SplitPhotoCard>
      )}
      {card.layout === "text-only" && (
        <TextOnlyCard badge={card.badge} accent={theme.accent}>
          {body}
        </TextOnlyCard>
      )}
    </CardFrame>
  );
}
```

- [ ] **Step 5: 타입 확인**

Run: `npx tsc --noEmit`
Expected: `src/app/studio.tsx` 에서만 에러가 남는다 (Task 19에서 삭제). 다른 파일에 에러가 있으면 고친다.

- [ ] **Step 6: 커밋**

```bash
git add -A src/templates
git commit -m "feat: 카드 레이아웃 3종(full-bleed/split/text-only)과 렌더러 분기 추가"
```

---

## Task 12: UI 원자 컴포넌트

**Files:**
- Create: `src/components/ui/Button.tsx` · `Field.tsx` · `SegmentedControl.tsx` · `Badge.tsx` · `Panel.tsx` · `index.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `<Button variant="primary"|"secondary"|"ghost" size="md"|"sm" {...ButtonHTMLAttributes} />`
  - `<Field label={string} hint?={string} htmlFor={string}>{children}</Field>`
  - `<SegmentedControl<T> options={{value:T,label:string}[]} value={T} onChange={(v:T)=>void} ariaLabel={string} />`
  - `<Badge tone="neutral"|"warn"|"accent">{children}</Badge>`
  - `<Panel>{children}</Panel>`
  - barrel: `src/components/ui/index.ts`

- [ ] **Step 1: Button**

`src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[transform,background-color,border-color] duration-200 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:opacity-45 disabled:cursor-not-allowed motion-reduce:transition-none";

const VARIANTS = {
  primary: "bg-plum text-white hover:bg-plum/90 border border-transparent",
  secondary: "bg-surface text-ink border border-hair hover:border-ink-3",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:text-ink hover:bg-hair-soft",
} as const;

const SIZES = {
  md: "h-11 px-4 text-[15px]",
  sm: "h-9 px-3 text-sm",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest} />;
}
```

- [ ] **Step 2: Field · Badge · Panel**

`src/components/ui/Field.tsx`:

```tsx
export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
```

`src/components/ui/Badge.tsx`:

```tsx
const TONES = {
  neutral: "bg-hair-soft text-ink-2",
  // 일회성: 4:5 아님 경고 배지에만 쓰는 앰버. 액센트(플럼)와 겹치지 않게 따로 둔다
  warn: "bg-[#FDF1E7] text-[#8A4B12]",
  accent: "bg-plum-soft text-plum",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold tabular-nums ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
```

`warn` 톤의 arbitrary value는 경고 배지 한 곳에서만 쓰는 일회성 색이라 토큰화하지 않는다 — 3회 이상 반복되면 `design-tokens.ts`로 올린다.

`src/components/ui/Panel.tsx`:

```tsx
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-hair bg-surface shadow-sm ${className}`}>{children}</div>
  );
}
```

- [ ] **Step 3: SegmentedControl**

`src/components/ui/SegmentedControl.tsx`:

```tsx
"use client";

import { useRef, type KeyboardEvent } from "react";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // 선택된 항목이 없으면(값이 옵션에 없을 때) 첫 항목을 Tab 정거장으로 삼는다 —
  // 아무것도 tabIndex 0 이 아니면 그룹 전체가 키보드로 도달 불가가 된다.
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  // WAI-ARIA radiogroup: 화살표로 선택과 포커스가 함께 이동하고, Tab 정거장은 선택된 항목 하나뿐이다.
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg border border-hair bg-surface p-1">
      {options.map((opt, i) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(node) => {
              refs.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === activeIndex ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`h-9 rounded-md px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
              on ? "bg-plum text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: barrel export**

`src/components/ui/index.ts`:

```ts
export { Button } from "./Button";
export { Field } from "./Field";
export { SegmentedControl } from "./SegmentedControl";
export { Badge } from "./Badge";
export { Panel } from "./Panel";
export { ContiMark } from "./ContiMark";
```

- [ ] **Step 5: 타입 확인 후 커밋**

Run: `npx tsc --noEmit`
Expected: `studio.tsx` 외 에러 없음

```bash
git add src/components/ui
git commit -m "feat: 스튜디오 UI 원자 컴포넌트 (버튼·필드·세그먼트·배지·패널)"
```

---

## Task 13: 앱 셸

**Files:**
- Create: `src/features/shell/StudioShell.tsx` · `StepRail.tsx` · `types.ts`
- Modify: `package.json` (lucide-react 설치)

**Interfaces:**
- Consumes: `Button` · `ContiMark` (Task 12)
- Produces:
  - `type StepDef = { id: number; label: string }`
  - `<StudioShell flowLabel steps current maxReached onSelectStep meta onExit footer>{children}</StudioShell>`
  - `footer: { onPrev?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; hint?: string }`

- [ ] **Step 1: lucide-react 설치**

```bash
npm install lucide-react
```

- [ ] **Step 2: 타입 정의**

`src/features/shell/types.ts`:

```ts
export type StepDef = { id: number; label: string };

export type ShellFooter = {
  onPrev?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** 다음으로 못 넘어가는 이유를 사용자에게 알리는 문장 */
  hint?: string;
};
```

- [ ] **Step 3: 스텝 레일**

`src/features/shell/StepRail.tsx`:

```tsx
"use client";

import { Check } from "lucide-react";
import type { StepDef } from "./types";

export function StepRail({
  steps,
  current,
  maxReached,
  onSelect,
}: {
  steps: readonly StepDef[];
  current: number;
  maxReached: number;
  onSelect: (id: number) => void;
}) {
  return (
    <nav aria-label="제작 단계">
      <ol className="flex flex-col gap-1">
        {steps.map((step) => {
          const done = step.id < current;
          const active = step.id === current;
          const reachable = step.id <= maxReached;
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                onClick={() => onSelect(step.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
                  active
                    ? "bg-plum-soft font-semibold text-plum"
                    : reachable
                      ? "text-ink-2 hover:bg-hair-soft hover:text-ink"
                      : "cursor-not-allowed text-ink-3/60"
                }`}
              >
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                    active
                      ? "bg-plum text-white"
                      : done
                        ? "bg-plum/25 text-plum"
                        : "bg-hair text-ink-3"
                  }`}
                >
                  {done ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : step.id}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 4: 셸**

`src/features/shell/StudioShell.tsx`:

```tsx
"use client";

import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Button, ContiMark } from "@/components/ui";
import { StepRail } from "./StepRail";
import type { ShellFooter, StepDef } from "./types";

export function StudioShell({
  flowLabel,
  steps,
  current,
  maxReached,
  onSelectStep,
  meta,
  onReset,
  onExit,
  footer,
  children,
}: {
  flowLabel: string;
  steps: readonly StepDef[];
  current: number;
  maxReached: number;
  onSelectStep: (id: number) => void;
  meta: string;
  onReset: () => void;
  onExit: () => void;
  footer: ShellFooter;
  children: React.ReactNode;
}) {
  const currentStep = steps.find((s) => s.id === current);

  return (
    <div className="flex h-screen bg-canvas text-ink">
      <aside className="flex w-60 flex-none flex-col border-r border-hair bg-surface px-3 py-4">
        <button
          type="button"
          onClick={onExit}
          className="mb-6 flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-200 hover:bg-hair-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none"
        >
          <span className="text-plum">
            <ContiMark size={20} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-tight">콘티</span>
            <span className="block text-[11px] text-ink-3">{flowLabel}</span>
          </span>
        </button>

        <StepRail steps={steps} current={current} maxReached={maxReached} onSelect={onSelectStep} />

        <div className="mt-auto border-t border-hair-soft pt-3 text-[11px] tabular-nums text-ink-3">{meta}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center justify-between border-b border-hair bg-surface px-6">
          <h1 className="text-[15px] font-semibold">
            <span className="mr-2 tabular-nums text-ink-3">{current}</span>
            {currentStep?.label}
          </h1>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" />
            초기화
          </Button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>

        <footer className="flex h-16 flex-none items-center justify-between gap-4 border-t border-hair bg-surface px-6">
          <p className="min-w-0 truncate text-sm text-ink-3">{footer.hint ?? ""}</p>
          <div className="flex flex-none gap-2">
            {footer.onPrev && (
              <Button variant="secondary" onClick={footer.onPrev}>
                <ArrowLeft size={15} aria-hidden="true" />
                이전
              </Button>
            )}
            {footer.onNext && (
              <Button variant="primary" onClick={footer.onNext} disabled={footer.nextDisabled}>
                {footer.nextLabel ?? "다음"}
                <ArrowRight size={15} aria-hidden="true" />
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 타입 확인 후 커밋**

Run: `npx tsc --noEmit`
Expected: `studio.tsx` 외 에러 없음

```bash
git add package.json package-lock.json src/features/shell
git commit -m "feat: 스텝 레일·탑바·푸터 내비를 갖춘 스튜디오 앱 셸"
```

---

## Task 14: 허브 페이지

**Files:**
- Create: `src/app/page.tsx` (전체 교체) · `src/features/hub/FlowCard.tsx` · `src/features/hub/RecentList.tsx`

**Interfaces:**
- Consumes: `readRecent` (Task 7) · `ContiMark`·`Panel`·`Badge` (Task 12)
- Produces: `/` 라우트 — 두 플로우 진입 카드 + 최근 5건

- [ ] **Step 1: 플로우 카드**

`src/features/hub/FlowCard.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FlowCard({
  href,
  title,
  description,
  steps,
  outputPath,
  preview,
}: {
  href: string;
  title: string;
  description: string;
  steps: number;
  outputPath: string;
  preview: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-5 rounded-xl border border-hair bg-surface p-6 shadow-sm transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex h-28 items-center justify-center rounded-lg bg-canvas">{preview}</div>
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-1.5 text-lg font-extrabold tracking-tight">
          {title}
          <ArrowRight
            size={16}
            aria-hidden="true"
            className="text-plum opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none"
          />
        </h2>
        <p className="text-sm leading-relaxed text-ink-2">{description}</p>
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1 border-t border-hair-soft pt-3 text-[11px]">
        <dt className="text-ink-3">단계</dt>
        <dd className="text-right tabular-nums text-ink-2">{steps}스텝</dd>
        <dt className="text-ink-3">저장 위치</dt>
        <dd className="truncate text-right font-mono text-ink-2">{outputPath}</dd>
      </dl>
    </Link>
  );
}
```

- [ ] **Step 2: 최근 목록**

`src/features/hub/RecentList.tsx`:

```tsx
import type { LedgerEntry } from "@/lib/ledger";
import { Badge } from "@/components/ui";

const TYPE_LABEL: Record<string, string> = {
  cardnews: "카드뉴스",
  informationsend: "정보전달",
};

export function RecentList({ rows }: { rows: readonly LedgerEntry[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-3">아직 만든 게 없어요. 위에서 하나 골라 시작해 보세요.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-hair-soft">
      {rows.map((row) => (
        <li key={`${row.ts}-${row.keyword}`} className="flex items-center gap-3 py-2.5">
          <Badge tone="neutral">{TYPE_LABEL[row.type] ?? row.type}</Badge>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.keyword}</span>
          <span className="flex-none tabular-nums text-xs text-ink-3">{row.count}장</span>
          <span className="flex-none tabular-nums text-xs text-ink-3">{row.ts.slice(0, 10)}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: 허브 페이지**

`src/app/page.tsx` 전체 교체:

```tsx
import { ContiMark } from "@/components/ui";
import { readRecent } from "@/lib/ledger";
import { FlowCard } from "@/features/hub/FlowCard";
import { RecentList } from "@/features/hub/RecentList";

const CARDNEWS_PREVIEW = (
  <svg width="120" height="76" viewBox="0 0 120 76" fill="none" aria-hidden="true">
    <rect x="4" y="12" width="36" height="52" rx="4" className="fill-hair" />
    <rect x="26" y="8" width="36" height="60" rx="4" className="fill-hair" />
    <rect x="50" y="4" width="40" height="68" rx="4" className="fill-plum/20" />
    <rect x="56" y="10" width="28" height="34" rx="2" className="fill-plum" />
    <rect x="56" y="50" width="28" height="4" rx="2" className="fill-plum/50" />
    <rect x="56" y="58" width="18" height="4" rx="2" className="fill-plum/30" />
  </svg>
);

const INFO_PREVIEW = (
  <svg width="120" height="76" viewBox="0 0 120 76" fill="none" aria-hidden="true">
    <rect x="38" y="4" width="44" height="68" rx="4" className="fill-plum/20" />
    <rect x="44" y="10" width="32" height="20" rx="2" className="fill-plum" />
    <circle cx="48" cy="40" r="3.5" className="fill-plum/60" />
    <rect x="55" y="38" width="21" height="4" rx="2" className="fill-plum/40" />
    <circle cx="48" cy="52" r="3.5" className="fill-plum/60" />
    <rect x="55" y="50" width="21" height="4" rx="2" className="fill-plum/40" />
    <circle cx="48" cy="64" r="3.5" className="fill-plum/60" />
    <rect x="55" y="62" width="14" height="4" rx="2" className="fill-plum/40" />
  </svg>
);

export default async function HubPage() {
  const recent = await readRecent(5);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[880px] flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-plum">
          <ContiMark size={22} />
          <span className="text-sm font-extrabold tracking-tight text-ink">콘티</span>
        </div>
        <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">무엇을 만들까요?</h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          직접 작업한 사진 폴더를 올리면 순서를 정하고 카피를 붙여 인스타 카드로 뽑아 드려요.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <FlowCard
          href="/cardnews"
          title="카드뉴스"
          description="사진 5~6장으로 넘겨 보는 설득 시퀀스를 만들어요."
          steps={5}
          outputPath="cardnews/"
          preview={CARDNEWS_PREVIEW}
        />
        <FlowCard
          href="/info"
          title="정보전달"
          description="사진 1장에 정보를 얹은 인포그래픽 한 장을 만들어요."
          steps={4}
          outputPath="informationsend/"
          preview={INFO_PREVIEW}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">최근 만든 것</h2>
        <RecentList rows={recent} />
      </section>
    </main>
  );
}
```

- [ ] **Step 4: 브라우저 확인**

Run: `npm run dev` 후 http://localhost:3500 접속
Expected: 두 플로우 카드가 보이고, `knowledge/ledger.jsonl` 에 기록이 있으면 최근 목록에 뜬다. 콘솔 에러 0.

- [ ] **Step 5: 커밋**

```bash
git add src/app/page.tsx src/features/hub
git commit -m "feat: 두 플로우 진입과 최근 이력을 보여주는 허브 화면"
```

---

## Task 15: 사진 처리 공용 (DOM) + 드롭존 + 그리드

**Files:**
- Create: `src/lib/photos-client.ts` · `src/features/photos/Dropzone.tsx` · `src/features/photos/PhotoGrid.tsx`

**Interfaces:**
- Consumes: `Photo`·`downscaleSize`·`isFourFive`·`compareFileNames`·`THUMB_MAX` (Task 2) · `Badge`·`Button` (Task 12)
- Produces:
  - `filesToPhotos(files: FileList | File[]): Promise<Photo[]>` — 파일명 순 정렬 후 변환
  - `<Dropzone onPhotos={(photos: Photo[]) => void} onError={(msg: string) => void} hint={string} />`
  - `<PhotoGrid photos={Photo[]} selectedIds={string[]} onToggle={(id: string) => void} />` — 그리드는
    `onToggle` 의 의미를 모른다(카드뉴스=빼기, 정보전달=대표 고르기). `mode` prop 을 두지 않는다.

- [ ] **Step 1: File → Photo 변환**

`src/lib/photos-client.ts`:

```ts
import { compareFileNames, downscaleSize, THUMB_MAX, type Photo } from "@/lib/photos";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${file.name} 을 읽지 못했습니다`));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 해석하지 못했습니다"));
    img.src = dataUrl;
  });
}

function toThumb(img: HTMLImageElement): string {
  const size = downscaleSize(img.naturalWidth, img.naturalHeight, THUMB_MAX);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들지 못했습니다");
  ctx.drawImage(img, 0, 0, size.width, size.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function fileToPhoto(file: File): Promise<Photo> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  return {
    id: `${file.name}:${file.size}:${file.lastModified}`,
    name: file.name,
    dataUrl,
    thumbUrl: toThumb(img),
    width: img.naturalWidth,
    height: img.naturalHeight,
    bytes: file.size,
  };
}

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

/** 폴더에서 온 파일은 순서가 보장되지 않으므로 파일명 자연 정렬로 순서를 정한다. */
export async function filesToPhotos(files: FileList | File[]): Promise<Photo[]> {
  const list = Array.from(files)
    .filter((f) => IMAGE_RE.test(f.name))
    .sort((a, b) => compareFileNames(a.name, b.name));
  return Promise.all(list.map(fileToPhoto));
}
```

- [ ] **Step 2: 드롭존**

`src/features/photos/Dropzone.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { FolderOpen, ImageUp } from "lucide-react";
import { Button } from "@/components/ui";
import { filesToPhotos } from "@/lib/photos-client";
import type { Photo } from "@/lib/photos";

export function Dropzone({
  onPhotos,
  onError,
  hint,
}: {
  onPhotos: (photos: Photo[]) => void;
  onError: (message: string) => void;
  hint: string;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ingest(files: FileList | File[]) {
    setBusy(true);
    try {
      const photos = await filesToPhotos(files);
      if (photos.length === 0) {
        onError("이미지 파일(jpg·png·webp)이 없어요.");
        return;
      }
      onPhotos(photos);
    } catch (e) {
      onError(e instanceof Error ? e.message : "사진을 읽지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void ingest(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-14 transition-colors duration-200 motion-reduce:transition-none ${
        over ? "border-plum bg-plum-soft" : "border-hair bg-surface"
      }`}
    >
      <span className="text-ink-3">
        <ImageUp size={30} aria-hidden="true" />
      </span>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[15px] font-semibold">{busy ? "사진을 읽는 중이에요…" : "사진 폴더를 여기에 끌어다 놓으세요"}</p>
        <p className="text-sm text-ink-2">{hint}</p>
      </div>
      <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
        <FolderOpen size={15} aria-hidden="true" />
        폴더 선택
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        // 폴더 통째 선택 — React 타입에 없는 비표준 속성이라 문자열로 넘긴다
        {...{ webkitdirectory: "" }}
        // sr-only 라 포커스 링을 보여 줄 수 없으므로 탭 순서에서 뺀다.
        // 같은 동작은 위의 "폴더 선택" 버튼이 접근 가능하게 제공한다.
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) void ingest(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
```

**주의:** `webkitdirectory` 는 React의 `InputHTMLAttributes` 에 없다. 위처럼 스프레드로 넘기면 타입 에러 없이 DOM 속성으로 전달된다. `npx tsc --noEmit` 으로 확인한다.

- [ ] **Step 3: 사진 그리드**

`src/features/photos/PhotoGrid.tsx`:

```tsx
"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui";
import { isFourFive, type Photo } from "@/lib/photos";

function sizeLabel(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function PhotoGrid({
  photos,
  selectedIds,
  onToggle,
}: {
  photos: readonly Photo[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {photos.map((photo) => {
        const on = selectedIds.includes(photo.id);
        const ratioOk = isFourFive(photo.width, photo.height);
        return (
          <li key={photo.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(photo.id)}
              className={`group relative block w-full overflow-hidden rounded-lg border-2 bg-hair-soft transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
                on ? "border-plum" : "border-transparent hover:border-hair"
              }`}
            >
              <span className="block aspect-[4/5] w-full">
                {/* 로컬 dataURL 프리뷰 — next/image는 dataURL을 최적화할 수 없다 */}
                <img src={photo.thumbUrl} alt={photo.name} className="h-full w-full object-cover" />
              </span>
              {on && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-plum text-white">
                  <Check size={13} strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </button>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-2">{photo.name}</span>
              <span className="flex-none tabular-nums text-[11px] text-ink-3">{sizeLabel(photo.bytes)}</span>
            </div>
            {!ratioOk && (
              <div className="mt-1">
                <Badge tone="warn">4:5 아님 · 잘려요</Badge>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: 타입 확인 후 커밋**

Run: `npx tsc --noEmit`
Expected: `studio.tsx` 외 에러 없음

```bash
git add src/lib/photos-client.ts src/features/photos
git commit -m "feat: 폴더 드롭·폴더 선택 드롭존과 사진 그리드 추가"
```

---

## Task 16: 카드뉴스 reducer

**Files:**
- Create: `src/features/cardnews/reducer.ts`
- Test: `src/features/cardnews/reducer.test.ts`

**Interfaces:**
- Consumes: `Photo` (Task 2) · `move` (Task 3) · `CardLayout`·`assignLayouts` (Task 4) · `Focal`·`DEFAULT_FOCAL`·`DEFAULT_SCRIM`·`DEFAULT_BAND_CARDNEWS` (Task 8) · `CardnewsSpec`·`CardnewsCard` (기존 schema)
- Produces:
  - `CARDNEWS_MIN = 5` · `CARDNEWS_MAX = 6`
  - `type CardDraft = { id: string; photoId: string; layout: CardLayout; focal: Focal; scrim: number; band: number; copy: CardnewsCard }`
  - `type CardnewsState` · `type CardnewsAction`
  - `initialCardnewsState: CardnewsState`
  - `cardnewsReducer(state, action): CardnewsState`
  - `slotPhotos(state): Photo[]` · `trayPhotos(state): Photo[]` · `canLeaveOrder(state): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/cardnews/reducer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  cardnewsReducer,
  initialCardnewsState,
  slotPhotos,
  trayPhotos,
  canLeaveOrder,
  CARDNEWS_MAX,
  type CardnewsState,
} from "@/features/cardnews/reducer";
import type { Photo } from "@/lib/photos";

function photo(id: string): Photo {
  return { id, name: `${id}.jpg`, dataUrl: "data:image/jpeg;base64,AAA", thumbUrl: "data:image/jpeg;base64,AAA", width: 1080, height: 1350, bytes: 1000 };
}

function withPhotos(count: number): CardnewsState {
  const photos = Array.from({ length: count }, (_, i) => photo(`p${i + 1}`));
  return cardnewsReducer(initialCardnewsState, { type: "ADD_PHOTOS", photos });
}

describe("ADD_PHOTOS", () => {
  it("정원까지만 슬롯에 채운다", () => {
    const s = withPhotos(8);
    expect(s.order).toHaveLength(CARDNEWS_MAX);
    expect(s.photos).toHaveLength(8);
  });
  it("나머지는 트레이에 남는다", () => {
    const s = withPhotos(8);
    expect(trayPhotos(s).map((p) => p.id)).toEqual(["p7", "p8"]);
  });
  it("정원보다 적으면 전부 슬롯에 들어간다", () => {
    expect(withPhotos(3).order).toEqual(["p1", "p2", "p3"]);
  });
  it("같은 사진을 다시 넣어도 중복되지 않는다", () => {
    const s = cardnewsReducer(withPhotos(2), { type: "ADD_PHOTOS", photos: [photo("p1")] });
    expect(s.photos).toHaveLength(2);
  });
});

describe("canLeaveOrder", () => {
  it("5장 미만이면 못 넘어간다", () => {
    expect(canLeaveOrder(withPhotos(4))).toBe(false);
  });
  it("5장이면 넘어간다", () => {
    expect(canLeaveOrder(withPhotos(5))).toBe(true);
  });
});

describe("REORDER", () => {
  it("슬롯 순서를 바꾼다", () => {
    const s = cardnewsReducer(withPhotos(5), { type: "REORDER", from: 0, to: 2 });
    expect(s.order).toEqual(["p2", "p3", "p1", "p4", "p5"]);
  });
});

describe("SWAP_IN", () => {
  it("트레이 사진을 슬롯 자리와 맞바꾼다", () => {
    const s = cardnewsReducer(withPhotos(8), { type: "SWAP_IN", slotIndex: 0, photoId: "p7" });
    expect(s.order[0]).toBe("p7");
    expect(trayPhotos(s).map((p) => p.id)).toContain("p1");
  });
  it("이미 슬롯에 있는 사진이면 아무 일도 없다", () => {
    const before = withPhotos(8);
    const after = cardnewsReducer(before, { type: "SWAP_IN", slotIndex: 0, photoId: "p2" });
    expect(after.order).toEqual(before.order);
  });
});

describe("REMOVE_PHOTO", () => {
  it("슬롯에서 빼면 트레이의 다음 사진이 자동으로 들어오지 않는다", () => {
    const s = cardnewsReducer(withPhotos(8), { type: "REMOVE_PHOTO", photoId: "p1" });
    expect(s.order).not.toContain("p1");
    expect(s.order).toHaveLength(CARDNEWS_MAX - 1);
    expect(s.photos.map((p) => p.id)).not.toContain("p1");
  });
});

describe("SET_SPEC", () => {
  const spec = {
    type: "cardnews" as const,
    keyword: "에어컨",
    cards: [
      { role: "hook" as const, heading: "표지" },
      { role: "problem" as const, heading: "문제", body: "본문" },
      { role: "evidence" as const, heading: "근거", body: "본문" },
      { role: "solution" as const, heading: "해결", body: "본문" },
      { role: "cta" as const, heading: "마무리", action: "저장하기" },
    ],
  };

  it("카드 수만큼 draft를 만들고 레이아웃을 배정한다", () => {
    const s = cardnewsReducer(withPhotos(5), { type: "SET_SPEC", spec });
    expect(s.cards.map((c) => c.layout)).toEqual(["full-bleed", "split", "split", "split", "text-only"]);
  });
  it("슬롯 순서대로 사진을 붙인다", () => {
    const s = cardnewsReducer(withPhotos(5), { type: "SET_SPEC", spec });
    expect(s.cards.map((c) => c.photoId)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });
});

describe("UPDATE_CARD", () => {
  it("한 장만 바꾸고 나머지는 그대로 둔다", () => {
    const base = cardnewsReducer(withPhotos(5), {
      type: "SET_SPEC",
      spec: {
        type: "cardnews",
        keyword: "k",
        cards: [
          { role: "hook", heading: "표지" },
          { role: "problem", heading: "문제", body: "b" },
          { role: "evidence", heading: "근거", body: "b" },
          { role: "solution", heading: "해결", body: "b" },
          { role: "cta", heading: "마무리", action: "저장" },
        ],
      },
    });
    const next = cardnewsReducer(base, { type: "UPDATE_CARD", index: 1, patch: { layout: "text-only" } });
    expect(next.cards[1].layout).toBe("text-only");
    expect(next.cards[0]).toBe(base.cards[0]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/features/cardnews/reducer.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/cardnews/reducer"`

- [ ] **Step 3: 구현**

`src/features/cardnews/reducer.ts`:

```ts
import type { CardnewsCard, CardnewsSpec } from "@/lib/schema";
import type { Photo } from "@/lib/photos";
import { move } from "@/lib/reorder";
import { assignLayouts, type CardLayout } from "@/lib/layout-assign";
import { DEFAULT_BAND_CARDNEWS, DEFAULT_FOCAL, DEFAULT_SCRIM, type Focal } from "@/templates/layout-utils";
import type { ThemeId } from "@/templates/themes";

export const CARDNEWS_MIN = 5;
export const CARDNEWS_MAX = 6;

export type CardDraft = {
  id: string;
  photoId: string;
  layout: CardLayout;
  focal: Focal;
  scrim: number;
  band: number;
  copy: CardnewsCard;
};

export type CardnewsState = {
  step: number;
  maxReached: number;
  photos: Photo[];
  /** 슬롯에 든 photoId — 순서 그 자체 */
  order: string[];
  keyword: string;
  themeId: ThemeId;
  handle: string;
  cards: CardDraft[];
  error: string | null;
  busy: boolean;
};

export type CardnewsAction =
  | { type: "ADD_PHOTOS"; photos: Photo[] }
  | { type: "REMOVE_PHOTO"; photoId: string }
  | { type: "REORDER"; from: number; to: number }
  | { type: "SWAP_IN"; slotIndex: number; photoId: string }
  | { type: "SET_KEYWORD"; keyword: string }
  | { type: "SET_THEME"; themeId: ThemeId }
  | { type: "SET_HANDLE"; handle: string }
  | { type: "SET_SPEC"; spec: CardnewsSpec }
  | { type: "UPDATE_CARD"; index: number; patch: Partial<Omit<CardDraft, "id">> }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_BUSY"; busy: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

export const initialCardnewsState: CardnewsState = {
  step: 1,
  maxReached: 1,
  photos: [],
  order: [],
  keyword: "",
  themeId: "mint-clean",
  handle: "",
  cards: [],
  error: null,
  busy: false,
};

export function slotPhotos(state: CardnewsState): Photo[] {
  return state.order
    .map((id) => state.photos.find((p) => p.id === id))
    .filter((p): p is Photo => p !== undefined);
}

export function trayPhotos(state: CardnewsState): Photo[] {
  return state.photos.filter((p) => !state.order.includes(p.id));
}

export function canLeaveOrder(state: CardnewsState): boolean {
  return state.order.length >= CARDNEWS_MIN && state.order.length <= CARDNEWS_MAX;
}

/**
 * 단계가 많은 solution 카드는 글이 길어 기본 밴드(0.45)로도 글 영역이 모자란다.
 * 스키마 상한(헤드라인 40자·본문 120자·단계 5개)에 word-break:keep-all 이 겹치면 784px 이 필요한데
 * 0.45 의 가용 높이는 574px 이라 잘린다. 사진을 줄여 자리를 만든다 — 0.3 이면 가용 777px.
 */
export function bandFor(copy: CardnewsCard): number {
  const steps = "steps" in copy ? (copy.steps?.length ?? 0) : 0;
  return steps >= 4 ? 0.3 : DEFAULT_BAND_CARDNEWS;
}

export function cardnewsReducer(state: CardnewsState, action: CardnewsAction): CardnewsState {
  switch (action.type) {
    case "ADD_PHOTOS": {
      const known = new Set(state.photos.map((p) => p.id));
      const added = action.photos.filter((p) => !known.has(p.id));
      const photos = [...state.photos, ...added];
      const room = CARDNEWS_MAX - state.order.length;
      const order = [...state.order, ...added.slice(0, Math.max(0, room)).map((p) => p.id)];
      return { ...state, photos, order, error: null };
    }
    case "REMOVE_PHOTO":
      return {
        ...state,
        photos: state.photos.filter((p) => p.id !== action.photoId),
        order: state.order.filter((id) => id !== action.photoId),
      };
    case "REORDER":
      return { ...state, order: move(state.order, action.from, action.to) };
    case "SWAP_IN": {
      if (state.order.includes(action.photoId)) return state;
      if (action.slotIndex < 0 || action.slotIndex >= state.order.length) return state;
      const order = [...state.order];
      order[action.slotIndex] = action.photoId;
      return { ...state, order };
    }
    case "SET_KEYWORD":
      return { ...state, keyword: action.keyword };
    case "SET_THEME":
      return { ...state, themeId: action.themeId };
    case "SET_HANDLE":
      return { ...state, handle: action.handle };
    case "SET_SPEC": {
      const layouts = assignLayouts(action.spec.cards.length);
      const cards: CardDraft[] = action.spec.cards.map((copy, i) => ({
        id: `card-${i + 1}`,
        // 사진보다 카드가 많으면(사진 5장 + 카드 6장은 스키마상 가능) 남는 카드는 사진 없이 둔다.
        // 마지막 사진을 재사용하면 같은 사진이 두 카드에 나온다 — 마지막 카드는 어차피 text-only 다.
        photoId: state.order[i] ?? "",
        layout: layouts[i],
        focal: DEFAULT_FOCAL,
        scrim: DEFAULT_SCRIM,
        band: bandFor(copy),
        copy,
      }));
      return { ...state, cards, error: null };
    }
    case "UPDATE_CARD":
      return {
        ...state,
        cards: state.cards.map((c, i) => (i === action.index ? { ...c, ...action.patch } : c)),
      };
    case "SET_STEP":
      return { ...state, step: action.step, maxReached: Math.max(state.maxReached, action.step) };
    case "SET_BUSY":
      return { ...state, busy: action.busy };
    case "SET_ERROR":
      return { ...state, error: action.error, busy: false };
    case "RESET":
      return initialCardnewsState;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/features/cardnews/reducer.test.ts`
Expected: PASS — 12 tests

- [ ] **Step 5: 커밋**

```bash
git add src/features/cardnews/reducer.ts src/features/cardnews/reducer.test.ts
git commit -m "feat: 카드뉴스 상태 reducer (정원 5~6·슬롯/트레이·레이아웃 배정)"
```

---

## Task 17: 정보전달 reducer

**Files:**
- Create: `src/features/infosend/reducer.ts`
- Test: `src/features/infosend/reducer.test.ts`

**Interfaces:**
- Consumes: `Photo` (Task 2) · `move` (Task 3) · `Focal`·`DEFAULT_FOCAL`·`DEFAULT_BAND_INFO` (Task 8) · `InfographicSpec` (기존 schema)
- Produces:
  - `ITEMS_MIN = 3` · `ITEMS_MAX = 6`
  - `type InfoState` · `type InfoAction`
  - `initialInfoState: InfoState`
  - `infoReducer(state, action): InfoState`
  - `selectedPhoto(state): Photo | null` · `canLeavePhoto(state): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/infosend/reducer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  infoReducer,
  initialInfoState,
  selectedPhoto,
  canLeavePhoto,
  ITEMS_MIN,
  ITEMS_MAX,
  type InfoState,
} from "@/features/infosend/reducer";
import type { Photo } from "@/lib/photos";

function photo(id: string): Photo {
  return { id, name: `${id}.jpg`, dataUrl: "data:image/jpeg;base64,AAA", thumbUrl: "data:image/jpeg;base64,AAA", width: 1080, height: 1350, bytes: 1000 };
}

function withPhotos(count: number): InfoState {
  const photos = Array.from({ length: count }, (_, i) => photo(`p${i + 1}`));
  return infoReducer(initialInfoState, { type: "ADD_PHOTOS", photos });
}

const spec = {
  type: "informationsend" as const,
  title: "에어컨 전기세",
  items: [
    { keyword: "온도", desc: "24~26도" },
    { keyword: "필터", desc: "2주마다" },
    { keyword: "선풍기", desc: "함께 켜기" },
  ],
};

describe("ADD_PHOTOS", () => {
  it("첫 사진을 대표로 자동 선택한다", () => {
    expect(withPhotos(3).selectedPhotoId).toBe("p1");
  });
  it("이미 고른 게 있으면 유지한다", () => {
    const s = infoReducer(withPhotos(2), { type: "ADD_PHOTOS", photos: [photo("p9")] });
    expect(s.selectedPhotoId).toBe("p1");
  });
});

describe("SELECT_PHOTO", () => {
  it("대표를 바꾼다", () => {
    const s = infoReducer(withPhotos(3), { type: "SELECT_PHOTO", photoId: "p3" });
    expect(selectedPhoto(s)?.id).toBe("p3");
  });
});

describe("canLeavePhoto", () => {
  it("사진이 없으면 못 넘어간다", () => {
    expect(canLeavePhoto(initialInfoState)).toBe(false);
  });
  it("대표를 골랐으면 넘어간다", () => {
    expect(canLeavePhoto(withPhotos(1))).toBe(true);
  });
});

describe("items 편집", () => {
  const base = infoReducer(withPhotos(1), { type: "SET_SPEC", spec });

  it("항목 순서를 바꾼다", () => {
    const s = infoReducer(base, { type: "REORDER_ITEM", from: 0, to: 2 });
    expect(s.spec?.items.map((i) => i.keyword)).toEqual(["필터", "선풍기", "온도"]);
  });

  it("항목을 추가한다", () => {
    const s = infoReducer(base, { type: "ADD_ITEM" });
    expect(s.spec?.items).toHaveLength(4);
  });

  it("최대치를 넘겨 추가하지 않는다", () => {
    let s = base;
    for (let i = 0; i < 10; i++) s = infoReducer(s, { type: "ADD_ITEM" });
    expect(s.spec?.items).toHaveLength(ITEMS_MAX);
  });

  it("항목을 지운다", () => {
    const s = infoReducer(infoReducer(base, { type: "ADD_ITEM" }), { type: "REMOVE_ITEM", index: 0 });
    expect(s.spec?.items).toHaveLength(3);
  });

  it("최소치 아래로는 지우지 않는다", () => {
    const s = infoReducer(base, { type: "REMOVE_ITEM", index: 0 });
    expect(s.spec?.items).toHaveLength(ITEMS_MIN);
  });

  it("항목 내용을 고친다", () => {
    const s = infoReducer(base, { type: "UPDATE_ITEM", index: 0, patch: { desc: "25도" } });
    expect(s.spec?.items[0].desc).toBe("25도");
    expect(s.spec?.items[0].keyword).toBe("온도");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/features/infosend/reducer.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/infosend/reducer"`

- [ ] **Step 3: 구현**

`src/features/infosend/reducer.ts`:

```ts
import type { InfographicSpec } from "@/lib/schema";
import type { Photo } from "@/lib/photos";
import { move } from "@/lib/reorder";
import { DEFAULT_BAND_INFO, DEFAULT_FOCAL, type Focal } from "@/templates/layout-utils";
import type { ThemeId } from "@/templates/themes";

export const ITEMS_MIN = 3;
export const ITEMS_MAX = 6;

type Item = InfographicSpec["items"][number];

export type InfoState = {
  step: number;
  maxReached: number;
  photos: Photo[];
  selectedPhotoId: string | null;
  keyword: string;
  themeId: ThemeId;
  handle: string;
  band: number;
  focal: Focal;
  spec: InfographicSpec | null;
  error: string | null;
  busy: boolean;
};

export type InfoAction =
  | { type: "ADD_PHOTOS"; photos: Photo[] }
  | { type: "SELECT_PHOTO"; photoId: string }
  | { type: "SET_KEYWORD"; keyword: string }
  | { type: "SET_THEME"; themeId: ThemeId }
  | { type: "SET_HANDLE"; handle: string }
  | { type: "SET_BAND"; band: number }
  | { type: "SET_FOCAL"; focal: Focal }
  | { type: "SET_SPEC"; spec: InfographicSpec }
  | { type: "UPDATE_SPEC"; patch: Partial<Pick<InfographicSpec, "title" | "subtitle" | "tip">> }
  | { type: "UPDATE_ITEM"; index: number; patch: Partial<Item> }
  | { type: "ADD_ITEM" }
  | { type: "REMOVE_ITEM"; index: number }
  | { type: "REORDER_ITEM"; from: number; to: number }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_BUSY"; busy: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

export const initialInfoState: InfoState = {
  step: 1,
  maxReached: 1,
  photos: [],
  selectedPhotoId: null,
  keyword: "",
  themeId: "mint-clean",
  handle: "",
  band: DEFAULT_BAND_INFO,
  focal: DEFAULT_FOCAL,
  spec: null,
  error: null,
  busy: false,
};

export function selectedPhoto(state: InfoState): Photo | null {
  return state.photos.find((p) => p.id === state.selectedPhotoId) ?? null;
}

export function canLeavePhoto(state: InfoState): boolean {
  return selectedPhoto(state) !== null;
}

function withItems(state: InfoState, next: Item[]): InfoState {
  if (!state.spec) return state;
  return { ...state, spec: { ...state.spec, items: next } };
}

export function infoReducer(state: InfoState, action: InfoAction): InfoState {
  switch (action.type) {
    case "ADD_PHOTOS": {
      const known = new Set(state.photos.map((p) => p.id));
      const added = action.photos.filter((p) => !known.has(p.id));
      const photos = [...state.photos, ...added];
      return {
        ...state,
        photos,
        selectedPhotoId: state.selectedPhotoId ?? photos[0]?.id ?? null,
        error: null,
      };
    }
    case "SELECT_PHOTO":
      return { ...state, selectedPhotoId: action.photoId };
    case "SET_KEYWORD":
      return { ...state, keyword: action.keyword };
    case "SET_THEME":
      return { ...state, themeId: action.themeId };
    case "SET_HANDLE":
      return { ...state, handle: action.handle };
    case "SET_BAND":
      return { ...state, band: action.band };
    case "SET_FOCAL":
      return { ...state, focal: action.focal };
    case "SET_SPEC":
      return { ...state, spec: action.spec, error: null };
    case "UPDATE_SPEC":
      return state.spec ? { ...state, spec: { ...state.spec, ...action.patch } } : state;
    case "UPDATE_ITEM":
      return state.spec
        ? withItems(
            state,
            state.spec.items.map((it, i) => (i === action.index ? { ...it, ...action.patch } : it)),
          )
        : state;
    case "ADD_ITEM":
      if (!state.spec || state.spec.items.length >= ITEMS_MAX) return state;
      return withItems(state, [...state.spec.items, { keyword: "새 항목", desc: "설명을 적어 주세요" }]);
    case "REMOVE_ITEM":
      if (!state.spec || state.spec.items.length <= ITEMS_MIN) return state;
      return withItems(
        state,
        state.spec.items.filter((_, i) => i !== action.index),
      );
    case "REORDER_ITEM":
      return state.spec ? withItems(state, move(state.spec.items, action.from, action.to)) : state;
    case "SET_STEP":
      return { ...state, step: action.step, maxReached: Math.max(state.maxReached, action.step) };
    case "SET_BUSY":
      return { ...state, busy: action.busy };
    case "SET_ERROR":
      return { ...state, error: action.error, busy: false };
    case "RESET":
      return initialInfoState;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/features/infosend/reducer.test.ts`
Expected: PASS — 12 tests

- [ ] **Step 5: 전체 테스트 확인 후 커밋**

Run: `npm test`
Expected: 기존 6 + 신규 7 파일 전부 통과

```bash
git add src/features/infosend/reducer.ts src/features/infosend/reducer.test.ts
git commit -m "feat: 정보전달 상태 reducer (대표 사진·항목 3~6 편집)"
```

---

## Task 18: 생성·내보내기 공용 훅

**Files:**
- Create: `src/features/studio/useGenerate.ts` · `src/features/studio/useExport.ts` · `src/features/studio/CaptureStage.tsx`

**Interfaces:**
- Consumes: `RenderCard` (Task 11) · `exportNodeToPng`·`downloadBlob`·`blobToBase64` (기존 `lib/export.ts`) · `slugify` (기존 `lib/paths.ts`)
- Produces:
  - `requestSpec<T>(args: { type: "cardnews" | "informationsend"; keyword: string; photos: string[] }): Promise<T>` — 실패 시 `Error` 던짐
  - `mmdd(): string`
  - `useExport()` → `{ registerRef, download, saveToFolder }` — `capture` 는 내부 헬퍼로만 두고
    노출하지 않는다. 스텝 화면은 `download`/`saveToFolder` 만 부르면 된다.
  - `<CaptureStage cards={RenderCard[]} themeId handle registerRef />` — 화면 밖 1080×1350 원본 렌더

- [ ] **Step 1: 생성 호출 래퍼**

`src/features/studio/useGenerate.ts`:

```ts
export async function requestSpec<T>(args: {
  type: "cardnews" | "informationsend";
  keyword: string;
  photos: string[];
}): Promise<T> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "카피 생성에 실패했어요");
  return data.spec as T;
}

export function mmdd(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
```

- [ ] **Step 2: 캡처 스테이지**

`src/features/studio/CaptureStage.tsx` — 화면 밖에 transform 없는 원본을 렌더한다. 축소 미리보기에서 캡처하면 해상도가 깨지므로 캡처 전용 노드를 따로 둔다:

```tsx
"use client";

import { CardRenderer, type RenderCard } from "@/templates/CardRenderer";
import type { ThemeId } from "@/templates/themes";

export function CaptureStage({
  cards,
  themeId,
  handle,
  registerRef,
}: {
  cards: readonly RenderCard[];
  themeId: ThemeId;
  handle: string;
  registerRef: (index: number, node: HTMLDivElement | null) => void;
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed left-[-100000px] top-0 opacity-0">
      {cards.map((card, i) => (
        <div
          key={card.badge + i}
          ref={(node) => {
            registerRef(i, node);
          }}
        >
          <CardRenderer card={card} themeId={themeId} handle={handle} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 내보내기 훅**

`src/features/studio/useExport.ts`:

```ts
import { useCallback, useRef } from "react";
import { blobToBase64, downloadBlob, exportNodeToPng } from "@/lib/export";
import { slugify } from "@/lib/paths";
import { mmdd } from "./useGenerate";

export function useExport() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  const registerRef = useCallback((index: number, node: HTMLDivElement | null) => {
    refs.current[index] = node;
  }, []);

  const capture = useCallback(async (count: number): Promise<Blob[]> => {
    const blobs: Blob[] = [];
    for (let i = 0; i < count; i++) {
      const node = refs.current[i];
      if (!node) throw new Error(`${i + 1}번 카드를 캡처하지 못했어요. 다시 시도해 주세요.`);
      blobs.push(await exportNodeToPng(node));
    }
    return blobs;
  }, []);

  const download = useCallback(
    async (count: number, keyword: string) => {
      const blobs = await capture(count);
      const slug = slugify(keyword) || "card";
      blobs.forEach((b, i) => downloadBlob(b, `${slug}-${i + 1}.png`));
    },
    [capture],
  );

  const saveToFolder = useCallback(
    async (args: {
      count: number;
      keyword: string;
      type: "cardnews" | "informationsend";
      templateIds: string[];
    }): Promise<{ dir: string; paths: string[] }> => {
      const blobs = await capture(args.count);
      const images = await Promise.all(blobs.map(blobToBase64));
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: args.type,
          keyword: args.keyword,
          mmdd: mmdd(),
          images,
          templateIds: args.templateIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "저장에 실패했어요");
      return data;
    },
    [capture],
  );

  return { registerRef, download, saveToFolder };
}
```

- [ ] **Step 4: 타입 확인 후 커밋**

Run: `npx tsc --noEmit`
Expected: `studio.tsx` 외 에러 없음

```bash
git add src/features/studio
git commit -m "feat: 카피 생성 호출과 PNG 캡처·저장 공용 훅"
```

---

## Task 19: 카드뉴스 1·2 스텝 (사진 · 순서)

**Files:**
- Create: `src/features/cardnews/steps/PhotosStep.tsx` · `OrderStep.tsx` · `src/features/cardnews/parts/SortableSlot.tsx`
- Modify: `package.json` (@dnd-kit 설치)

**Interfaces:**
- Consumes: `Dropzone`·`PhotoGrid` (Task 15) · `cardnewsReducer` 액션 (Task 16)
- Produces: `<PhotosStep state dispatch />` · `<OrderStep state dispatch />`

- [ ] **Step 1: dnd-kit 설치**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: 사진 스텝**

`src/features/cardnews/steps/PhotosStep.tsx`:

```tsx
"use client";

import { Dropzone } from "@/features/photos/Dropzone";
import { PhotoGrid } from "@/features/photos/PhotoGrid";
import { CARDNEWS_MAX, CARDNEWS_MIN, type CardnewsAction, type CardnewsState } from "../reducer";

export function PhotosStep({
  state,
  dispatch,
}: {
  state: CardnewsState;
  dispatch: React.Dispatch<CardnewsAction>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <Dropzone
        hint={`카드뉴스는 사진 ${CARDNEWS_MIN}~${CARDNEWS_MAX}장으로 만들어요. 더 올려도 되고, 다음 단계에서 골라요.`}
        onPhotos={(photos) => dispatch({ type: "ADD_PHOTOS", photos })}
        onError={(error) => dispatch({ type: "SET_ERROR", error })}
      />

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      {state.photos.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              올린 사진 <span className="tabular-nums text-ink-3">{state.photos.length}장</span>
            </h2>
            <p className="text-xs text-ink-3">누르면 빼요</p>
          </div>
          <PhotoGrid
            photos={state.photos}
            selectedIds={state.order}
            onToggle={(photoId) => dispatch({ type: "REMOVE_PHOTO", photoId })}
          />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 정렬 슬롯**

`src/features/cardnews/parts/SortableSlot.tsx`:

```tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Photo } from "@/lib/photos";

const ROLE_HINTS = ["표지", "본문", "본문", "본문", "본문", "마무리"];

export function SortableSlot({ photo, index, total }: { photo: Photo; index: number; total: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  });

  const hint = index === total - 1 ? "마무리" : (ROLE_HINTS[index] ?? "본문");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`w-[150px] flex-none ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="overflow-hidden rounded-lg border-2 border-hair bg-hair-soft">
        <span className="block aspect-[4/5] w-full">
          {/* 로컬 dataURL 프리뷰 — next/image는 dataURL을 최적화할 수 없다 */}
          <img src={photo.thumbUrl} alt={photo.name} className="h-full w-full object-cover" />
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${index + 1}번 사진 순서 바꾸기`}
          className="flex h-6 w-6 flex-none cursor-grab items-center justify-center rounded text-ink-3 hover:bg-hair-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum active:cursor-grabbing"
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
        <span className="flex-none tabular-nums text-[11px] font-semibold text-plum">{index + 1}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-3">{hint}</span>
      </div>
    </li>
  );
}
```

- [ ] **Step 4: 순서 스텝**

`src/features/cardnews/steps/OrderStep.tsx`:

```tsx
"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Panel } from "@/components/ui";
import { SortableSlot } from "../parts/SortableSlot";
import { slotPhotos, trayPhotos, type CardnewsAction, type CardnewsState } from "../reducer";

export function OrderStep({
  state,
  dispatch,
}: {
  state: CardnewsState;
  dispatch: React.Dispatch<CardnewsAction>;
}) {
  const slots = slotPhotos(state);
  const tray = trayPhotos(state);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = state.order.indexOf(String(active.id));
    const to = state.order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    dispatch({ type: "REORDER", from, to });
  }

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">카드 순서</h2>
          <p className="text-xs text-ink-3">손잡이를 끌거나, 포커스 후 Space → 화살표로 옮겨요</p>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          {/* 슬롯은 flex-wrap 으로 접히므로(6장이면 960px > 900px) 단일 행 전략이 아니라 rect 전략이다 */}
          <SortableContext items={state.order} strategy={rectSortingStrategy}>
            <ul className="flex flex-wrap gap-3">
              {slots.map((photo, i) => (
                <SortableSlot key={photo.id} photo={photo} index={i} total={slots.length} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </section>

      {tray.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            안 쓰는 사진 <span className="tabular-nums text-ink-3">{tray.length}장</span>
          </h2>
          <Panel className="p-3">
            <ul className="flex flex-wrap gap-2">
              {tray.map((photo) => (
                <li key={photo.id} className="w-[104px]">
                  <div className="overflow-hidden rounded-lg border border-hair bg-hair-soft">
                    <span className="block aspect-[4/5] w-full">
                      {/* 로컬 dataURL 프리뷰 — next/image는 dataURL을 최적화할 수 없다 */}
                      <img src={photo.thumbUrl} alt={photo.name} className="h-full w-full object-cover" />
                    </span>
                  </div>
                  <label className="mt-1.5 flex flex-col gap-1 text-[11px] text-ink-3">
                    <span className="truncate">{photo.name}</span>
                    <select
                      aria-label={`${photo.name} 을 넣을 자리`}
                      value=""
                      onChange={(e) => {
                        if (e.target.value === "") return;
                        dispatch({ type: "SWAP_IN", slotIndex: Number(e.target.value), photoId: photo.id });
                      }}
                      className="h-7 rounded border border-hair bg-surface px-1 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-plum"
                    >
                      <option value="">자리 바꾸기</option>
                      {slots.map((_, i) => (
                        <option key={i} value={i}>
                          {i + 1}번과 교체
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      )}
    </div>
  );
}
```

트레이 사진을 슬롯에 넣는 조작은 드래그가 아니라 `select` 로 둔다. 서로 다른 컨테이너 간 드래그는 `@dnd-kit` 설정이 크게 늘고 키보드 경로가 취약해지는데, 여기서는 셀렉트가 키보드로도 그대로 동작한다.

- [ ] **Step 5: 커밋**

```bash
git add package.json package-lock.json src/features/cardnews
git commit -m "feat: 카드뉴스 사진·순서 스텝 (dnd 리오더 + 미사용 트레이)"
```

---

## Task 20: 카드뉴스 3·4·5 스텝 (주제 · 편집 · 내보내기)

**Files:**
- Create: `src/features/cardnews/steps/TopicStep.tsx` · `ComposeStep.tsx` · `ExportStep.tsx`
- Create: `src/features/cardnews/parts/CardInspector.tsx`

**Interfaces:**
- Consumes: Task 16 reducer · Task 18 훅 · Task 11 `CardRenderer`·`RenderCard`
- Produces: `toRenderCards(state): RenderCard[]` (`src/features/cardnews/render.ts`)

- [ ] **Step 1: RenderCard 변환기**

`src/features/cardnews/render.ts`:

```ts
import type { RenderCard } from "@/templates/CardRenderer";
import type { CardnewsState } from "./reducer";

export function toRenderCards(state: CardnewsState): RenderCard[] {
  return state.cards.map((card, i) => ({
    layout: card.layout,
    photoUrl: state.photos.find((p) => p.id === card.photoId)?.dataUrl ?? null,
    focal: card.focal,
    scrim: card.scrim,
    band: card.band,
    badge: `${i + 1} / ${state.cards.length}`,
    copy: card.copy,
  }));
}
```

- [ ] **Step 2: 주제 스텝**

`src/features/cardnews/steps/TopicStep.tsx`:

```tsx
"use client";

import { Sparkles } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { THEMES, THEME_IDS } from "@/templates/themes";
import { slotPhotos, type CardnewsAction, type CardnewsState } from "../reducer";
import { requestSpec } from "@/features/studio/useGenerate";
import type { CardnewsSpec } from "@/lib/schema";

const INPUT =
  "h-11 w-full rounded-lg border border-hair bg-surface px-3.5 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

export function TopicStep({
  state,
  dispatch,
  onDone,
}: {
  state: CardnewsState;
  dispatch: React.Dispatch<CardnewsAction>;
  onDone: () => void;
}) {
  async function generate() {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      const spec = await requestSpec<CardnewsSpec>({
        type: "cardnews",
        keyword: state.keyword,
        photos: slotPhotos(state).map((p) => p.thumbUrl),
      });
      dispatch({ type: "SET_SPEC", spec });
      dispatch({ type: "SET_BUSY", busy: false });
      onDone();
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: e instanceof Error ? e.message : "카피 생성에 실패했어요" });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
      <Field label="키워드" htmlFor="keyword" hint="사진과 함께 Claude에게 전달돼요.">
        <input
          id="keyword"
          value={state.keyword}
          onChange={(e) => dispatch({ type: "SET_KEYWORD", keyword: e.target.value })}
          placeholder="예: 에어컨 전기세 절약"
          className={INPUT}
        />
      </Field>

      <Field label="워터마크" htmlFor="handle" hint="비워 두면 카드에 아무것도 찍히지 않아요.">
        <input
          id="handle"
          value={state.handle}
          onChange={(e) => dispatch({ type: "SET_HANDLE", handle: e.target.value })}
          placeholder="@계정명"
          className={INPUT}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-ink-2">테마</legend>
        <div className="flex gap-2">
          {THEME_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={state.themeId === id}
              onClick={() => dispatch({ type: "SET_THEME", themeId: id })}
              className={`flex-1 rounded-lg border-2 px-2 py-3 text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
                state.themeId === id ? "border-plum" : "border-hair"
              }`}
              style={{
                // 테마 색은 런타임 데이터라 Tailwind 클래스로 표현할 수 없다 — themes.ts 값을 그대로 비춘다
                background: THEMES[id].bg,
                color: THEMES[id].fg,
              }}
            >
              {THEMES[id].label}
            </button>
          ))}
        </div>
      </fieldset>

      <Button variant="primary" onClick={generate} disabled={state.busy || state.keyword.trim().length === 0}>
        <Sparkles size={15} aria-hidden="true" />
        {state.busy ? "사진을 보고 쓰는 중이에요…" : "카피 생성"}
      </Button>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
```

테마 버튼의 `style` 은 테마 색이 런타임 데이터라 Tailwind 클래스로 표현할 수 없다 — 토큰 하드코딩이 아니라 `themes.ts` 값을 그대로 비추는 것이므로 허용한다.

- [ ] **Step 3: 인스펙터**

`src/features/cardnews/parts/CardInspector.tsx`:

```tsx
"use client";

import { Field, SegmentedControl } from "@/components/ui";
import { CARD_LAYOUTS, LAYOUT_LABELS, type CardLayout } from "@/lib/layout-assign";
import type { CardDraft } from "../reducer";

const INPUT =
  "w-full rounded-lg border border-hair bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={`tabular-nums text-[11px] ${value.length > max ? "text-danger" : "text-ink-3"}`}>
      {value.length}/{max}
    </span>
  );
}

export function CardInspector({
  card,
  index,
  onPatch,
}: {
  card: CardDraft;
  index: number;
  onPatch: (patch: Partial<Omit<CardDraft, "id">>) => void;
}) {
  const copy = card.copy;
  const heading = copy.heading;
  const body = "body" in copy ? copy.body : "";

  return (
    <div className="flex flex-col gap-5">
      <Field label="레이아웃" htmlFor={`layout-${index}`}>
        <div id={`layout-${index}`}>
          <SegmentedControl<CardLayout>
            ariaLabel="카드 레이아웃"
            options={CARD_LAYOUTS.map((id) => ({ value: id, label: LAYOUT_LABELS[id] }))}
            value={card.layout}
            onChange={(layout) => onPatch({ layout })}
          />
        </div>
      </Field>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor={`heading-${index}`} className="text-sm font-semibold text-ink-2">
            헤드라인
          </label>
          <Counter value={heading} max={40} />
        </div>
        <textarea
          id={`heading-${index}`}
          rows={2}
          value={heading}
          onChange={(e) => onPatch({ copy: { ...copy, heading: e.target.value } as CardDraft["copy"] })}
          className={INPUT}
        />
      </div>

      {"body" in copy && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={`body-${index}`} className="text-sm font-semibold text-ink-2">
              본문
            </label>
            <Counter value={body} max={120} />
          </div>
          <textarea
            id={`body-${index}`}
            rows={4}
            value={body}
            onChange={(e) => onPatch({ copy: { ...copy, body: e.target.value } as CardDraft["copy"] })}
            className={INPUT}
          />
        </div>
      )}

      {card.layout !== "text-only" && (
        <>
          <Field label="사진 초점" htmlFor={`focal-${index}`} hint="사진이 4:5가 아닐 때 어디를 남길지 정해요.">
            <div className="flex flex-col gap-2">
              <input
                id={`focal-${index}`}
                type="range"
                min={0}
                max={100}
                value={Math.round(card.focal.x * 100)}
                aria-label="가로 초점"
                onChange={(e) => onPatch({ focal: { ...card.focal, x: Number(e.target.value) / 100 } })}
                className="w-full accent-plum"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(card.focal.y * 100)}
                aria-label="세로 초점"
                onChange={(e) => onPatch({ focal: { ...card.focal, y: Number(e.target.value) / 100 } })}
                className="w-full accent-plum"
              />
            </div>
          </Field>

          {card.layout === "full-bleed" && (
            <Field label="글 배경 진하기" htmlFor={`scrim-${index}`} hint="흐리면 사진이 살고, 진하면 글이 또렷해요.">
              <input
                id={`scrim-${index}`}
                type="range"
                min={30}
                max={95}
                value={Math.round(card.scrim * 100)}
                onChange={(e) => onPatch({ scrim: Number(e.target.value) / 100 })}
                className="w-full accent-plum"
              />
            </Field>
          )}

          {card.layout === "split" && (
            <Field label="사진 높이" htmlFor={`band-${index}`}>
              <input
                id={`band-${index}`}
                type="range"
                min={30}
                max={70}
                value={Math.round(card.band * 100)}
                onChange={(e) => onPatch({ band: Number(e.target.value) / 100 })}
                className="w-full accent-plum"
              />
            </Field>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 편집 스텝 (3-페인)**

`src/features/cardnews/steps/ComposeStep.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Panel } from "@/components/ui";
import { CardRenderer } from "@/templates/CardRenderer";
import { CardInspector } from "../parts/CardInspector";
import { toRenderCards } from "../render";
import type { CardnewsAction, CardnewsState } from "../reducer";

export function ComposeStep({
  state,
  dispatch,
}: {
  state: CardnewsState;
  dispatch: React.Dispatch<CardnewsAction>;
}) {
  const [selected, setSelected] = useState(0);
  const rendered = toRenderCards(state);
  const current = rendered[selected];
  const draft = state.cards[selected];

  if (!current || !draft) {
    return <p className="text-sm text-ink-3">먼저 카피를 생성해 주세요.</p>;
  }

  return (
    <div className="grid h-full grid-cols-[128px_minmax(0,1fr)_320px] gap-5">
      <nav aria-label="카드 목록" className="min-w-0 overflow-y-auto">
        <ul className="flex flex-col gap-2">
          {rendered.map((card, i) => (
            <li key={i}>
              <button
                type="button"
                aria-current={i === selected ? "true" : undefined}
                onClick={() => setSelected(i)}
                className={`w-full overflow-hidden rounded-lg border-2 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
                  i === selected ? "border-plum" : "border-hair"
                }`}
              >
                <span className="block aspect-[4/5] w-full overflow-hidden bg-hair-soft">
                  <span className="block origin-top-left scale-[0.1037]">
                    <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
                  </span>
                </span>
              </button>
              <p className="mt-1 text-center tabular-nums text-[11px] text-ink-3">{i + 1}</p>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 items-start justify-center overflow-y-auto">
        <div className="overflow-hidden rounded-xl border border-hair shadow-sm" style={{ width: 432, height: 540 }}>
          <div className="origin-top-left scale-40">
            <CardRenderer card={current} themeId={state.themeId} handle={state.handle} />
          </div>
        </div>
      </div>

      <Panel className="min-w-0 overflow-y-auto p-4">
        <h2 className="mb-4 text-sm font-semibold">
          <span className="tabular-nums text-ink-3">{selected + 1}번</span> 카드
        </h2>
        <CardInspector
          card={draft}
          index={selected}
          onPatch={(patch) => dispatch({ type: "UPDATE_CARD", index: selected, patch })}
        />
      </Panel>
    </div>
  );
}
```

`scale-[0.1037]` 은 1080px을 112px 썸네일에 맞추는 값이고, `scale-40`(0.4)은 1080×1350을 432×540 스테이지에 맞추는 값이다. 두 값 모두 컨테이너 픽셀에서 역산한 것이라 임의 값이 아니다.

- [ ] **Step 5: 내보내기 스텝**

`src/features/cardnews/steps/ExportStep.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Download, FolderDown } from "lucide-react";
import { Button, Panel } from "@/components/ui";
import { CardRenderer } from "@/templates/CardRenderer";
import { toRenderCards } from "../render";
import type { CardnewsAction, CardnewsState } from "../reducer";

export function ExportStep({
  state,
  dispatch,
  onDownload,
  onSave,
}: {
  state: CardnewsState;
  dispatch: React.Dispatch<CardnewsAction>;
  onDownload: () => Promise<void>;
  onSave: () => Promise<{ dir: string; paths: string[] }>;
}) {
  const [saved, setSaved] = useState<{ dir: string; count: number } | null>(null);
  const rendered = toRenderCards(state);

  async function run(fn: () => Promise<void>) {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      await fn();
      dispatch({ type: "SET_BUSY", busy: false });
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: e instanceof Error ? e.message : "내보내기에 실패했어요" });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
        {rendered.map((card, i) => (
          <li key={i}>
            <div className="overflow-hidden rounded-lg border border-hair">
              <span className="block aspect-[4/5] w-full overflow-hidden bg-hair-soft">
                <span className="block origin-top-left scale-[0.1296]">
                  <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
                </span>
              </span>
            </div>
            <p className="mt-1 text-center tabular-nums text-[11px] text-ink-3">{i + 1}</p>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Button variant="secondary" disabled={state.busy} onClick={() => void run(onDownload)}>
          <Download size={15} aria-hidden="true" />
          PNG 다운로드
        </Button>
        <Button
          variant="primary"
          disabled={state.busy}
          onClick={() =>
            void run(async () => {
              const res = await onSave();
              setSaved({ dir: res.dir, count: res.paths.length });
            })
          }
        >
          <FolderDown size={15} aria-hidden="true" />
          폴더에 저장
        </Button>
      </div>

      {saved && (
        <Panel className="p-4">
          <p className="text-sm">
            <span className="font-semibold">{saved.count}장</span> 저장했어요 —{" "}
            <code className="rounded bg-hair-soft px-1.5 py-0.5 font-mono text-[13px]">{saved.dir}</code>
          </p>
        </Panel>
      )}

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
```

- [ ] **Step 6: 타입 확인 후 커밋**

Run: `npx tsc --noEmit`
Expected: `studio.tsx` 외 에러 없음

```bash
git add src/features/cardnews
git commit -m "feat: 카드뉴스 주제·편집·내보내기 스텝 (3-페인 편집기)"
```

---

## Task 21: 카드뉴스 페이지 조립

**Files:**
- Create: `src/app/cardnews/page.tsx` · `src/features/cardnews/CardnewsFlow.tsx`

**Interfaces:**
- Consumes: Task 13 셸 · Task 16 reducer · Task 18 훅 · Task 19~20 스텝
- Produces: `/cardnews` 라우트

- [ ] **Step 1: 플로우 컨테이너**

`src/features/cardnews/CardnewsFlow.tsx`:

```tsx
"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { StudioShell } from "@/features/shell/StudioShell";
import type { StepDef } from "@/features/shell/types";
import { CaptureStage } from "@/features/studio/CaptureStage";
import { useExport } from "@/features/studio/useExport";
import { PhotosStep } from "./steps/PhotosStep";
import { OrderStep } from "./steps/OrderStep";
import { TopicStep } from "./steps/TopicStep";
import { ComposeStep } from "./steps/ComposeStep";
import { ExportStep } from "./steps/ExportStep";
import { toRenderCards } from "./render";
import {
  CARDNEWS_MIN,
  canLeaveOrder,
  cardnewsReducer,
  initialCardnewsState,
} from "./reducer";

const STEPS: StepDef[] = [
  { id: 1, label: "사진" },
  { id: 2, label: "순서 정하기" },
  { id: 3, label: "주제" },
  { id: 4, label: "편집" },
  { id: 5, label: "내보내기" },
];

export function CardnewsFlow() {
  const [state, dispatch] = useReducer(cardnewsReducer, initialCardnewsState);
  const router = useRouter();
  const { registerRef, download, saveToFolder } = useExport();

  const go = (step: number) => dispatch({ type: "SET_STEP", step });

  const gate = (): { ok: boolean; hint?: string } => {
    if (state.step === 1) {
      const short = CARDNEWS_MIN - state.order.length;
      if (short > 0) return { ok: false, hint: `사진이 ${short}장 더 필요해요.` };
      return { ok: true };
    }
    if (state.step === 2) {
      return canLeaveOrder(state) ? { ok: true } : { ok: false, hint: "사진 5~6장을 슬롯에 채워 주세요." };
    }
    if (state.step === 3) {
      return state.cards.length > 0
        ? { ok: true }
        : { ok: false, hint: "카피를 먼저 생성해 주세요." };
    }
    return { ok: true };
  };

  const { ok, hint } = gate();

  function exit() {
    const dirty = state.photos.length > 0;
    if (dirty && !window.confirm("만들던 카드뉴스가 사라져요. 나갈까요?")) return;
    router.push("/");
  }

  return (
    <>
      <StudioShell
        flowLabel="카드뉴스"
        steps={STEPS}
        current={state.step}
        maxReached={state.maxReached}
        onSelectStep={go}
        meta={`사진 ${state.photos.length}장 · 카드 ${state.order.length}장`}
        onReset={() => dispatch({ type: "RESET" })}
        onExit={exit}
        footer={{
          onPrev: state.step > 1 ? () => go(state.step - 1) : undefined,
          onNext: state.step < 5 ? () => go(state.step + 1) : undefined,
          nextDisabled: !ok,
          hint,
        }}
      >
        {state.step === 1 && <PhotosStep state={state} dispatch={dispatch} />}
        {state.step === 2 && <OrderStep state={state} dispatch={dispatch} />}
        {state.step === 3 && <TopicStep state={state} dispatch={dispatch} onDone={() => go(4)} />}
        {state.step === 4 && <ComposeStep state={state} dispatch={dispatch} />}
        {state.step === 5 && (
          <ExportStep
            state={state}
            dispatch={dispatch}
            onDownload={() => download(state.cards.length, state.keyword)}
            onSave={() =>
              saveToFolder({
                count: state.cards.length,
                keyword: state.keyword,
                type: "cardnews",
                templateIds: state.cards.map((c) => c.layout),
              })
            }
          />
        )}
      </StudioShell>

      {state.cards.length > 0 && (
        <CaptureStage
          cards={toRenderCards(state)}
          themeId={state.themeId}
          handle={state.handle}
          registerRef={registerRef}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: 라우트**

`src/app/cardnews/page.tsx`:

```tsx
import { CardnewsFlow } from "@/features/cardnews/CardnewsFlow";

export default function CardnewsPage() {
  return <CardnewsFlow />;
}
```

- [ ] **Step 3: 브라우저 완주 검증**

Run: `npm run dev` → http://localhost:3500 → 카드뉴스 선택

확인 항목:
1. 사진 폴더를 드롭하면 썸네일이 파일명 순으로 뜬다
2. 5장 미만이면 다음 버튼이 비활성이고 푸터에 부족 장수가 뜬다
3. 2번에서 드래그로 순서가 바뀐다. 손잡이에 포커스 → Space → 화살표 → Space 로도 바뀐다
4. 3번에서 카피 생성 시 사진 내용이 반영된 카피가 나온다
5. 4번에서 카드 선택 시 스테이지·인스펙터가 함께 바뀌고, 레이아웃 토글이 즉시 반영된다
6. 5번에서 폴더 저장 시 `cardnews/<슬러그>-<MMDD>/` 에 PNG 5장이 생긴다
7. 콘솔 에러 0

- [ ] **Step 4: 커밋**

```bash
git add src/app/cardnews src/features/cardnews/CardnewsFlow.tsx
git commit -m "feat: 카드뉴스 5스텝 플로우 조립 및 라우트 연결"
```

---

## Task 22: 정보전달 4스텝 화면

**Files:**
- Create: `src/features/infosend/steps/PhotoStep.tsx` · `TopicStep.tsx` · `ComposeStep.tsx` · `ExportStep.tsx`
- Create: `src/features/infosend/parts/SortableItem.tsx` · `src/features/infosend/render.ts`

**Interfaces:**
- Consumes: Task 17 reducer · Task 15 사진 컴포넌트 · Task 18 훅
- Produces: `toRenderCard(state): RenderCard | null`

- [ ] **Step 1: RenderCard 변환기**

`src/features/infosend/render.ts`:

```ts
import type { RenderCard } from "@/templates/CardRenderer";
import { selectedPhoto, type InfoState } from "./reducer";

export function toRenderCard(state: InfoState): RenderCard | null {
  if (!state.spec) return null;
  return {
    layout: "split",
    photoUrl: selectedPhoto(state)?.dataUrl ?? null,
    focal: state.focal,
    scrim: 0,
    band: state.band,
    badge: "",
    copy: state.spec,
  };
}
```

- [ ] **Step 2: 사진 스텝**

`src/features/infosend/steps/PhotoStep.tsx`:

```tsx
"use client";

import { Dropzone } from "@/features/photos/Dropzone";
import { PhotoGrid } from "@/features/photos/PhotoGrid";
import type { InfoAction, InfoState } from "../reducer";

export function PhotoStep({
  state,
  dispatch,
}: {
  state: InfoState;
  dispatch: React.Dispatch<InfoAction>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <Dropzone
        hint="여러 장 올린 뒤 대표로 쓸 한 장을 고르면 돼요."
        onPhotos={(photos) => dispatch({ type: "ADD_PHOTOS", photos })}
        onError={(error) => dispatch({ type: "SET_ERROR", error })}
      />

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      {state.photos.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">대표 사진 고르기</h2>
            <p className="tabular-nums text-xs text-ink-3">{state.photos.length}장</p>
          </div>
          <PhotoGrid
            photos={state.photos}
            selectedIds={state.selectedPhotoId ? [state.selectedPhotoId] : []}
            onToggle={(photoId) => dispatch({ type: "SELECT_PHOTO", photoId })}
          />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 주제 스텝**

`src/features/infosend/steps/TopicStep.tsx` — 카드뉴스의 것과 같은 구조지만 `selectedPhoto` 한 장만 보내고 `InfographicSpec` 을 받는다:

```tsx
"use client";

import { Sparkles } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { THEMES, THEME_IDS } from "@/templates/themes";
import { requestSpec } from "@/features/studio/useGenerate";
import type { InfographicSpec } from "@/lib/schema";
import { selectedPhoto, type InfoAction, type InfoState } from "../reducer";

const INPUT =
  "h-11 w-full rounded-lg border border-hair bg-surface px-3.5 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

export function TopicStep({
  state,
  dispatch,
  onDone,
}: {
  state: InfoState;
  dispatch: React.Dispatch<InfoAction>;
  onDone: () => void;
}) {
  async function generate() {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      const photo = selectedPhoto(state);
      const spec = await requestSpec<InfographicSpec>({
        type: "informationsend",
        keyword: state.keyword,
        photos: photo ? [photo.thumbUrl] : [],
      });
      dispatch({ type: "SET_SPEC", spec });
      dispatch({ type: "SET_BUSY", busy: false });
      onDone();
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: e instanceof Error ? e.message : "카피 생성에 실패했어요" });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
      <Field label="키워드" htmlFor="keyword" hint="대표 사진과 함께 Claude에게 전달돼요.">
        <input
          id="keyword"
          value={state.keyword}
          onChange={(e) => dispatch({ type: "SET_KEYWORD", keyword: e.target.value })}
          placeholder="예: 중고 에어컨 고르는 법"
          className={INPUT}
        />
      </Field>

      <Field label="워터마크" htmlFor="handle" hint="비워 두면 카드에 아무것도 찍히지 않아요.">
        <input
          id="handle"
          value={state.handle}
          onChange={(e) => dispatch({ type: "SET_HANDLE", handle: e.target.value })}
          placeholder="@계정명"
          className={INPUT}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-ink-2">테마</legend>
        <div className="flex gap-2">
          {THEME_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={state.themeId === id}
              onClick={() => dispatch({ type: "SET_THEME", themeId: id })}
              className={`flex-1 rounded-lg border-2 px-2 py-3 text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
                state.themeId === id ? "border-plum" : "border-hair"
              }`}
              style={{
                // 테마 색은 런타임 데이터라 Tailwind 클래스로 표현할 수 없다 — themes.ts 값을 그대로 비춘다
                background: THEMES[id].bg,
                color: THEMES[id].fg,
              }}
            >
              {THEMES[id].label}
            </button>
          ))}
        </div>
      </fieldset>

      <Button variant="primary" onClick={generate} disabled={state.busy || state.keyword.trim().length === 0}>
        <Sparkles size={15} aria-hidden="true" />
        {state.busy ? "사진을 보고 쓰는 중이에요…" : "카피 생성"}
      </Button>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: 정렬 가능한 항목**

`src/features/infosend/parts/SortableItem.tsx`:

```tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";

const INPUT =
  "w-full rounded-lg border border-hair bg-surface px-2.5 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

export function SortableItem({
  id,
  index,
  keyword,
  desc,
  canRemove,
  onPatch,
  onRemove,
}: {
  id: string;
  index: number;
  keyword: string;
  desc: string;
  canRemove: boolean;
  onPatch: (patch: { keyword?: string; desc?: string }) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-hair bg-surface p-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${index + 1}번 항목 순서 바꾸기`}
          className="flex h-6 w-6 flex-none cursor-grab items-center justify-center rounded text-ink-3 hover:bg-hair-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum active:cursor-grabbing"
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
        <span className="flex-1 tabular-nums text-[11px] font-semibold text-plum">{index + 1}</span>
        <button
          type="button"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label={`${index + 1}번 항목 지우기`}
          className="flex h-6 w-6 flex-none items-center justify-center rounded text-ink-3 hover:bg-hair-soft hover:text-danger disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <input
          value={keyword}
          aria-label={`${index + 1}번 항목 키워드`}
          maxLength={30}
          onChange={(e) => onPatch({ keyword: e.target.value })}
          className={INPUT}
        />
        <textarea
          value={desc}
          aria-label={`${index + 1}번 항목 설명`}
          rows={2}
          maxLength={120}
          onChange={(e) => onPatch({ desc: e.target.value })}
          className={INPUT}
        />
      </div>
    </li>
  );
}
```

- [ ] **Step 5: 편집 스텝 (2-페인)**

`src/features/infosend/steps/ComposeStep.tsx`:

```tsx
"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button, Field, Panel } from "@/components/ui";
import { CardRenderer } from "@/templates/CardRenderer";
import { SortableItem } from "../parts/SortableItem";
import { toRenderCard } from "../render";
import { ITEMS_MAX, ITEMS_MIN, type InfoAction, type InfoState } from "../reducer";

const INPUT =
  "w-full rounded-lg border border-hair bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

export function ComposeStep({
  state,
  dispatch,
}: {
  state: InfoState;
  dispatch: React.Dispatch<InfoAction>;
}) {
  const card = toRenderCard(state);
  const spec = state.spec;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!card || !spec) return <p className="text-sm text-ink-3">먼저 카피를 생성해 주세요.</p>;

  const itemIds = spec.items.map((_, i) => `item-${i}`);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    dispatch({
      type: "REORDER_ITEM",
      from: itemIds.indexOf(String(active.id)),
      to: itemIds.indexOf(String(over.id)),
    });
  }

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_360px] gap-5">
      <div className="flex min-w-0 items-start justify-center overflow-y-auto">
        <div className="overflow-hidden rounded-xl border border-hair shadow-sm" style={{ width: 432, height: 540 }}>
          <div className="origin-top-left scale-40">
            <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
          </div>
        </div>
      </div>

      <Panel className="flex min-w-0 flex-col gap-5 overflow-y-auto p-4">
        <Field label="제목" htmlFor="title">
          <input
            id="title"
            value={spec.title}
            maxLength={40}
            onChange={(e) => dispatch({ type: "UPDATE_SPEC", patch: { title: e.target.value } })}
            className={INPUT}
          />
        </Field>

        <Field label="부제" htmlFor="subtitle">
          <input
            id="subtitle"
            value={spec.subtitle ?? ""}
            maxLength={60}
            onChange={(e) => dispatch({ type: "UPDATE_SPEC", patch: { subtitle: e.target.value } })}
            className={INPUT}
          />
        </Field>

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink-2">항목</h2>
            <span className="tabular-nums text-[11px] text-ink-3">
              {spec.items.length}/{ITEMS_MAX}
            </span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {spec.items.map((item, i) => (
                  <SortableItem
                    key={itemIds[i]}
                    id={itemIds[i]}
                    index={i}
                    keyword={item.keyword}
                    desc={item.desc}
                    canRemove={spec.items.length > ITEMS_MIN}
                    onPatch={(patch) => dispatch({ type: "UPDATE_ITEM", index: i, patch })}
                    onRemove={() => dispatch({ type: "REMOVE_ITEM", index: i })}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <Button
            variant="secondary"
            size="sm"
            disabled={spec.items.length >= ITEMS_MAX}
            onClick={() => dispatch({ type: "ADD_ITEM" })}
          >
            <Plus size={14} aria-hidden="true" />
            항목 추가
          </Button>
        </section>

        <Field label="팁" htmlFor="tip">
          <textarea
            id="tip"
            rows={2}
            value={spec.tip ?? ""}
            maxLength={120}
            onChange={(e) => dispatch({ type: "UPDATE_SPEC", patch: { tip: e.target.value } })}
            className={INPUT}
          />
        </Field>

        <Field label="사진 높이" htmlFor="band">
          <input
            id="band"
            type="range"
            min={20}
            max={50}
            value={Math.round(state.band * 100)}
            onChange={(e) => dispatch({ type: "SET_BAND", band: Number(e.target.value) / 100 })}
            className="w-full accent-plum"
          />
        </Field>

        <Field label="사진 초점" htmlFor="focal-x" hint="사진이 4:5가 아닐 때 어디를 남길지 정해요.">
          <div className="flex flex-col gap-2">
            <input
              id="focal-x"
              type="range"
              min={0}
              max={100}
              value={Math.round(state.focal.x * 100)}
              aria-label="가로 초점"
              onChange={(e) =>
                dispatch({ type: "SET_FOCAL", focal: { ...state.focal, x: Number(e.target.value) / 100 } })
              }
              className="w-full accent-plum"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(state.focal.y * 100)}
              aria-label="세로 초점"
              onChange={(e) =>
                dispatch({ type: "SET_FOCAL", focal: { ...state.focal, y: Number(e.target.value) / 100 } })
              }
              className="w-full accent-plum"
            />
          </div>
        </Field>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 6: 내보내기 스텝**

`src/features/infosend/steps/ExportStep.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Download, FolderDown } from "lucide-react";
import { Button, Panel } from "@/components/ui";
import { CardRenderer } from "@/templates/CardRenderer";
import { toRenderCard } from "../render";
import type { InfoAction, InfoState } from "../reducer";

export function ExportStep({
  state,
  dispatch,
  onDownload,
  onSave,
}: {
  state: InfoState;
  dispatch: React.Dispatch<InfoAction>;
  onDownload: () => Promise<void>;
  onSave: () => Promise<{ dir: string; paths: string[] }>;
}) {
  const [saved, setSaved] = useState<{ dir: string; count: number } | null>(null);
  const card = toRenderCard(state);

  async function run(fn: () => Promise<void>) {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      await fn();
      dispatch({ type: "SET_BUSY", busy: false });
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: e instanceof Error ? e.message : "내보내기에 실패했어요" });
    }
  }

  if (!card) return <p className="text-sm text-ink-3">먼저 카피를 생성해 주세요.</p>;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
      <div className="mx-auto overflow-hidden rounded-xl border border-hair shadow-sm" style={{ width: 324, height: 405 }}>
        <div className="origin-top-left scale-30">
          <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" disabled={state.busy} onClick={() => void run(onDownload)}>
          <Download size={15} aria-hidden="true" />
          PNG 다운로드
        </Button>
        <Button
          variant="primary"
          disabled={state.busy}
          onClick={() =>
            void run(async () => {
              const res = await onSave();
              setSaved({ dir: res.dir, count: res.paths.length });
            })
          }
        >
          <FolderDown size={15} aria-hidden="true" />
          폴더에 저장
        </Button>
      </div>

      {saved && (
        <Panel className="p-4">
          <p className="text-sm">
            <span className="font-semibold">{saved.count}장</span> 저장했어요 —{" "}
            <code className="rounded bg-hair-soft px-1.5 py-0.5 font-mono text-[13px]">{saved.dir}</code>
          </p>
        </Panel>
      )}

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
```

- [ ] **Step 7: 커밋**

```bash
git add src/features/infosend
git commit -m "feat: 정보전달 4스텝 화면 (대표 사진 선택·항목 dnd 편집)"
```

---

## Task 23: 정보전달 페이지 조립

**Files:**
- Create: `src/app/info/page.tsx` · `src/features/infosend/InfoFlow.tsx`

**Interfaces:**
- Consumes: Task 13 셸 · Task 17 reducer · Task 18 훅 · Task 22 스텝
- Produces: `/info` 라우트

- [ ] **Step 1: 플로우 컨테이너**

`src/features/infosend/InfoFlow.tsx`:

```tsx
"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { StudioShell } from "@/features/shell/StudioShell";
import type { StepDef } from "@/features/shell/types";
import { CaptureStage } from "@/features/studio/CaptureStage";
import { useExport } from "@/features/studio/useExport";
import { PhotoStep } from "./steps/PhotoStep";
import { TopicStep } from "./steps/TopicStep";
import { ComposeStep } from "./steps/ComposeStep";
import { ExportStep } from "./steps/ExportStep";
import { toRenderCard } from "./render";
import { canLeavePhoto, infoReducer, initialInfoState } from "./reducer";

const STEPS: StepDef[] = [
  { id: 1, label: "사진" },
  { id: 2, label: "주제" },
  { id: 3, label: "편집" },
  { id: 4, label: "내보내기" },
];

export function InfoFlow() {
  const [state, dispatch] = useReducer(infoReducer, initialInfoState);
  const router = useRouter();
  const { registerRef, download, saveToFolder } = useExport();

  const go = (step: number) => dispatch({ type: "SET_STEP", step });
  const card = toRenderCard(state);

  const gate = (): { ok: boolean; hint?: string } => {
    if (state.step === 1) {
      return canLeavePhoto(state) ? { ok: true } : { ok: false, hint: "대표로 쓸 사진 한 장을 골라 주세요." };
    }
    if (state.step === 2) {
      return state.spec ? { ok: true } : { ok: false, hint: "카피를 먼저 생성해 주세요." };
    }
    return { ok: true };
  };

  const { ok, hint } = gate();

  function exit() {
    const dirty = state.photos.length > 0;
    if (dirty && !window.confirm("만들던 정보전달 카드가 사라져요. 나갈까요?")) return;
    router.push("/");
  }

  return (
    <>
      <StudioShell
        flowLabel="정보전달"
        steps={STEPS}
        current={state.step}
        maxReached={state.maxReached}
        onSelectStep={go}
        meta={`사진 ${state.photos.length}장 · 항목 ${state.spec?.items.length ?? 0}개`}
        onReset={() => dispatch({ type: "RESET" })}
        onExit={exit}
        footer={{
          onPrev: state.step > 1 ? () => go(state.step - 1) : undefined,
          onNext: state.step < 4 ? () => go(state.step + 1) : undefined,
          nextDisabled: !ok,
          hint,
        }}
      >
        {state.step === 1 && <PhotoStep state={state} dispatch={dispatch} />}
        {state.step === 2 && <TopicStep state={state} dispatch={dispatch} onDone={() => go(3)} />}
        {state.step === 3 && <ComposeStep state={state} dispatch={dispatch} />}
        {state.step === 4 && (
          <ExportStep
            state={state}
            dispatch={dispatch}
            onDownload={() => download(1, state.keyword)}
            onSave={() =>
              saveToFolder({
                count: 1,
                keyword: state.keyword,
                type: "informationsend",
                templateIds: ["split"],
              })
            }
          />
        )}
      </StudioShell>

      {card && (
        <CaptureStage cards={[card]} themeId={state.themeId} handle={state.handle} registerRef={registerRef} />
      )}
    </>
  );
}
```

- [ ] **Step 2: 라우트**

`src/app/info/page.tsx`:

```tsx
import { InfoFlow } from "@/features/infosend/InfoFlow";

export default function InfoPage() {
  return <InfoFlow />;
}
```

- [ ] **Step 3: 브라우저 완주 검증**

Run: `npm run dev` → http://localhost:3500 → 정보전달 선택

확인 항목:
1. 사진 8장을 올리면 첫 장이 대표로 자동 선택되고, 다른 장을 눌러 바꿀 수 있다
2. 대표를 고르지 않으면 다음이 비활성이다
3. 카피 생성 시 items 3~6개가 나온다
4. 3번에서 항목을 드래그로 재배치하면 스테이지가 즉시 바뀐다. 키보드로도 된다
5. 항목이 3개일 때 삭제 버튼이 비활성, 6개일 때 추가 버튼이 비활성이다
6. 4번에서 저장 시 `informationsend/<슬러그>-<MMDD>/1.png` 가 생긴다
7. 콘솔 에러 0

- [ ] **Step 4: 커밋**

```bash
git add src/app/info src/features/infosend/InfoFlow.tsx
git commit -m "feat: 정보전달 4스텝 플로우 조립 및 라우트 연결"
```

---

## Task 24: 정리와 최종 검증

**Files:**
- Delete: `src/app/studio.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: 전체
- Produces: 없음

- [ ] **Step 1: 옛 스튜디오 삭제**

```bash
rm src/app/studio.tsx
```

- [ ] **Step 2: 잔재 확인**

Run: `grep -rn "studio\.tsx\|RE:픽 카드 스튜디오\|InfographicCard\|CardnewsSlide\|theme.watermark" src/ README.md`
Expected: 결과 없음. 나오면 해당 참조를 지운다.

- [ ] **Step 3: README 갱신**

`README.md` 전체를 교체:

```markdown
# 콘티 — 카드 스튜디오

직접 작업한 사진 폴더를 올려 순서를 정하고, Claude가 사진을 보고 쓴 카피를 얹어 인스타 카드 PNG로 뽑습니다.

## 실행
1. `npm install`
2. `cp .env.local.example .env.local` 후 `ANTHROPIC_API_KEY` 또는 `ANTHROPIC_AUTH_TOKEN` 입력
3. `npm run dev` → http://localhost:3500

## 화면
- `/` 허브 — 무엇을 만들지 고르고, 최근 만든 것을 봅니다
- `/cardnews` 카드뉴스 5스텝 — 사진 → 순서 → 주제 → 편집 → 내보내기
- `/info` 정보전달 4스텝 — 사진 → 주제 → 편집 → 내보내기

## 산출물 폴더
- `cardnews/<키워드슬러그>-<MMDD>/1.png … N.png`
- `informationsend/<키워드슬러그>-<MMDD>/1.png`

## 지식관리 (`knowledge/`)
- `brand-voice.md` / `copy-formulas.md` → 생성 프롬프트에 주입
- `templates.md` → 레이아웃·테마 카탈로그
- `ledger.jsonl` → 생성 이력(append-only). 허브의 "최근 만든 것"이 이 파일을 읽습니다

## 설계 문서
- 스펙: `docs/superpowers/specs/2026-07-31-conti-photo-studio-design.md`
- 계획: `docs/superpowers/plans/2026-07-31-conti-photo-studio.md`

## 스택
Next.js 16 · React 19 · Tailwind v4 · Anthropic SDK(claude-opus-4-8, vision) · zod · html-to-image · @dnd-kit · lucide-react
```

- [ ] **Step 4: 전체 검증**

```bash
npm test && npx tsc --noEmit && npm run build
```

Expected: 테스트 13개 파일 전부 통과, 타입 에러 0, 빌드 성공

- [ ] **Step 5: 폭 검증**

`npm run dev` 후 브라우저 창을 1280 / 1440 / 1920 폭으로 두고 `/`, `/cardnews`(1~5스텝), `/info`(1~4스텝)를 훑는다.
Expected: 가로 스크롤바 0. 4번 편집 스텝의 3-페인이 1280에서도 인스펙터가 잘리지 않는다.

- [ ] **Step 6: 키보드 검증**

Tab만으로 두 플로우를 완주한다. 특히 2번 스텝 순서 손잡이에서 Space → 화살표 → Space 로 순서가 바뀌는지, 정보전달 항목에서도 같은지 확인한다.
Expected: 모든 조작 가능, 포커스 링이 항상 보임

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore: 옛 단일 폼 스튜디오 제거 및 README 갱신"
```

---

## 자기 검토 결과

**스펙 커버리지** — 스펙 §3 아이덴티티→T1, §4 디자인 언어→T1·T12, §5.1 허브→T14, §5.2 카드뉴스 5스텝→T19·T20·T21, §5.3 정보전달 4스텝→T22·T23, §5.4 레이아웃→T4·T8·T11, §5.5 이탈 확인→T21·T23, §6 상태 모델→T16·T17, §7 데이터 흐름→T5·T6·T18, §8 파일 구조→전체, §9 테스트→T2~T8·T16·T17, §10 완료 기준→T21·T23·T24.

**미커버 항목 없음.** 스펙 §9의 테스트 7종은 `photos`(T2) · `reorder`(T3) · `layout-assign`(T4) · `prompt`(T5) · `route`(T6) · `cardnews reducer`(T16) · `infosend reducer`(T17) 로 전부 배치됐고, `ledger`(T7)와 `layout-utils`(T8)가 추가로 붙어 신규 테스트 파일은 9개다 (스펙이 적은 7개 + 2개).

**타입 일관성** — `Photo`(T2)는 T15·T16·T17에서 같은 필드로 쓰인다. `CardLayout`(T4)은 T11·T16·T20에서 동일. `Focal`(T8)은 T11·T16·T17·T20·T22에서 동일. `RenderCard`(T11)는 T18 `CaptureStage`·T20·T22 스테이지에서 동일. `buildSystemPrompt` 3인자 시그니처(T5)는 T6 라우트에서만 호출된다.

**의도적 편차 1건** — 스펙 §9는 신규 테스트를 7개로 적었으나 계획은 9개다. `ledger.readRecent`와 `layout-utils`가 순수 함수이고 허브·카드 렌더의 정확성을 직접 좌우하므로 테스트를 붙였다. 커버리지가 늘어난 방향이라 스펙을 고치지 않는다.

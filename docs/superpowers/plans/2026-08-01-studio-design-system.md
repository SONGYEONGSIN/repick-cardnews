# 스튜디오 UI 크래프트 개편 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스튜디오 UI 의 중성색을 진짜 라이트(zinc)로 교체하고 대비 결함을 없애, Lighthouse 접근성을 92 에서 95 이상으로 올린다.

**Architecture:** 명암비를 계산하는 순수 함수를 먼저 만들고, 그 위에 토큰 램프를 테스트로 고정한다. 그다음 컴포넌트가 새 토큰을 쓰도록 바꾸고, 마지막에 정적 규칙을 vitest 테스트로, 브라우저 검증을 on-demand 스크립트로 둔다. 정보 구조와 단계 흐름은 건드리지 않는다.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4 (`@theme inline`), TypeScript 5.7, vitest 3, lucide-react, Lighthouse CLI

설계 근거: `docs/superpowers/specs/2026-08-01-studio-design-system-design.md`

## Global Constraints

- **범위는 스튜디오 UI 뿐이다.** `src/templates/**`(카드 템플릿·테마 3종), `knowledge/**`(카피 규칙·이모지), `src/lib/claude-cli.ts` 등 생성 파이프라인은 건드리지 않는다.
- **Gaegu·Do Hyeon 폰트를 제거하지 않는다** — 카드 템플릿이 실제로 쓴다. `layout.tsx` 의 Google Fonts 링크도 그대로 둔다.
- 액센트는 `plum #7A2E6B` 유지. 색상을 바꾸지 않는다.
- 다크 모드를 도입하지 않는다.
- `ink3` 는 순백·`canvas` 표면에서만 쓴다. `hairSoft` 이상 muted 표면 위 보조 텍스트는 `ink2` 를 쓴다.
- **텍스트 색에 투명도 수식을 붙이지 않는다** (`text-ink-3/60` 금지). 계산된 대비가 무너진다. 장식용 SVG `fill-plum/20` 은 텍스트가 아니므로 해당 없음.
- 폰트 웨이트는 3종(400·600·800)을 유지한다. 늘리지 않는다.
- `any` 타입, 타입 단언(`as`, `as const` 는 토큰 객체 정의 제외, `!`), `@ts-ignore`, `@ts-expect-error`, `eslint-disable` 금지.
- `console.log` 를 남기지 않는다.
- 컴포넌트에서 하드코딩 색상(`#xxx`, `rgb()`) 금지 — 토큰 또는 Tailwind 클래스만.
- RED → GREEN → 커밋 순서. 테스트가 처음부터 통과하면 그 테스트는 무의미하므로 다시 쓴다.
- 커밋 메시지는 conventional 영문 접두사 + 한국어, 제목 50자 이내.
- 파일은 400줄을 넘지 않게 유지한다.
- `npx tsc --noEmit` 은 항상 0바이트여야 한다.

**테스트 실행:** `npx vitest run <파일경로>` (설정 `vitest.config.ts`, `include: ["src/**/*.test.ts"]`, 별칭 `@` → `./src`)

---

### Task 1: 명암비 계산 순수 함수

토큰 램프를 테스트로 고정하려면 명암비를 계산할 수단이 먼저 있어야 한다. WCAG 2.x 공식 그대로 구현한다.

**Files:**
- Create: `src/lib/contrast.ts`
- Test: `src/lib/contrast.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `relativeLuminance(hex: string): number`
  - `contrastRatio(a: string, b: string): number`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/contrast.test.ts` 를 만들고 아래를 그대로 넣는다.

```ts
import { describe, it, expect } from "vitest";
import { relativeLuminance, contrastRatio } from "@/lib/contrast";

describe("relativeLuminance", () => {
  it("흰색은 1, 검정은 0 이다", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("3자리 축약형도 읽는다", () => {
    expect(relativeLuminance("#fff")).toBeCloseTo(relativeLuminance("#FFFFFF"), 5);
  });

  it("hex 가 아니면 거부한다", () => {
    expect(() => relativeLuminance("rgb(0,0,0)")).toThrow(/hex/);
  });
});

describe("contrastRatio", () => {
  it("흰 배경 위 검정은 21:1 이다", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  it("같은 색끼리는 1:1 이다", () => {
    expect(contrastRatio("#7A2E6B", "#7A2E6B")).toBeCloseTo(1, 5);
  });

  it("순서를 바꿔도 같은 값이다", () => {
    expect(contrastRatio("#7A2E6B", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#7A2E6B"), 5);
  });

  it("plum 은 흰 배경에서 8.64:1 이다", () => {
    expect(contrastRatio("#7A2E6B", "#FFFFFF")).toBeCloseTo(8.64, 1);
  });

  it("현재 ink3 는 흰 배경에서 AA 본문 기준에 못 미친다", () => {
    // Lighthouse 실측 3.51:1 — 이 계획이 고치려는 결함
    expect(contrastRatio("#8B8791", "#FFFFFF")).toBeLessThan(4.5);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/contrast.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/contrast"`

- [ ] **Step 3: 최소 구현**

`src/lib/contrast.ts` 를 만들고 아래를 넣는다.

```ts
/**
 * WCAG 2.x 명암비 계산.
 *
 * 토큰 램프가 접근성 기준을 만족하는지 테스트로 고정하기 위한 것이다 — 브라우저 없이
 * 결정론적으로 돌아야 해서 직접 구현한다.
 */

function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`hex 색상이 아닙니다: ${hex}`);
  const body = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [
    Number.parseInt(body.slice(0, 2), 16),
    Number.parseInt(body.slice(2, 4), 16),
    Number.parseInt(body.slice(4, 6), 16),
  ];
}

/** 채널 하나를 sRGB 에서 선형 광량으로 되돌린다. */
function linearize(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/contrast.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/contrast.ts src/lib/contrast.test.ts
git commit -m "feat: WCAG 명암비 계산 순수 함수 추가"
```

---

### Task 2: 토큰 램프 교체 + 대비 테스트로 고정

중성색을 zinc 계열 순백 기반으로 갈아끼우고, 조합별 하한을 테스트로 못 박는다. 이 테스트가 있으면 나중에 누가 색을 만져도 즉시 깨진다.

**Files:**
- Modify: `src/lib/design-tokens.ts`
- Modify: `src/app/globals.css`
- Test: `src/lib/design-tokens.test.ts` (신규)

**Interfaces:**
- Consumes: Task 1 의 `contrastRatio`
- Produces: `colors` 객체의 새 키 — `canvas`·`surface`·`hairSoft`·`hair`·`ink`·`ink2`·`ink3`·`inkDisabled`·`plum`·`plumHover`·`plumActive`·`plumSoft`·`warnSoft`·`warnInk`·`danger`. Tailwind 유틸 이름은 `bg-canvas`·`text-ink-2`·`bg-plum-soft`·`text-warn-ink` 형태로 생성된다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/design-tokens.test.ts` 를 만들고 아래를 그대로 넣는다.

```ts
import { describe, it, expect } from "vitest";
import { contrastRatio } from "@/lib/contrast";
import { colors } from "@/lib/design-tokens";

/** WCAG AA: 본문 4.5:1, 대형·UI 요소 3:1 */
const AA_BODY = 4.5;
const AA_LARGE = 3;

describe("본문·보조 텍스트 대비", () => {
  it("ink 는 모든 표면에서 본문 기준을 넘는다", () => {
    for (const bg of [colors.surface, colors.canvas, colors.hairSoft]) {
      expect(contrastRatio(colors.ink, bg)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("ink2 는 muted 표면 위에서도 본문 기준을 넘는다", () => {
    for (const bg of [colors.surface, colors.canvas, colors.hairSoft]) {
      expect(contrastRatio(colors.ink2, bg)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("ink3 는 순백·canvas 에서 본문 기준을 넘는다", () => {
    expect(contrastRatio(colors.ink3, colors.surface)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(colors.ink3, colors.canvas)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("ink3 는 muted 표면에서 기준에 못 미친다 — 그래서 그 위에서는 ink2 를 쓴다", () => {
    // 이 사실이 'muted 표면에서는 ink2' 규칙의 근거다. 값이 바뀌면 규칙도 다시 봐야 한다.
    expect(contrastRatio(colors.ink3, colors.hairSoft)).toBeLessThan(AA_BODY);
  });
});

describe("액센트 대비", () => {
  it("plum 위의 흰 글자가 본문 기준을 넘는다", () => {
    for (const bg of [colors.plum, colors.plumHover, colors.plumActive]) {
      expect(contrastRatio(colors.surface, bg)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("plumSoft 배경 위의 plum 글자가 본문 기준을 넘는다", () => {
    expect(contrastRatio(colors.plum, colors.plumSoft)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("plum 은 흰 배경에서 UI 요소 기준을 넘는다", () => {
    expect(contrastRatio(colors.plum, colors.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe("상태 색 대비", () => {
  it("warn 조합이 본문 기준을 넘는다", () => {
    expect(contrastRatio(colors.warnInk, colors.warnSoft)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("danger 가 흰 배경에서 본문 기준을 넘는다", () => {
    expect(contrastRatio(colors.danger, colors.surface)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe("경계선", () => {
  it("hair 가 캔버스와 구분된다", () => {
    expect(contrastRatio(colors.hair, colors.canvas)).toBeGreaterThan(1.2);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/design-tokens.test.ts`
Expected: FAIL — 현재 토큰에는 `hairSoft`(카멜케이스는 있으나 `plumHover`·`plumActive`·`warnSoft`·`warnInk`·`inkDisabled` 없음) 키가 없어 타입 에러 또는 `undefined` 로 인한 실패. 특히 "ink3 는 순백·canvas 에서 본문 기준을 넘는다" 가 현재 값 `#8B8791`(3.51:1)로 실패해야 한다.

- [ ] **Step 3: 토큰 교체**

`src/lib/design-tokens.ts` 전체를 아래로 바꾼다.

```ts
/**
 * 스튜디오 UI 디자인 토큰.
 *
 * 중성색은 zinc 계열 순백 기반("진짜 라이트")이고 액센트는 plum 하나뿐이다.
 * 조합별 명암비는 `design-tokens.test.ts` 가 고정한다 — 값을 바꾸면 그 테스트가 잡는다.
 *
 * `ink3` 는 순백·canvas 표면 전용이다. hairSoft 이상 muted 표면 위 보조 텍스트에는
 * `ink2` 를 써야 한다 (ink3 는 hairSoft 위에서 4.39:1 로 AA 미달).
 */
export const colors = {
  canvas: "#FAFAFA",
  surface: "#FFFFFF",
  hairSoft: "#F4F4F5",
  hair: "#E4E4E7",
  ink: "#18181B",
  ink2: "#52525B",
  ink3: "#71717A",
  /** 비활성 컨트롤 전용. WCAG 는 비활성 요소를 대비 요건에서 면제한다. */
  inkDisabled: "#A1A1AA",
  plum: "#7A2E6B",
  plumHover: "#66255A",
  plumActive: "#521D48",
  plumSoft: "#F6EAF3",
  warnSoft: "#FDF1E7",
  warnInk: "#8A4B12",
  danger: "#B4231F",
} as const;

export const radii = {
  control: "0.5rem",
  panel: "0.75rem",
} as const;
```

- [ ] **Step 4: globals.css 동기화**

`src/app/globals.css` 의 `@theme inline` 블록을 아래로 바꾼다. `--font-display` 는 스튜디오에서 쓰이지 않는 변수라 지운다 (카드 템플릿은 `themes.ts` 의 `displayFont` 를 직접 쓰므로 영향 없다).

```css
@theme inline {
  --color-canvas: #FAFAFA;
  --color-surface: #FFFFFF;
  --color-hair-soft: #F4F4F5;
  --color-hair: #E4E4E7;
  --color-ink: #18181B;
  --color-ink-2: #52525B;
  --color-ink-3: #71717A;
  --color-ink-disabled: #A1A1AA;
  --color-plum: #7A2E6B;
  --color-plum-hover: #66255A;
  --color-plum-active: #521D48;
  --color-plum-soft: #F6EAF3;
  --color-warn-soft: #FDF1E7;
  --color-warn-ink: #8A4B12;
  --color-danger: #B4231F;

  --color-background: #FFFFFF;
  --color-foreground: #18181B;
  --font-sans: "Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif;
}
```

나머지(`html`, `body`, `prefers-reduced-motion` 블록)는 그대로 둔다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/design-tokens.test.ts`
Expected: PASS — 9 tests

Run: `npx tsc --noEmit`
Expected: 출력 없음

- [ ] **Step 6: 커밋**

```bash
git add src/lib/design-tokens.ts src/lib/design-tokens.test.ts src/app/globals.css
git commit -m "feat: 중성색을 zinc 순백 기반으로 교체하고 대비를 테스트로 고정"
```

---

### Task 3: 공유 포커스 링 + UI 아톰 정밀화

포커스 링 문자열이 5개 컴포넌트에 흩어져 있다. 하나로 모으고, 컨트롤 높이와 radius 를 통일한다.

**Files:**
- Create: `src/components/ui/focus.ts`
- Modify: `src/components/ui/Button.tsx`, `Badge.tsx`, `Panel.tsx`, `Field.tsx`, `SegmentedControl.tsx`
- Modify: `src/components/ui/index.ts`
- Test: `src/components/ui/focus.test.ts` (신규)

**Interfaces:**
- Consumes: Task 2 의 토큰 (Tailwind 유틸 `bg-plum-hover`·`text-warn-ink` 등)
- Produces: `FOCUS_RING: string` — `focus-visible:` 접두 유틸 문자열

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/ui/focus.test.ts` 를 만든다.

```ts
import { describe, it, expect } from "vitest";
import { FOCUS_RING } from "@/components/ui/focus";

describe("FOCUS_RING", () => {
  it("focus-visible 로만 링을 노출한다", () => {
    // outline-none 단독은 금지 — 키보드 사용자가 포커스를 잃는다
    expect(FOCUS_RING).toContain("focus-visible:");
    expect(FOCUS_RING).not.toMatch(/(^|\s)outline-none(\s|$)/);
  });

  it("액센트 색 링과 오프셋을 갖는다", () => {
    expect(FOCUS_RING).toContain("outline-plum");
    expect(FOCUS_RING).toContain("outline-offset");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/ui/focus.test.ts`
Expected: FAIL — `Failed to resolve import "@/components/ui/focus"`

- [ ] **Step 3: 구현**

`src/components/ui/focus.ts`:

```ts
/**
 * 공유 포커스 링.
 *
 * `focus-visible` 로만 노출한다 — 마우스 클릭에는 링이 뜨지 않고 키보드 이동에만 뜬다.
 * 각 컴포넌트가 같은 문자열을 반복하다 한 곳만 빠지는 일을 막으려고 상수로 둔다.
 */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";
```

`src/components/ui/index.ts` 에 한 줄 추가:

```ts
export { FOCUS_RING } from "./focus";
```

`Button.tsx` 의 `BASE` 와 `VARIANTS` 를 바꾼다 (나머지는 그대로):

```ts
import { FOCUS_RING } from "./focus";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[transform,background-color,border-color] duration-200 " +
  `${FOCUS_RING} disabled:opacity-45 disabled:cursor-not-allowed motion-reduce:transition-none`;

const VARIANTS = {
  primary: "bg-plum text-white hover:bg-plum-hover active:bg-plum-active border border-transparent",
  secondary: "bg-surface text-ink border border-hair hover:border-ink-3",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:text-ink hover:bg-hair-soft",
} as const;
```

`Badge.tsx` 의 `TONES` 에서 arbitrary value 를 토큰으로 바꾼다:

```ts
const TONES = {
  neutral: "bg-hair-soft text-ink-2",
  warn: "bg-warn-soft text-warn-ink",
  accent: "bg-plum-soft text-plum",
} as const;
```

`SegmentedControl.tsx` 의 버튼 className 에서 포커스 문자열을 `FOCUS_RING` 으로 바꾼다. 높이는 **바꾸지 않는다** — 래퍼의 `p-1`(4px×2)에 버튼 `h-9`(36px)가 더해져 컨트롤 전체가 이미 44px 다. `TopicStep` 의 입력도 이미 `h-11`(44px)이라 스펙의 "컨트롤 높이 44px 통일"은 충족돼 있다. 비선택 항목 텍스트는 `text-ink-2` 를 유지한다:

```ts
import { FOCUS_RING } from "./focus";
```

```tsx
className={`h-9 rounded-md px-3 text-sm font-semibold transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
  on ? "bg-plum text-white" : "text-ink-2 hover:text-ink"
}`}
```

`Panel.tsx` 와 `Field.tsx` 는 색 토큰만 새 이름을 그대로 쓰므로 변경 없음 — 확인만 한다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/ui/focus.test.ts`
Expected: PASS — 2 tests

Run: `npx tsc --noEmit`
Expected: 출력 없음

- [ ] **Step 5: 커밋**

```bash
git add src/components/ui
git commit -m "refactor: 포커스 링 공유 상수화와 배지 토큰화"
```

---

### Task 4: 셸·레일·드롭존의 접근성 결함 제거

Lighthouse 가 잡은 두 감사(`color-contrast`, `label`)를 실제로 고치는 태스크다.

**Files:**
- Modify: `src/features/shell/StudioShell.tsx`
- Modify: `src/features/shell/StepRail.tsx`
- Modify: `src/features/photos/Dropzone.tsx`

**Interfaces:**
- Consumes: Task 2 의 토큰, Task 3 의 `FOCUS_RING`
- Produces: 없음 (화면 변경만)

- [ ] **Step 1: StudioShell 의 저대비 텍스트 교정**

`src/features/shell/StudioShell.tsx` 에서 Lighthouse 가 지목한 세 곳을 바꾼다.

- 46행 사이드바 플로우 라벨: `text-[11px] text-ink-3` → `text-[11px] text-ink-2`
- 52행 사이드바 하단 메타: `text-[11px] tabular-nums text-ink-3` → `text-[11px] tabular-nums text-ink-2`
- 70행 푸터 안내: `text-sm text-ink-3` → `text-sm text-ink-2`

58행 헤더 스텝 번호(`text-ink-3`)는 `surface` 위이고 새 `ink3`(4.83:1)로 기준을 넘으므로 그대로 둔다.

39행 브랜드 버튼의 포커스 문자열을 `FOCUS_RING` 으로 바꾸고 `import { Button, ContiMark, FOCUS_RING } from "@/components/ui";` 로 정리한다.

- [ ] **Step 2: StepRail 의 투명도 수식 제거**

`src/features/shell/StepRail.tsx` 에서:

- 비활성 단계 `cursor-not-allowed text-ink-3/60` → `cursor-not-allowed text-ink-disabled`
- 완료 배지 `bg-plum/25 text-plum` → `bg-plum-soft text-plum`
- 미도달 배지 `bg-hair text-ink-3` → `bg-hair text-ink-2` (hair 는 muted 표면이므로 ink2)
- 포커스 문자열을 `FOCUS_RING` 으로 교체하고 `import { FOCUS_RING } from "@/components/ui";` 추가

- [ ] **Step 3: Dropzone 에 접근 가능한 이름 부여**

`src/features/photos/Dropzone.tsx` 의 파일 입력에 `aria-label` 을 추가한다. 시각적으로 감춘 컨트롤도 이름이 있어야 한다 — Lighthouse `label` 감사가 이걸 잡았다.

```tsx
<input
  ref={inputRef}
  type="file"
  accept="image/*"
  multiple
  aria-label="사진 폴더 선택"
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
```

같은 파일의 아이콘 색 `text-ink-3` 는 장식용(`aria-hidden`)이라 그대로 둔다.

- [ ] **Step 4: 타입·테스트 확인**

Run: `npx tsc --noEmit`
Expected: 출력 없음

Run: `npx vitest run`
Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features
git commit -m "fix: 저대비 보조 텍스트와 이름 없는 파일 입력 교정"
```

---

> **이미지 컨테이너 예약은 이미 충족돼 있다 — 별도 태스크가 없는 이유.**
> 스펙은 `no-raw-img` 게이트를 도입하지 않는 대신 "고정 aspect-ratio + 배경색 예약"을 적용하라고 했다.
> 계획을 쓰며 세 곳(`PhotoGrid.tsx`, `SortableSlot.tsx`, `OrderStep.tsx`)을 확인한 결과 전부
> `<span className="block aspect-[4/5] w-full">` + 래퍼의 `bg-hair-soft` 를 이미 갖고 있고,
> next/image 를 쓸 수 없는 이유까지 주석으로 남아 있다. 손댈 것이 없다.

---

### Task 5: 정적 디자인 게이트를 vitest 테스트로

`repick-design` 의 정적 규칙 중 이 프로젝트에 적용되는 것만 옮긴다. 별도 스크립트 대신 vitest 테스트로 두면 `npm test` 에서 항상 돌고 새 도구가 필요 없다.

**Files:**
- Create: `src/lib/design-gate.test.ts`

**Interfaces:**
- Consumes: 없음 (파일시스템 스캔)
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/design-gate.test.ts` 를 만든다. 스튜디오 UI 경로만 스캔하고 카드 템플릿은 제외한다.

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** 스튜디오 UI 경로만 검사한다 — src/templates 는 카드 산출물이라 규칙이 다르다. */
const ROOTS = ["src/app", "src/components", "src/features"];

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const root of ROOTS) {
    for (const name of readdirSync(root, { recursive: true })) {
      if (typeof name !== "string") continue;
      if (!name.endsWith(".tsx") && !name.endsWith(".ts")) continue;
      if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
      out.push(path.join(root, name));
    }
  }
  return out;
}

function violations(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of sourceFiles()) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file}:${i + 1} ${line.trim()}`);
    });
  }
  return hits;
}

describe("디자인 게이트 — 스튜디오 UI", () => {
  it("이모지를 쓰지 않는다 (아이콘은 lucide-react)", () => {
    expect(violations(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)).toEqual([]);
  });

  it("세리프·장식 폰트를 쓰지 않는다", () => {
    expect(violations(/font-serif|font-\[.*(serif|cursive)/)).toEqual([]);
  });

  it("허용 목록 밖 폰트를 지정하지 않는다", () => {
    // 스튜디오는 전역 --font-sans 하나만 쓴다. fontFamily 직접 지정은 카드 템플릿 몫이다.
    expect(violations(/fontFamily\s*:/)).toEqual([]);
  });

  it("텍스트 색에 투명도 수식을 붙이지 않는다", () => {
    // text-ink-3/60 같은 표현은 계산된 대비를 무너뜨린다.
    expect(violations(/text-(ink|ink-2|ink-3|plum)\/\d+/)).toEqual([]);
  });

  it("컴포넌트에 하드코딩 색상을 쓰지 않는다", () => {
    // design-tokens.ts 와 globals.css 만 원시 색상을 갖는다.
    expect(violations(/(bg|text|border|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/)).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/design-gate.test.ts`
Expected: 이 시점에는 대부분 PASS 해야 정상이다 — Task 3·4 에서 이미 arbitrary value 와 투명도 수식을 없앴기 때문이다. **하나라도 실패하면 그 위반을 먼저 고친다.**

게이트가 실제로 무언가를 잡는지 확인하려면, 아무 스튜디오 UI 파일에 `text-ink-3/50` 을 임시로 넣고 이 테스트가 실패하는지 본 뒤 되돌린다. 임시 변경은 커밋하지 않는다. 그 실패 출력을 리포트에 남긴다.

- [ ] **Step 3: 통과 확인**

Run: `npx vitest run src/lib/design-gate.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 4: 커밋**

```bash
git add src/lib/design-gate.test.ts
git commit -m "test: 스튜디오 UI 정적 디자인 게이트 추가"
```

---

### Task 6: 브라우저 감사 스크립트 + 목표 달성 확인

접근성 점수와 폭 오버플로는 브라우저가 있어야 잰다. 필요할 때 돌리는 스크립트로 둔다.

**Files:**
- Create: `scripts/design-audit.mjs`
- Modify: `package.json` (scripts 에 `design:audit` 추가)

**Interfaces:**
- Consumes: 실행 중인 dev 서버 (`http://localhost:3500`)
- Produces: 없음

- [ ] **Step 1: 스크립트 작성**

`scripts/design-audit.mjs` 를 만든다.

```js
/**
 * 스튜디오 UI 브라우저 감사 — 접근성 점수와 폭별 가로 오버플로.
 *
 * dev 서버가 떠 있어야 한다: npm run dev
 * 실행: npm run design:audit
 */
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const BASE = "http://localhost:3500";
const ROUTES = ["/", "/cardnews", "/info"];
const WIDTHS = [1280, 1366, 1440, 1600, 1920, 390];
const A11Y_MIN = 95;
const CLEARANCE = 16;

function lighthouseScore(url) {
  const out = path.join(mkdtempSync(path.join(tmpdir(), "lh-")), "r.json");
  const r = spawnSync("npx", ["lighthouse", url, "--only-categories=accessibility",
    "--output=json", `--output-path=${out}`, "--chrome-flags=--headless", "--quiet"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return { score: null, failures: ["lighthouse 실행 실패"] };
  const report = JSON.parse(readFileSync(out, "utf8"));
  const failures = Object.values(report.audits)
    .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode !== "notApplicable")
    .map((a) => a.id);
  return { score: Math.round(report.categories.accessibility.score * 100), failures };
}

const results = [];

for (const route of ROUTES) {
  const { score, failures } = lighthouseScore(BASE + route);
  const pass = score !== null && score >= A11Y_MIN;
  results.push({ gate: "a11y", route, pass, detail: `${score} (실패: ${failures.join(", ") || "없음"})` });
}

const browser = await chromium.launch();
for (const route of ROUTES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const slack = width - scrollWidth;
    const pass = slack >= 0;
    results.push({ gate: "sweep", route, pass, detail: `${width}px → scrollWidth ${scrollWidth} (여유 ${slack})` });
    await page.close();
  }
}
await browser.close();

for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.gate} ${r.route} — ${r.detail}`);
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 통과 (여유 기준 ${CLEARANCE}px 는 참고값)`);
process.exit(failed.length === 0 ? 0 : 1);
```

`package.json` 의 `scripts` 에 한 줄 추가한다:

```json
"design:audit": "node scripts/design-audit.mjs"
```

`playwright` 를 devDependencies 에 추가한다:

```bash
npm install -D playwright
npx playwright install chromium
```

- [ ] **Step 2: dev 서버를 띄우고 감사 실행**

```bash
npm run dev > /tmp/dev-audit.log 2>&1 &
sleep 6
npm run design:audit > /tmp/design-audit.log 2>&1; echo "exit=$?"
cat /tmp/design-audit.log
```

Expected: `/cardnews` 의 a11y 가 **95 이상**이고 `color-contrast`·`label` 이 실패 목록에 없어야 한다. 폭 스위프는 전 구간 PASS.

- [ ] **Step 3: 미달 항목이 있으면 고친다**

실패한 감사 항목의 노드를 확인하고 해당 컴포넌트를 고친 뒤 Step 2 를 다시 돌린다. 목표에 도달할 때까지 반복한다. 무엇을 고쳤는지 리포트에 남긴다.

- [ ] **Step 4: 커밋**

```bash
git add scripts/design-audit.mjs package.json package-lock.json
git commit -m "test: 접근성·폭 오버플로 감사 스크립트 추가"
```

---

### Task 7: 사람 확인

정량 기준은 기계가 봤다. 화면이 실제로 나아 보이는지는 사람이 본다.

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 검증**

```bash
npx vitest run > /tmp/verify-test.log 2>&1; tail -6 /tmp/verify-test.log
npx tsc --noEmit > /tmp/verify-tsc.log 2>&1; echo "tsc bytes=$(wc -c < /tmp/verify-tsc.log)"
```
Expected: 전부 PASS, tsc 0바이트

- [ ] **Step 2: 사람에게 화면 확인 요청**

dev 서버(`http://localhost:3500`)에서 아래를 봐 달라고 요청한다.

- 허브(`/`) → 카드뉴스 플로우 → 각 단계를 넘기며 사이드바·헤더·푸터가 정돈돼 보이는지
- 보조 텍스트(사이드바 메타, 푸터 안내)가 읽히는지 — 이전보다 진해졌어야 한다
- 비활성 단계가 "못 누르는 상태"로 보이되 유령처럼 흐리지는 않은지
- 사진 업로드 후 썸네일 자리가 로드 전후로 흔들리지 않는지
- 키보드 Tab 으로 돌 때 포커스 링이 모든 컨트롤에서 보이는지

- [ ] **Step 3: 계획 체크박스를 채우고 커밋**

```bash
git add docs/superpowers/plans/2026-08-01-studio-design-system.md
git commit -m "docs: 스튜디오 UI 개편 계획 완료 표시"
```

---

## 완료 기준

- `npx vitest run` 전부 통과 (대비 테스트·게이트 테스트 포함)
- `npx tsc --noEmit` 0바이트
- `npm run design:audit` — `/cardnews` 접근성 **95 이상**, `color-contrast`·`label` 실패 없음, 폭 스위프 전 구간 통과
- 사람이 화면을 확인

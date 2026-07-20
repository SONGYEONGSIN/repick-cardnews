# RE:픽 카드 스튜디오 구현 계획 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 키워드를 입력하면 Claude가 카피를 생성하고 인스타용 카드 이미지(informationsend 1장 + cardnews 5~6장)를 미리보기·다운로드·폴더 저장하는 Next.js 웹 스튜디오를 만든다.

**Architecture:** Next.js 16(App Router, `src/app/`) 단일 앱. 키워드 → `/api/generate`(Anthropic SDK + `knowledge/` 볼트 주입 → zod 검증 ContentSpec) → 템플릿 React 컴포넌트(1080×1350) 실시간 미리보기 → `html-to-image`로 PNG → 브라우저 다운로드 + `/api/save`로 폴더 저장 + `ledger.jsonl` append. 두 디자인 언어: 앱 껍데기(repick-design 에디토리얼)와 카드 콘텐츠(인스타 감성)를 분리한다.

**Tech Stack:** Next.js 16 · React 19 · TypeScript strict · Tailwind CSS v4(CSS-first) · Pretendard + Gaegu(Google Font) · `@anthropic-ai/sdk` · `zod` · `html-to-image` · `vitest` · npm.

## Global Constraints

- 모델 ID: **`claude-opus-4-8`** (Anthropic 기본. 변경 시 `src/lib/copy-engine.ts` 한 곳만 수정).
- 구조화 출력: `client.messages.parse({ output_config: { format: zodOutputFormat(schema) } })` → `response.parsed_output`. `output_format`(deprecated) 사용 금지.
- `max_tokens: 16000` (비스트리밍 기본), `thinking` 파라미터 미지정(opus-4-8은 미지정 시 thinking off).
- API 키: `ANTHROPIC_API_KEY` (env, 서버 전용). 클라이언트 번들에 절대 노출 금지 → Claude 호출은 반드시 `src/app/api/**/route.ts`(서버)에서만.
- 카드 캔버스: **1080×1350 px 고정 (4:5)**.
- 결정론적 렌더: 템플릿에서 `Math.random()`/`Date.now()`/`new Date()` 금지 (동일 spec → 동일 픽셀).
- path alias: `@/*` → `src/*`.
- 언어: UI 문구·주석 한국어 허용. 커밋 메시지 conventional 접두사(영어) + 한국어 본문.
- 커밋: 각 Task 끝에서 커밋. 저장소가 아직 git이 아니면 Task 1에서 `git init` 먼저.
- 산출물 폴더: 참고 예시는 `knowledge/references/`로 이동, 생성물은 `informationsend/<slug>/`·`cardnews/<slug>/`.

---

### Task 1: 스캐폴드 (Next.js 16 + Tailwind v4 + 폰트 + vitest)

**Files:**
- Create: `package.json`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.env.local.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (임시 플레이스홀더)
- Reference (읽고 미러): `/Users/yss/개발/build/repick-design/app/src/app/layout.tsx`, `/Users/yss/개발/build/repick-design/app/src/app/globals.css`, `/Users/yss/개발/build/repick-design/app/postcss.config.mjs`, `/Users/yss/개발/build/repick-design/app/tsconfig.json`

**Interfaces:**
- Produces: 실행 가능한 Next.js 16 앱(`npm run dev` → :3200), `@/*`→`src/*` alias, Tailwind v4 유틸리티, Pretendard + Gaegu 폰트 로드, `npm test`(vitest) 동작.

- [ ] **Step 1: git 초기화 (저장소 아닌 경우)**

Run: `cd /Users/yss/개발/build/repick-cardnews && git rev-parse --is-inside-work-tree 2>/dev/null || git init`
Expected: 이미 repo면 `true`, 아니면 `Initialized empty Git repository`.

- [ ] **Step 2: repick-design의 config 파일 3개를 읽어 참고**

Run: `cat /Users/yss/개발/build/repick-design/app/postcss.config.mjs /Users/yss/개발/build/repick-design/app/tsconfig.json`
Expected: postcss는 `@tailwindcss/postcss` 플러그인, tsconfig는 `strict:true` + `@/*`→`./src/*`. 이 내용을 아래 파일들에 반영.

- [ ] **Step 3: `package.json` 작성**

```json
{
  "name": "repick-cardnews",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3200",
    "build": "next build",
    "start": "next start -p 3200",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.69.0",
    "html-to-image": "^1.11.13",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 4: `postcss.config.mjs` / `tsconfig.json` / `next.config.ts` / `vitest.config.ts` 작성**

`postcss.config.mjs`:
```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

- [ ] **Step 5: `.gitignore` / `.env.local.example` 작성**

`.gitignore`:
```
node_modules
.next
.env.local
*.tsbuildinfo
next-env.d.ts
.DS_Store
```

`.env.local.example`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 6: `src/app/globals.css` 작성 (Tailwind v4 CSS-first + 폰트)**

```css
@import "tailwindcss";

@theme inline {
  --color-background: #ffffff;
  --color-foreground: #171717;
  --font-sans: "Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif;
  --font-display: "Gaegu", "Pretendard Variable", cursive;
}

html { -webkit-text-size-adjust: 100%; }
body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
  word-break: keep-all;
}
```

- [ ] **Step 7: `src/app/layout.tsx` 작성 (폰트 CDN + metadata)**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RE:픽 카드 스튜디오",
  description: "키워드로 인스타 카드뉴스·정보전달 이미지를 생성합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Do+Hyeon&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

> 참고: Gaegu(손글씨) + Do Hyeon(굵은 고딕) 둘 다 로드 — Task 7에서 테마별로 선택. 카드 폰트 방향은 실측 후 확정.

- [ ] **Step 8: `src/app/page.tsx` 임시 플레이스홀더**

```tsx
export default function Home() {
  return <main className="p-10 text-2xl font-[var(--font-display)]">RE:픽 카드 스튜디오</main>;
}
```

- [ ] **Step 9: 설치 + 빌드 확인**

Run: `cd /Users/yss/개발/build/repick-cardnews && npm install && npm run build`
Expected: `npm install` 성공, `next build` 성공(경고 허용, 에러 없음).

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "chore: Next.js 16 + Tailwind v4 스캐폴드 (repick-design 미러)"
```

---

### Task 2: 참고 예시 이동 + knowledge 볼트 시드

**Files:**
- Move: `informationsend/*.jpeg` → `knowledge/references/informationsend/`, `cardnews/*.jpeg` → `knowledge/references/cardnews/`
- Create: `knowledge/MEMORY.md`, `knowledge/brand-voice.md`, `knowledge/copy-formulas.md`, `knowledge/templates.md`, `knowledge/ledger.jsonl`(빈 파일), `informationsend/.gitkeep`, `cardnews/.gitkeep`

**Interfaces:**
- Produces: `knowledge/brand-voice.md` + `knowledge/copy-formulas.md` — Task 6의 `buildSystemPrompt`가 읽는 텍스트 소스. 원 폴더는 비워져 생성물 저장소로 확보.

- [ ] **Step 1: 참고 예시 이동**

Run:
```bash
cd /Users/yss/개발/build/repick-cardnews
mkdir -p knowledge/references/informationsend knowledge/references/cardnews
git mv informationsend/*.jpeg knowledge/references/informationsend/ 2>/dev/null || mv informationsend/*.jpeg knowledge/references/informationsend/
git mv cardnews/*.jpeg knowledge/references/cardnews/ 2>/dev/null || mv cardnews/*.jpeg knowledge/references/cardnews/
touch informationsend/.gitkeep cardnews/.gitkeep knowledge/ledger.jsonl
```
Expected: `informationsend/`·`cardnews/`엔 `.gitkeep`만, 이미지는 `knowledge/references/` 하위로 이동.

- [ ] **Step 2: `knowledge/brand-voice.md` 작성**

```markdown
# RE:픽 브랜드 보이스 & 톤

## 정체성
RE:픽 — "AI가 다시 고르는 중고". 합리적 소비를 돕는 큐레이션 마켓. 인스타 콘텐츠는 정보성이면서 친근하다.

## 말투 규칙
- 반말 금지, 해요체 기본 ("~해요", "~있어요", "~해보세요").
- 문장은 짧게. 카드 한 장의 헤드라인은 한 호흡(공백 포함 22자 이내 권장).
- 숫자·핵심어는 구체적으로 ("6가지 방법", "24~26℃", "99.9% 차단").

## 금지어 / 지양
- 과장·허위 단정 ("무조건", "100% 보장") 지양.
- 영어 남발 지양(불가피한 고유명사 제외).
- 물음표 남발 금지(후크 1회 정도).

## 이모지
- 카드당 0~2개. 의미 있는 자리에만(💸 비용, ✅ 팁, 🔥 강조).
- 헤드라인 끝 또는 TIP 앞에만. 문장 중간 남발 금지.

## 하이라이트
- 핵심 키워드 1~2개를 형광 하이라이트 대상으로 지정(형광은 템플릿이 렌더).
```

- [ ] **Step 3: `knowledge/copy-formulas.md` 작성**

```markdown
# 카피 공식 & 설득 구조

## informationsend (정보전달 1장)
- 구조: 제목(주제 + "N가지 방법/이유") + 서브카피(한 줄 이득) + 번호 리스트(3~6) + TIP 1줄.
- 각 항목: `keyword`(굵게·하이라이트할 핵심 행동) + `desc`(왜/어떻게 1~2문장).
- 예시 주제: "에어컨 전기세 절약하는 6가지 방법".

## cardnews (설득 시퀀스 5~6장)
설득 흐름: 궁금증 → 문제제기 → 증거 → 해결책 → CTA.

| 장 | role | 목적 | 카피 패턴 |
|----|------|------|-----------|
| 1 | hook | 궁금증·이탈 방지 | "이거 모르면 ~" / "대부분 놓치는 ~" (badge에 짧은 후크) |
| 2 | problem | 공감·문제 인식 | "대부분 ~에서 이탈합니다" |
| 3 | evidence | 신뢰·근거 | "반응 좋은 ~는 공통점이 있어요" (수치·사례) |
| 4 | solution | 해결책 | "이렇게 하세요" (steps로 단계 나열 가능) |
| 5 | cta | 행동 유도 | "저장하고 바로 적용해보세요" (action + handle) |

- 6장으로 늘릴 땐 evidence 또는 solution을 1장 더(근거 보강/단계 세분화). 첫 장은 항상 hook, 마지막은 항상 cta.
- 후크 패턴: 손실 회피("모르면 손해"), 다수 오류("대부분 ~"), 반전("사실은 ~").
```

- [ ] **Step 4: `knowledge/templates.md` + `knowledge/MEMORY.md` 작성**

`knowledge/templates.md`:
```markdown
# 템플릿 카탈로그

| id | 유형 | role | 언제 쓰나 |
|----|------|------|-----------|
| InfographicCard | informationsend | — | 번호 리스트형 정보 1장 |
| HookCard | cardnews | hook | 표지·궁금증 |
| ProblemCard | cardnews | problem | 문제제기 |
| EvidenceCard | cardnews | evidence | 근거·수치 |
| SolutionCard | cardnews | solution | 해결책·단계 |
| CtaCard | cardnews | cta | 저장/팔로우 유도 |

## 테마 (렌더 타임, UI 선택)
- violet-doodle: 보라 + 손글씨(Gaegu) + 두들. 구조/교육형.
- mint-clean: 민트+옐로 하이라이트 + 고딕(Do Hyeon). 정보전달형.
- mono-bold: 흑백 대비 + 굵은 고딕. 임팩트형.
```

`knowledge/MEMORY.md`:
```markdown
# RE:픽 카드 스튜디오 — LLM 위키 인덱스

- [brand-voice.md](brand-voice.md) — 말투·금지어·이모지 규칙 (프롬프트 주입)
- [copy-formulas.md](copy-formulas.md) — 설득 구조·후크 패턴 (프롬프트 주입)
- [templates.md](templates.md) — 레이아웃 카탈로그 + 테마
- [ledger.jsonl](ledger.jsonl) — 생성 이력 + 성과(append-only)
- references/ — 원본 예시 이미지(에어컨/몽벨/구조1·2)
```

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "docs: knowledge 볼트 시드 + 참고 예시 references로 이동"
```

---

### Task 3: ContentSpec zod 스키마 + 픽스처 (TDD)

**Files:**
- Create: `src/lib/schema.ts`, `src/lib/fixtures.ts`
- Test: `src/lib/schema.test.ts`

**Interfaces:**
- Produces:
  - `InfographicSpec` (zod object): `{ type: "informationsend", title: string, subtitle?: string, items: {keyword:string, desc:string}[](3~6), tip?: string }`
  - `CardnewsSpec` (zod object): `{ type: "cardnews", keyword: string, cards: Card[](5~6) }` — `Card`는 role별 discriminated union(hook/problem/evidence/solution/cta), 첫 hook·끝 cta 강제.
  - TS 타입: `InfographicSpec`, `CardnewsSpec`, `ContentSpec = InfographicSpec | CardnewsSpec`, `CardnewsCard`.
  - `infographicFixture`, `cardnewsFixture` (테스트·템플릿 프리뷰용 결정론적 샘플).

- [ ] **Step 1: 실패하는 테스트 작성 (`src/lib/schema.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import { InfographicSpec, CardnewsSpec } from "@/lib/schema";
import { infographicFixture, cardnewsFixture } from "@/lib/fixtures";

describe("InfographicSpec", () => {
  it("유효한 픽스처를 통과시킨다", () => {
    expect(InfographicSpec.safeParse(infographicFixture).success).toBe(true);
  });
  it("items가 2개 이하면 거부한다", () => {
    const bad = { ...infographicFixture, items: infographicFixture.items.slice(0, 2) };
    expect(InfographicSpec.safeParse(bad).success).toBe(false);
  });
});

describe("CardnewsSpec", () => {
  it("유효한 픽스처를 통과시킨다", () => {
    expect(CardnewsSpec.safeParse(cardnewsFixture).success).toBe(true);
  });
  it("첫 카드가 hook이 아니면 거부한다", () => {
    const bad = { ...cardnewsFixture, cards: [...cardnewsFixture.cards].reverse() };
    expect(CardnewsSpec.safeParse(bad).success).toBe(false);
  });
  it("마지막 카드가 cta가 아니면 거부한다", () => {
    const bad = { ...cardnewsFixture, cards: cardnewsFixture.cards.slice(0, -1) };
    expect(CardnewsSpec.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/schema.test.ts`
Expected: FAIL — `@/lib/schema` / `@/lib/fixtures` 모듈 없음.

- [ ] **Step 3: `src/lib/schema.ts` 구현**

```ts
import { z } from "zod";

export const InfographicSpec = z.object({
  type: z.literal("informationsend"),
  title: z.string().min(1).max(40),
  subtitle: z.string().max(60).optional(),
  items: z
    .array(z.object({ keyword: z.string().min(1).max(30), desc: z.string().min(1).max(120) }))
    .min(3)
    .max(6),
  tip: z.string().max(120).optional(),
});

const HookCard = z.object({
  role: z.literal("hook"),
  heading: z.string().min(1).max(40),
  sub: z.string().max(40).optional(),
  badge: z.string().max(20).optional(),
});
const ProblemCard = z.object({ role: z.literal("problem"), heading: z.string().min(1).max(40), body: z.string().min(1).max(120) });
const EvidenceCard = z.object({ role: z.literal("evidence"), heading: z.string().min(1).max(40), body: z.string().min(1).max(120) });
const SolutionCard = z.object({
  role: z.literal("solution"),
  heading: z.string().min(1).max(40),
  body: z.string().min(1).max(120),
  steps: z.array(z.string().max(40)).max(4).optional(),
});
const CtaCard = z.object({
  role: z.literal("cta"),
  heading: z.string().min(1).max(40),
  action: z.string().min(1).max(40),
  handle: z.string().max(30).optional(),
});

export const CardnewsCard = z.discriminatedUnion("role", [
  HookCard, ProblemCard, EvidenceCard, SolutionCard, CtaCard,
]);

export const CardnewsSpec = z
  .object({
    type: z.literal("cardnews"),
    keyword: z.string().min(1).max(40),
    cards: z.array(CardnewsCard).min(5).max(6),
  })
  .refine((v) => v.cards[0]?.role === "hook", { message: "첫 카드는 hook이어야 합니다" })
  .refine((v) => v.cards[v.cards.length - 1]?.role === "cta", { message: "마지막 카드는 cta여야 합니다" });

export type InfographicSpec = z.infer<typeof InfographicSpec>;
export type CardnewsSpec = z.infer<typeof CardnewsSpec>;
export type CardnewsCard = z.infer<typeof CardnewsCard>;
export type ContentSpec = InfographicSpec | CardnewsSpec;
```

- [ ] **Step 4: `src/lib/fixtures.ts` 구현**

```ts
import type { InfographicSpec, CardnewsSpec } from "@/lib/schema";

export const infographicFixture: InfographicSpec = {
  type: "informationsend",
  title: "에어컨 전기세 절약하는 6가지 방법",
  subtitle: "이렇게 사용하면 전기요금 아낄 수 있어요!",
  items: [
    { keyword: "처음엔 파워냉방", desc: "처음 10~20분은 파워냉방으로 빠르게 시원하게! 희망온도에 빨리 도달해요." },
    { keyword: "시원해지면 24~26℃ 유지", desc: "적정온도를 유지하면 전력 소모를 줄일 수 있어요." },
    { keyword: "선풍기와 함께 사용", desc: "공기 순환을 도와 냉방 효율 UP! 체감온도는 낮추고 전기는 절약해요." },
    { keyword: "필터는 2주~1개월마다 청소", desc: "먼지가 쌓이면 냉방 효율이 떨어지고 전기 사용량이 늘어나요." },
    { keyword: "외출 30분 이내면 끄지 말기", desc: "다시 켤 때 더 많은 전기가 들어가요. 짧은 외출은 켜두는 게 절약돼요." },
    { keyword: "실외기 주변 정리하기", desc: "통풍이 잘돼야 냉방 효율이 올라가요. 장애물은 치워주세요." },
  ],
  tip: "에너지소비효율 1등급 제품을 쓰면 전기세 절약에 더 도움이 됩니다.",
};

export const cardnewsFixture: CardnewsSpec = {
  type: "cardnews",
  keyword: "카드뉴스 설계",
  cards: [
    { role: "hook", heading: "이제 카드뉴스는 설득하는 구조가 됩니다", sub: "한 장씩 전환 흐름 만들기", badge: "6/7" },
    { role: "problem", heading: "대부분 첫 장에서 이탈합니다", body: "정보를 나열만 하면 스크롤은 멈추지 않아요." },
    { role: "evidence", heading: "반응 좋은 카드뉴스는 공통점이 있어요", body: "호기심 → 공감 → 신뢰 → 행동의 흐름을 탑니다." },
    { role: "solution", heading: "첫 장부터 이렇게 설계하세요", body: "5장 구조로 나눠 설득선을 만드세요.", steps: ["1장 궁금증", "2장 문제제기", "3장 증거", "4장 해결책", "5장 CTA"] },
    { role: "cta", heading: "저장하고 바로 적용해보세요", action: "이 게시물 저장하기", handle: "@repick" },
  ],
};
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- src/lib/schema.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: ContentSpec zod 스키마 + 픽스처 (TDD)"
```

---

### Task 4: slug + 출력 경로 빌더 (TDD)

**Files:**
- Create: `src/lib/paths.ts`
- Test: `src/lib/paths.test.ts`

**Interfaces:**
- Produces:
  - `slugify(input: string): string` — 공백→`-`, 한글 유지, 특수문자 제거, 소문자화, 연속 `-` 축약.
  - `outputDir(type: "informationsend"|"cardnews", keyword: string, mmdd: string): string` — 예 `cardnews/에어컨전기세-0720`.
  - `outputFile(dir: string, index: number): string` — 예 `cardnews/에어컨전기세-0720/1.png`.

- [ ] **Step 1: 실패하는 테스트 작성 (`src/lib/paths.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import { slugify, outputDir, outputFile } from "@/lib/paths";

describe("slugify", () => {
  it("공백을 하이픈으로, 특수문자를 제거한다", () => {
    expect(slugify("에어컨 전기세!!  절약")).toBe("에어컨-전기세-절약");
  });
  it("영문은 소문자화한다", () => {
    expect(slugify("Mont Bell")).toBe("mont-bell");
  });
});

describe("outputDir / outputFile", () => {
  it("유형/슬러그-날짜 디렉터리를 만든다", () => {
    expect(outputDir("cardnews", "에어컨 전기세", "0720")).toBe("cardnews/에어컨-전기세-0720");
  });
  it("인덱스로 png 경로를 만든다", () => {
    expect(outputFile("cardnews/에어컨-전기세-0720", 1)).toBe("cardnews/에어컨-전기세-0720/1.png");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/paths.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `src/lib/paths.ts` 구현**

```ts
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function outputDir(type: "informationsend" | "cardnews", keyword: string, mmdd: string): string {
  return `${type}/${slugify(keyword)}-${mmdd}`;
}

export function outputFile(dir: string, index: number): string {
  return `${dir}/${index}.png`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/paths.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: slug + 출력 경로 빌더 (TDD)"
```

---

### Task 5: ledger append (TDD)

**Files:**
- Create: `src/lib/ledger.ts`
- Test: `src/lib/ledger.test.ts`

**Interfaces:**
- Consumes: `slugify` (Task 4) 불필요 — 독립.
- Produces: `appendLedger(entry: LedgerEntry, opts?: { file?: string }): Promise<void>` — `knowledge/ledger.jsonl`에 JSON 1줄 append. `LedgerEntry = { ts: string, type: string, keyword: string, count: number, templateIds: string[], model: string, paths: string[], perf: null }`.

- [ ] **Step 1: 실패하는 테스트 작성 (`src/lib/ledger.test.ts`)**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { appendLedger } from "@/lib/ledger";
import { readFileSync, rmSync, existsSync } from "node:fs";

const tmp = "/private/tmp/claude-501/-Users-yss----build-repick-cardnews/27ee7a84-c75c-4dea-9b6f-84c7d386e339/scratchpad/ledger-test.jsonl";

afterEach(() => { if (existsSync(tmp)) rmSync(tmp); });

describe("appendLedger", () => {
  it("JSON 한 줄을 파일 끝에 추가한다", async () => {
    const entry = { ts: "2026-07-20T00:00:00Z", type: "cardnews", keyword: "테스트", count: 5, templateIds: ["hook"], model: "claude-opus-4-8", paths: ["cardnews/x/1.png"], perf: null };
    await appendLedger(entry, { file: tmp });
    await appendLedger(entry, { file: tmp });
    const lines = readFileSync(tmp, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).keyword).toBe("테스트");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/ledger.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `src/lib/ledger.ts` 구현**

```ts
import { appendFile } from "node:fs/promises";
import path from "node:path";

export type LedgerEntry = {
  ts: string;
  type: string;
  keyword: string;
  count: number;
  templateIds: string[];
  model: string;
  paths: string[];
  perf: null;
};

const DEFAULT_FILE = path.join(process.cwd(), "knowledge", "ledger.jsonl");

export async function appendLedger(entry: LedgerEntry, opts?: { file?: string }): Promise<void> {
  await appendFile(opts?.file ?? DEFAULT_FILE, JSON.stringify(entry) + "\n", "utf8");
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/ledger.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: ledger append (TDD)"
```

---

### Task 6: 프롬프트 조립 buildSystemPrompt (TDD)

**Files:**
- Create: `src/lib/prompt.ts`
- Test: `src/lib/prompt.test.ts`

**Interfaces:**
- Produces: `buildSystemPrompt(type: "informationsend"|"cardnews", vault: { brandVoice: string, copyFormulas: string }): string` — 볼트 텍스트를 주입한 system 프롬프트. informationsend/cardnews에 따라 출력 규칙 문장을 다르게 포함. `readVault(dir?: string): Promise<{brandVoice, copyFormulas}>` — `knowledge/` MD 읽기.

- [ ] **Step 1: 실패하는 테스트 작성 (`src/lib/prompt.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/prompt";

const vault = { brandVoice: "해요체 기본", copyFormulas: "hook→problem→evidence→solution→cta" };

describe("buildSystemPrompt", () => {
  it("볼트 텍스트를 프롬프트에 주입한다", () => {
    const p = buildSystemPrompt("cardnews", vault);
    expect(p).toContain("해요체 기본");
    expect(p).toContain("hook→problem→evidence→solution→cta");
  });
  it("유형별 출력 규칙을 포함한다", () => {
    expect(buildSystemPrompt("informationsend", vault)).toContain("informationsend");
    expect(buildSystemPrompt("cardnews", vault)).toContain("cardnews");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/prompt.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `src/lib/prompt.ts` 구현**

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function readVault(dir?: string): Promise<{ brandVoice: string; copyFormulas: string }> {
  const base = dir ?? path.join(process.cwd(), "knowledge");
  const [brandVoice, copyFormulas] = await Promise.all([
    readFile(path.join(base, "brand-voice.md"), "utf8"),
    readFile(path.join(base, "copy-formulas.md"), "utf8"),
  ]);
  return { brandVoice, copyFormulas };
}

export function buildSystemPrompt(
  type: "informationsend" | "cardnews",
  vault: { brandVoice: string; copyFormulas: string },
): string {
  const rule =
    type === "informationsend"
      ? "산출물 유형은 informationsend(1장 인포그래픽). title, 선택 subtitle, items 3~6개(각 keyword+desc), 선택 tip을 생성하라."
      : "산출물 유형은 cardnews(5~6장 설득 시퀀스). cards 배열을 생성하라. 첫 카드는 반드시 role=hook, 마지막은 반드시 role=cta. 중간은 problem/evidence/solution 흐름.";

  return [
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
  ].join("\n");
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/prompt.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: 볼트 주입 system 프롬프트 조립 (TDD)"
```

---

### Task 7: 카드 테마 토큰

**Files:**
- Create: `src/templates/themes.ts`

**Interfaces:**
- Produces: `ThemeId = "violet-doodle" | "mint-clean" | "mono-bold"`, `THEMES: Record<ThemeId, Theme>`, `Theme = { bg, fg, accent, highlight, displayFont, watermark }`(모두 CSS 값 문자열). `THEME_IDS: ThemeId[]`.

- [ ] **Step 1: `src/templates/themes.ts` 작성**

```ts
export type ThemeId = "violet-doodle" | "mint-clean" | "mono-bold";

export type Theme = {
  label: string;
  bg: string;
  fg: string;
  accent: string;
  highlight: string;
  displayFont: string;
  watermark: string;
};

export const THEMES: Record<ThemeId, Theme> = {
  "violet-doodle": {
    label: "보라 두들",
    bg: "#fbfaff",
    fg: "#1a1330",
    accent: "#6E56CF",
    highlight: "#e9defb",
    displayFont: '"Gaegu", cursive',
    watermark: "@repick",
  },
  "mint-clean": {
    label: "민트 클린",
    bg: "#ffffff",
    fg: "#16302a",
    accent: "#0f9d76",
    highlight: "#fff6a8",
    displayFont: '"Do Hyeon", sans-serif',
    watermark: "@repick",
  },
  "mono-bold": {
    label: "모노 볼드",
    bg: "#0f0f10",
    fg: "#ffffff",
    accent: "#ff5a36",
    highlight: "#3a3a3d",
    displayFont: '"Do Hyeon", sans-serif',
    watermark: "@repick",
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
```

- [ ] **Step 2: 타입체크 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add -A && git commit -m "feat: 카드 테마 토큰 3종"
```

---

### Task 8: 카드 프레임 + InfographicCard 템플릿

**Files:**
- Create: `src/templates/CardFrame.tsx`, `src/templates/InfographicCard.tsx`, `src/templates/CardRenderer.tsx`

**Interfaces:**
- Consumes: `InfographicSpec`/`ContentSpec` (Task 3), `Theme`/`ThemeId`/`THEMES` (Task 7).
- Produces:
  - `CardFrame({ theme, children })` — 1080×1350 고정 캔버스 div(배경·패딩·워터마크). export 타겟 노드.
  - `InfographicCard({ spec, themeId })` — informationsend 렌더.
  - `CardRenderer({ spec, themeId, index })` — spec.type에 따라 InfographicCard 또는 (Task 13에서 확장될) cardnews 카드로 분기. informationsend는 index 무시.

- [ ] **Step 1: `src/templates/CardFrame.tsx` 작성**

```tsx
import type { Theme } from "@/templates/themes";

export function CardFrame({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: theme.bg,
        color: theme.fg,
        position: "relative",
        overflow: "hidden",
        padding: 72,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          right: 44,
          fontSize: 26,
          color: theme.accent,
          fontFamily: theme.displayFont,
          opacity: 0.85,
        }}
      >
        {theme.watermark}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/templates/InfographicCard.tsx` 작성**

```tsx
import type { InfographicSpec } from "@/lib/schema";
import { THEMES, type ThemeId } from "@/templates/themes";
import { CardFrame } from "@/templates/CardFrame";

export function InfographicCard({ spec, themeId }: { spec: InfographicSpec; themeId: ThemeId }) {
  const t = THEMES[themeId];
  return (
    <CardFrame theme={t}>
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
              <p style={{ fontSize: 27, lineHeight: 1.45, marginTop: 10, marginBottom: 0, opacity: 0.9 }}>{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
      {spec.tip && (
        <div style={{ marginTop: 20, padding: 22, borderRadius: 18, border: `2px solid ${t.accent}` }}>
          <span style={{ fontFamily: t.displayFont, fontSize: 30, color: t.accent }}>✅ TIP </span>
          <span style={{ fontSize: 27 }}>{spec.tip}</span>
        </div>
      )}
    </CardFrame>
  );
}
```

- [ ] **Step 3: `src/templates/CardRenderer.tsx` 작성 (informationsend 분기만; cardnews는 Task 13에서 추가)**

```tsx
import type { ContentSpec } from "@/lib/schema";
import type { ThemeId } from "@/templates/themes";
import { InfographicCard } from "@/templates/InfographicCard";

export function CardRenderer({ spec, themeId, index }: { spec: ContentSpec; themeId: ThemeId; index: number }) {
  if (spec.type === "informationsend") {
    return <InfographicCard spec={spec} themeId={themeId} />;
  }
  // cardnews 분기는 Task 13에서 CardnewsSlide로 확장
  return <div style={{ width: 1080, height: 1350 }} data-todo-cardnews={index} />;
}
```

- [ ] **Step 4: 임시 미리보기로 육안 확인 (page.tsx에 잠깐 붙여 확인)**

`src/app/page.tsx`를 임시로:
```tsx
import { CardRenderer } from "@/templates/CardRenderer";
import { infographicFixture } from "@/lib/fixtures";

export default function Home() {
  return (
    <main style={{ padding: 40 }}>
      <div style={{ transform: "scale(0.4)", transformOrigin: "top left" }}>
        <CardRenderer spec={infographicFixture} themeId="mint-clean" index={0} />
      </div>
    </main>
  );
}
```
Run: `npm run dev` → 브라우저 http://localhost:3200 에서 에어컨 인포그래픽 카드가 4:5 비율로 렌더되는지 육안 확인(제목·번호·하이라이트·TIP 박스). 확인 후 page.tsx는 Task 12에서 교체.

- [ ] **Step 5: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 에러 없음.
```bash
git add -A && git commit -m "feat: CardFrame + InfographicCard 템플릿"
```

---

### Task 9: Copy Engine `/api/generate` (Claude + 볼트 주입)

> ⚠️ 이 태스크는 Claude 연동 코드 포함. 작성 전 claude-api 스킬 규약 준수: `client.messages.parse` + `zodOutputFormat`, 모델 `claude-opus-4-8`, 키는 서버 env.

**Files:**
- Create: `src/app/api/generate/route.ts`
- Test: `src/app/api/generate/route.test.ts` (입력 검증만 단위 테스트; Claude 호출은 통합에서 수동)

**Interfaces:**
- Consumes: `readVault`, `buildSystemPrompt` (Task 6); `InfographicSpec`, `CardnewsSpec` (Task 3).
- Produces: `POST /api/generate` — body `{ keyword: string, type: "informationsend"|"cardnews" }` → `200 { spec: ContentSpec }` 또는 `400/500 { error }`. 내부에서 `parseBody(raw)`를 export하여 검증 로직 단위 테스트 가능.

- [ ] **Step 1: 실패하는 테스트 작성 (`src/app/api/generate/route.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import { parseBody } from "@/app/api/generate/route";

describe("parseBody", () => {
  it("유효한 입력을 파싱한다", () => {
    expect(parseBody({ keyword: "에어컨 전기세", type: "cardnews" })).toEqual({ keyword: "에어컨 전기세", type: "cardnews" });
  });
  it("빈 키워드를 거부한다", () => {
    expect(() => parseBody({ keyword: "  ", type: "cardnews" })).toThrow();
  });
  it("잘못된 type을 거부한다", () => {
    expect(() => parseBody({ keyword: "x", type: "banner" })).toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/app/api/generate/route.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `src/app/api/generate/route.ts` 구현**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { InfographicSpec, CardnewsSpec, type ContentSpec } from "@/lib/schema";
import { readVault, buildSystemPrompt } from "@/lib/prompt";

const MODEL = "claude-opus-4-8";

const BodySchema = z.object({
  keyword: z.string().trim().min(1, "키워드를 입력하세요").max(60),
  type: z.enum(["informationsend", "cardnews"]),
});

export function parseBody(raw: unknown): z.infer<typeof BodySchema> {
  return BodySchema.parse(raw);
}

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = parseBody(await req.json());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "잘못된 요청" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다" }, { status: 500 });
  }

  try {
    const vault = await readVault();
    const system = buildSystemPrompt(body.type, vault);
    const format = body.type === "informationsend" ? InfographicSpec : CardnewsSpec;

    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: `키워드: "${body.keyword}"\n위 키워드로 콘텐츠 카피를 생성하세요.` }],
      output_config: { format: zodOutputFormat(format) },
    });

    const spec = response.parsed_output as ContentSpec | null;
    if (!spec) {
      return Response.json({ error: "카피 생성 결과가 스키마와 맞지 않습니다. 다시 시도해주세요." }, { status: 502 });
    }
    return Response.json({ spec });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "생성 중 오류" }, { status: 500 });
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/app/api/generate/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 실제 Claude 호출 수동 통합 확인 (키 있을 때)**

Run:
```bash
cp .env.local.example .env.local   # ANTHROPIC_API_KEY 실제 값 채우기 (사용자)
npm run dev
# 다른 터미널:
curl -s -X POST http://localhost:3200/api/generate -H 'content-type: application/json' \
  -d '{"keyword":"에어컨 전기세 절약","type":"informationsend"}' | head -c 400
```
Expected: `{"spec":{"type":"informationsend","title":...}}` JSON. 키 미설정 시 500(정상 — 위 단위 테스트로 코드경로는 검증됨).

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "feat: /api/generate 카피 엔진 (Claude + 볼트 주입)"
```

---

### Task 10: export 유틸 (html-to-image)

**Files:**
- Create: `src/lib/export.ts`

**Interfaces:**
- Produces: `exportNodeToPng(node: HTMLElement): Promise<Blob>` — 1080×1350 실측 해상도 PNG Blob. 폰트 로드 보장(`document.fonts.ready`). `downloadBlob(blob: Blob, filename: string): void`, `blobToBase64(blob: Blob): Promise<string>`.

- [ ] **Step 1: `src/lib/export.ts` 작성**

```ts
import { toBlob } from "html-to-image";

export async function exportNodeToPng(node: HTMLElement): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
  const blob = await toBlob(node, {
    width: 1080,
    height: 1350,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: undefined,
  });
  if (!blob) throw new Error("이미지 변환에 실패했습니다");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 에러 없음.
```bash
git add -A && git commit -m "feat: html-to-image export 유틸"
```

---

### Task 11: `/api/save` (폴더 저장 + ledger)

**Files:**
- Create: `src/app/api/save/route.ts`

**Interfaces:**
- Consumes: `slugify`,`outputDir`,`outputFile` (Task 4); `appendLedger` (Task 5).
- Produces: `POST /api/save` — body `{ type, keyword, mmdd, images: string[](base64 png), templateIds: string[] }` → 프로젝트 루트의 `<type>/<slug>-<mmdd>/N.png` 저장 + ledger append → `200 { dir, paths }`. base64 디코드는 서버에서.

- [ ] **Step 1: `src/app/api/save/route.ts` 작성**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { outputDir, outputFile } from "@/lib/paths";
import { appendLedger } from "@/lib/ledger";

const MODEL = "claude-opus-4-8";

const BodySchema = z.object({
  type: z.enum(["informationsend", "cardnews"]),
  keyword: z.string().min(1),
  mmdd: z.string().regex(/^\d{4}$/),
  images: z.array(z.string().min(1)).min(1).max(6),
  templateIds: z.array(z.string()),
});

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "잘못된 요청" }, { status: 400 });
  }

  try {
    const relDir = outputDir(body.type, body.keyword, body.mmdd);
    const absDir = path.join(process.cwd(), relDir);
    await mkdir(absDir, { recursive: true });

    const paths: string[] = [];
    for (let i = 0; i < body.images.length; i++) {
      const rel = outputFile(relDir, i + 1);
      await writeFile(path.join(process.cwd(), rel), Buffer.from(body.images[i], "base64"));
      paths.push(rel);
    }

    await appendLedger({
      ts: new Date().toISOString(),
      type: body.type,
      keyword: body.keyword,
      count: body.images.length,
      templateIds: body.templateIds,
      model: MODEL,
      paths,
      perf: null,
    });

    return Response.json({ dir: relDir, paths });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "저장 중 오류" }, { status: 500 });
  }
}
```

> 주: `/api/save` route는 `new Date().toISOString()`을 서버에서 호출 — 템플릿 결정론 규칙과 무관(ledger 타임스탬프용). `mmdd`는 클라이언트가 계산해 전달.

- [ ] **Step 2: 타입체크 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add -A && git commit -m "feat: /api/save 폴더 저장 + ledger append"
```

---

### Task 12: 스튜디오 UI (informationsend 관통)

**Files:**
- Create: `src/app/studio.tsx` (client component), `src/lib/useGenerate.ts`
- Modify: `src/app/page.tsx` (Task 8 임시본을 studio로 교체)

**Interfaces:**
- Consumes: `CardRenderer` (Task 8), `THEMES`/`THEME_IDS` (Task 7), `exportNodeToPng`/`downloadBlob`/`blobToBase64` (Task 10), `slugify` (Task 4), `ContentSpec` (Task 3).
- Produces: 키워드 입력 → 유형(informationsend/cardnews) + 테마 선택 → "생성하기"(`POST /api/generate`) → 캐러셀 미리보기 → "PNG 다운로드" + "폴더에 저장"(`POST /api/save`). 앱 껍데기는 repick-design 에디토리얼 미감(stone/violet, 여백, Pretendard).

- [ ] **Step 1: `src/app/studio.tsx` 작성**

```tsx
"use client";

import { useRef, useState } from "react";
import type { ContentSpec } from "@/lib/schema";
import { CardRenderer } from "@/templates/CardRenderer";
import { THEMES, THEME_IDS, type ThemeId } from "@/templates/themes";
import { exportNodeToPng, downloadBlob, blobToBase64 } from "@/lib/export";
import { slugify } from "@/lib/paths";

type GenType = "informationsend" | "cardnews";

export function Studio() {
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<GenType>("informationsend");
  const [themeId, setThemeId] = useState<ThemeId>("mint-clean");
  const [spec, setSpec] = useState<ContentSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const cardCount = spec?.type === "cardnews" ? spec.cards.length : 1;

  async function generate() {
    setBusy(true); setError(null); setSpec(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setSpec(data.spec);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  function mmdd(): string {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }

  async function collectPngs(): Promise<Blob[]> {
    const out: Blob[] = [];
    for (let i = 0; i < cardCount; i++) {
      const node = cardRefs.current[i];
      if (node) out.push(await exportNodeToPng(node.firstElementChild as HTMLElement));
    }
    return out;
  }

  async function downloadAll() {
    if (!spec) return;
    setBusy(true);
    try {
      const blobs = await collectPngs();
      const slug = slugify(keyword) || "card";
      blobs.forEach((b, i) => downloadBlob(b, `${slug}-${i + 1}.png`));
    } finally { setBusy(false); }
  }

  async function saveToFolder() {
    if (!spec) return;
    setBusy(true); setError(null);
    try {
      const blobs = await collectPngs();
      const images = await Promise.all(blobs.map(blobToBase64));
      const templateIds =
        spec.type === "cardnews" ? spec.cards.map((c) => c.role) : ["InfographicCard"];
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, keyword, mmdd: mmdd(), images, templateIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      alert(`저장 완료: ${data.dir} (${data.paths.length}장)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 오류");
    } finally { setBusy(false); }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#faf9f7", color: "#1c1917" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 24px", display: "grid", gridTemplateColumns: "360px 1fr", gap: 40 }}>
        {/* 좌측: 컨트롤 (도구 = 차갑게) */}
        <section>
          <p style={{ letterSpacing: "0.28em", fontSize: 12, textTransform: "uppercase", color: "#78716c" }}>RE:PICK STUDIO</p>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: "8px 0 28px" }}>카드 스튜디오</h1>

          <label style={{ fontSize: 13, color: "#57534e" }}>키워드</label>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="예: 에어컨 전기세 절약"
            style={{ width: "100%", marginTop: 6, marginBottom: 20, padding: "12px 14px", borderRadius: 10, border: "1px solid #e7e5e4", fontSize: 15 }}
          />

          <div style={{ fontSize: 13, color: "#57534e", marginBottom: 6 }}>유형</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["informationsend", "cardnews"] as GenType[]).map((t) => (
              <button key={t} onClick={() => setType(t)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #e7e5e4", background: type === t ? "#1c1917" : "#fff", color: type === t ? "#fff" : "#1c1917", cursor: "pointer" }}>
                {t === "informationsend" ? "정보전달" : "카드뉴스"}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 13, color: "#57534e", marginBottom: 6 }}>테마</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {THEME_IDS.map((id) => (
              <button key={id} onClick={() => setThemeId(id)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: themeId === id ? "2px solid #c2410c" : "1px solid #e7e5e4", background: THEMES[id].bg, color: THEMES[id].fg, fontSize: 12, cursor: "pointer" }}>
                {THEMES[id].label}
              </button>
            ))}
          </div>

          <button onClick={generate} disabled={busy || !keyword.trim()}
            style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: "#c2410c", color: "#fff", fontSize: 16, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: !keyword.trim() ? 0.5 : 1 }}>
            {busy ? "생성 중…" : "생성하기"}
          </button>

          {spec && (
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={downloadAll} disabled={busy} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #1c1917", background: "#fff", cursor: "pointer" }}>PNG 다운로드</button>
              <button onClick={saveToFolder} disabled={busy} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: "#1c1917", color: "#fff", cursor: "pointer" }}>폴더에 저장</button>
            </div>
          )}
          {error && <p style={{ color: "#dc2626", marginTop: 14, fontSize: 14 }}>⚠ {error}</p>}
        </section>

        {/* 우측: 미리보기 캐러셀 (산출물 = 뜨겁게) */}
        <section>
          {!spec && <div style={{ height: 480, borderRadius: 16, border: "1px dashed #d6d3d1", display: "flex", alignItems: "center", justifyContent: "center", color: "#a8a29e" }}>키워드를 입력하고 생성하기를 누르세요</div>}
          {spec && (
            <div style={{ display: "flex", gap: 24, overflowX: "auto", paddingBottom: 12 }}>
              {Array.from({ length: cardCount }).map((_, i) => (
                <div key={i} style={{ flex: "0 0 auto" }}>
                  <div style={{ fontSize: 12, color: "#78716c", marginBottom: 6 }}>{i + 1} / {cardCount}</div>
                  {/* 축소 미리보기: 실제 노드(cardRefs)의 firstElementChild가 1080×1350 원본 */}
                  <div ref={(el) => { cardRefs.current[i] = el; }} style={{ width: 324, height: 405, overflow: "hidden", borderRadius: 12, border: "1px solid #e7e5e4" }}>
                    <div style={{ transform: "scale(0.3)", transformOrigin: "top left" }}>
                      <CardRenderer spec={spec} themeId={themeId} index={i} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
```

> export 시 축소 transform이 결과에 영향 주지 않도록: `cardRefs.current[i].firstElementChild`(scale wrapper)가 아니라 **원본 1080×1350 노드**를 캡처해야 함. 위 `collectPngs`는 `node.firstElementChild`(= scale wrapper 안의 CardRenderer 루트)를 넘긴다. html-to-image는 명시된 `width/height`로 캡처하므로 부모의 scale은 무시되고 원본 크기로 렌더된다. Step 3에서 육안 검증.

- [ ] **Step 2: `src/app/page.tsx` 교체**

```tsx
import { Studio } from "@/app/studio";
export default function Home() {
  return <Studio />;
}
```

- [ ] **Step 3: informationsend 관통 육안 검증**

Run: `npm run dev` → http://localhost:3200
- 키워드 "에어컨 전기세 절약" 입력 → 유형 "정보전달" → 테마 "민트 클린" → 생성하기.
- 미리보기에 1장 인포그래픽 표시 확인.
- "PNG 다운로드" → 1080×1350 PNG가 다운로드되고 잘림·폰트 깨짐 없는지 확인.
- "폴더에 저장" → `informationsend/<slug>-<mmdd>/1.png` 생성 + `knowledge/ledger.jsonl`에 1줄 추가 확인:
```bash
ls informationsend/ && tail -1 knowledge/ledger.jsonl
```
Expected: png 존재, ledger에 informationsend 엔트리.

- [ ] **Step 4: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 에러 없음.
```bash
git add -A && git commit -m "feat: 스튜디오 UI + informationsend 생성→미리보기→저장 관통"
```

---

### Task 13: cardnews 템플릿 5종

**Files:**
- Create: `src/templates/CardnewsSlide.tsx`
- Modify: `src/templates/CardRenderer.tsx` (cardnews 분기 연결)

**Interfaces:**
- Consumes: `CardnewsSpec`/`CardnewsCard` (Task 3), `THEMES`/`ThemeId` (Task 7), `CardFrame` (Task 8).
- Produces: `CardnewsSlide({ card, themeId, badge })` — role(hook/problem/evidence/solution/cta)별 레이아웃을 한 컴포넌트에서 스위치. `CardRenderer`가 cardnews일 때 `spec.cards[index]`를 넘겨 렌더.

- [ ] **Step 1: `src/templates/CardnewsSlide.tsx` 작성**

```tsx
import type { CardnewsCard } from "@/lib/schema";
import { THEMES, type ThemeId } from "@/templates/themes";
import { CardFrame } from "@/templates/CardFrame";

export function CardnewsSlide({ card, themeId, badge }: { card: CardnewsCard; themeId: ThemeId; badge: string }) {
  const t = THEMES[themeId];
  const Heading = ({ children }: { children: React.ReactNode }) => (
    <h1 style={{ fontFamily: t.displayFont, fontSize: 72, lineHeight: 1.22, margin: 0 }}>{children}</h1>
  );
  const Body = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize: 34, lineHeight: 1.5, marginTop: 28, opacity: 0.92 }}>{children}</p>
  );
  const RoleTag = ({ label }: { label: string }) => (
    <span style={{ display: "inline-block", fontFamily: t.displayFont, fontSize: 30, color: t.bg, background: t.accent, padding: "6px 20px", borderRadius: 999, marginBottom: 28 }}>{label}</span>
  );

  return (
    <CardFrame theme={t}>
      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 26, color: t.accent }}>{badge}</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {card.role === "hook" && (
          <>
            {card.badge && <RoleTag label={card.badge} />}
            <Heading>{card.heading}</Heading>
            {card.sub && <Body>{card.sub}</Body>}
          </>
        )}
        {card.role === "problem" && (<><RoleTag label="문제" /><Heading>{card.heading}</Heading><Body>{card.body}</Body></>)}
        {card.role === "evidence" && (<><RoleTag label="증거" /><Heading>{card.heading}</Heading><Body>{card.body}</Body></>)}
        {card.role === "solution" && (
          <>
            <RoleTag label="해결책" />
            <Heading>{card.heading}</Heading>
            <Body>{card.body}</Body>
            {card.steps && (
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
                {card.steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 30 }}>
                    <span style={{ width: 44, height: 44, borderRadius: 999, background: t.highlight, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.displayFont }}>{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {card.role === "cta" && (
          <div style={{ textAlign: "center" }}>
            <Heading>{card.heading}</Heading>
            <div style={{ marginTop: 40, display: "inline-block", fontFamily: t.displayFont, fontSize: 40, color: t.bg, background: t.accent, padding: "18px 40px", borderRadius: 20 }}>{card.action}</div>
            {card.handle && <p style={{ marginTop: 28, fontSize: 30, opacity: 0.8 }}>{card.handle}</p>}
          </div>
        )}
      </div>
    </CardFrame>
  );
}
```

- [ ] **Step 2: `src/templates/CardRenderer.tsx` 수정 (cardnews 연결)**

`data-todo-cardnews` 분기를 아래로 교체:
```tsx
import type { ContentSpec } from "@/lib/schema";
import type { ThemeId } from "@/templates/themes";
import { InfographicCard } from "@/templates/InfographicCard";
import { CardnewsSlide } from "@/templates/CardnewsSlide";

export function CardRenderer({ spec, themeId, index }: { spec: ContentSpec; themeId: ThemeId; index: number }) {
  if (spec.type === "informationsend") {
    return <InfographicCard spec={spec} themeId={themeId} />;
  }
  const card = spec.cards[index];
  return <CardnewsSlide card={card} themeId={themeId} badge={`${index + 1} / ${spec.cards.length}`} />;
}
```

- [ ] **Step 3: cardnews 픽스처로 육안 검증 (page 임시 스위치)**

`src/app/page.tsx`를 임시로 픽스처 5장 렌더로 바꿔 확인 후 되돌린다:
```tsx
import { CardRenderer } from "@/templates/CardRenderer";
import { cardnewsFixture } from "@/lib/fixtures";
export default function Home() {
  return (
    <main style={{ display: "flex", gap: 16, padding: 24, overflowX: "auto" }}>
      {cardnewsFixture.cards.map((_, i) => (
        <div key={i} style={{ transform: "scale(0.28)", transformOrigin: "top left", width: 302, height: 378 }}>
          <CardRenderer spec={cardnewsFixture} themeId="violet-doodle" index={i} />
        </div>
      ))}
    </main>
  );
}
```
Run: `npm run dev` → 5장(hook/problem/evidence/solution/cta) 레이아웃이 각기 다르게 렌더되는지 확인. 확인 후 page.tsx를 Studio로 되돌린다:
```tsx
import { Studio } from "@/app/studio";
export default function Home() { return <Studio />; }
```

- [ ] **Step 4: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 에러 없음.
```bash
git add -A && git commit -m "feat: cardnews 템플릿 5종 (hook/problem/evidence/solution/cta)"
```

---

### Task 14: cardnews 전체 관통 (생성→다중 카드→저장)

**Files:** (신규 없음 — Task 9/12/13 조합 검증)

**Interfaces:**
- Consumes: 전체 파이프라인. Studio가 cardnews를 선택했을 때 `/api/generate`→N장 미리보기→`collectPngs`가 N장 캡처→`/api/save`가 `cardnews/<slug>-<mmdd>/1..N.png` 저장.

- [ ] **Step 1: cardnews end-to-end 육안 검증**

Run: `npm run dev` → http://localhost:3200 (키 설정 시)
- 키워드 "카드뉴스 잘 만드는 법" → 유형 "카드뉴스" → 테마 "보라 두들" → 생성하기.
- 미리보기 캐러셀에 5~6장 표시, 각 장 role 레이아웃 상이 확인.
- "PNG 다운로드" → 5~6개 PNG 다운로드.
- "폴더에 저장" → 확인:
```bash
ls cardnews/*/ && tail -1 knowledge/ledger.jsonl
```
Expected: `cardnews/<slug>-<mmdd>/1.png … N.png`, ledger에 cardnews 엔트리(count 5~6, templateIds에 role들).

- [ ] **Step 2: 키 없을 때 에러 UX 확인**

`.env.local`의 키를 잠깐 비우고 생성 → UI에 "ANTHROPIC_API_KEY가 설정되지 않았습니다" 표시(에러 삼키지 않음) 확인 후 키 복구.

- [ ] **Step 3: 커밋 (검증 문서/스냅샷 없으면 no-op, 있으면 커밋)**

```bash
git add -A && git commit -m "test: cardnews 전체 파이프라인 관통 검증" --allow-empty
```

---

### Task 15: 최종 검증 + README

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: 실행/환경변수/폴더 규칙 문서. 전체 lint/build/test 통과 확인.

- [ ] **Step 1: `README.md` 작성**

```markdown
# RE:픽 카드 스튜디오

키워드 → Claude 카피 생성 → 인스타 카드 이미지(informationsend 1장 / cardnews 5~6장) 미리보기·다운로드·폴더 저장.

## 실행
1. `npm install`
2. `cp .env.local.example .env.local` 후 `ANTHROPIC_API_KEY` 입력
3. `npm run dev` → http://localhost:3200

## 산출물 폴더
- `informationsend/<키워드슬러그>-<MMDD>/1.png`
- `cardnews/<키워드슬러그>-<MMDD>/1.png … N.png`
- 참고 예시: `knowledge/references/`

## 지식관리 (`knowledge/`)
- `brand-voice.md` / `copy-formulas.md` → 생성 프롬프트에 주입
- `templates.md` → 레이아웃·테마 카탈로그
- `ledger.jsonl` → 생성 이력(append-only)

## 스택
Next.js 16 · React 19 · Tailwind v4 · Anthropic SDK(claude-opus-4-8) · zod · html-to-image
```

- [ ] **Step 2: 전체 검증**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 테스트 전부 PASS, 타입 에러 없음, 빌드 성공.

- [ ] **Step 3: 커밋**

```bash
git add -A && git commit -m "docs: README + 최종 검증"
```

---

## Self-Review 메모 (작성자용)
- 스펙 §5 유닛 7개 매핑: Vault=Task2/6, Copy Engine=Task9, Schema=Task3, Template=Task8/13, Export=Task10, Save=Task11, Studio UI=Task12 ✅
- 스펙 §7 ContentSpec(theme 분리)=Task3 스키마 + Task12에서 themeId를 render prop로 주입 ✅
- 스펙 §10 폴더 규약=Task2(이동)+Task4(경로)+Task11(저장) ✅
- 스펙 §11 에러 처리=Task9/11 명시적 에러 반환 + Task12 UI 표시, Task14 Step2 키-미설정 UX 검증 ✅
- 스펙 §12 테스트=Task3/4/5/6/9 단위 TDD + Task12/13/14 육안 E2E ✅
- 타입 일관성: `ContentSpec`/`CardnewsCard`/`ThemeId`/`InfographicSpec`/`CardnewsSpec` 명칭 전 태스크 통일 ✅
- Claude 연동: `messages.parse` + `zodOutputFormat` + `parsed_output`, 모델 `claude-opus-4-8`, 서버 route 전용 ✅
```

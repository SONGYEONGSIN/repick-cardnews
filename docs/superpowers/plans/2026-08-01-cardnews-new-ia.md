# 카드뉴스 새 IA 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/lab2` 시안을 실제 동작하는 카드뉴스 플로우로 승격한다 — 5단계를 3화면으로 줄이고 D2 무채색 디자인을 입힌다.

**Architecture:** 단계 게이트를 reducer 옆 순수 함수로 뽑아 테스트로 고정하고, 시안 컴포넌트를 제품 경로로 옮기며 샘플 데이터를 실제 상태·dispatch 로 바꾼다. 정보전달이 쓰는 기존 셸은 그대로 두고 새 셸을 나란히 둔다.

**Tech Stack:** Next.js 16 (App Router), TypeScript 5.7, Tailwind v4, vitest 3, lucide-react

설계 근거: `docs/superpowers/specs/2026-08-01-cardnews-new-ia-design.md`

## Global Constraints

- **새 화면은 액센트 색을 쓰지 않는다.** 강조는 `bg-ink text-surface` 와 굵기로 만든다. 단 `plum` 토큰을 지우지 않는다 — 정보전달 플로우가 아직 쓴다.
- 새 화면의 폰트 웨이트는 **400 / 700 / 900**. 기존 화면(정보전달)의 400/600/800 은 건드리지 않는다.
- **툴바에는 데이터 모델이 이미 받는 것만 올린다** — 구성(`layout`), 초점(`focal`), 글 배경(`scrim`), 사진 높이(`band`), 사진 바꾸기(`SWAP_IN`). 글자 크기·정렬·글 위치·사진 배율은 `CardDraft` 에 필드가 없으므로 **넣지 않는다**(조각 2).
- **건드리지 않는다**: `src/features/shell/StudioShell.tsx`·`StepRail.tsx`, `src/features/infosend/**`, `src/templates/**`, `src/lib/claude-cli.ts`, `src/features/studio/useExport.ts`·`CaptureStage.tsx`
- `any` 타입, 타입 단언(`as`, `!`), `@ts-ignore`, `@ts-expect-error`, `eslint-disable` 금지. 토큰 객체의 `as const` 는 예외.
- 컴포넌트에 하드코딩 색상 금지. `console.log` 금지.
- RED → GREEN → 커밋 순서. 테스트가 처음부터 통과하면 그 테스트는 다시 쓴다.
- 커밋 메시지는 conventional 영문 접두사 + 한국어, 제목 50자 이내.
- 파일은 400줄 이하. `npx tsc --noEmit` 은 항상 0바이트.

**테스트 환경 제약:** `vitest.config.ts` 가 `environment: "node"` 라 **React 렌더 테스트를 쓸 수 없다**(jsdom 없음). 이 계획은 jsdom 을 추가하지 않는다 — 대신 판단 로직을 순수 함수로 뽑아 테스트하고, 화면은 폭 스위프·Lighthouse·사람 확인으로 검증한다.

**실행 명령:** `npx vitest run <파일>` · `npx tsc --noEmit` · dev 서버는 `http://localhost:3500`

---

### Task 1: 단계 게이트를 순수 함수로 뽑고 단계 의미를 0~2 로

화면을 옮기기 전에 **언제 다음 화면으로 갈 수 있는가**를 먼저 못 박는다. 이게 순수 함수라 유일하게 단위 테스트가 가능한 부분이고, 화면 구현이 여기에 기댄다.

**Files:**
- Modify: `src/features/cardnews/reducer.ts`
- Test: `src/features/cardnews/reducer.test.ts` (덧붙임)

**Interfaces:**
- Consumes: 기존 `CardnewsState`, `canLeaveOrder(state)`
- Produces:
  - `canLeaveTopic(state: CardnewsState): boolean`
  - `canLeaveWorkbench(state: CardnewsState): boolean`
  - `initialCardnewsState.step === 0`, `maxReached === 0`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/cardnews/reducer.test.ts` 맨 아래에 덧붙인다. `import` 는 파일 위쪽 기존 import 에 합친다.

```ts
import { canLeaveTopic, canLeaveWorkbench } from "./reducer";

describe("단계 게이트", () => {
  it("주제 화면은 키워드가 있어야 넘어간다", () => {
    expect(canLeaveTopic({ ...initialCardnewsState, keyword: "" })).toBe(false);
    expect(canLeaveTopic({ ...initialCardnewsState, keyword: "   " })).toBe(false);
    expect(canLeaveTopic({ ...initialCardnewsState, keyword: "에어컨 전기세" })).toBe(true);
  });

  it("만들기 화면은 사진 5~6장과 생성된 카피가 둘 다 있어야 넘어간다", () => {
    const five = ["a", "b", "c", "d", "e"];
    const base = { ...initialCardnewsState, keyword: "에어컨" };

    // 사진만 있고 카피가 없으면 못 넘어간다
    expect(canLeaveWorkbench({ ...base, order: five })).toBe(false);
    // 카피만 있고 사진이 모자라면 못 넘어간다
    expect(canLeaveWorkbench({ ...base, order: ["a"], cards: [CARD] })).toBe(false);
    // 둘 다 있어야 넘어간다
    expect(canLeaveWorkbench({ ...base, order: five, cards: [CARD] })).toBe(true);
  });

  it("사진이 7장이면 넘어가지 못한다", () => {
    const seven = ["a", "b", "c", "d", "e", "f", "g"];
    expect(canLeaveWorkbench({ ...initialCardnewsState, order: seven, cards: [CARD] })).toBe(false);
  });

  it("처음 단계는 0 이다", () => {
    expect(initialCardnewsState.step).toBe(0);
    expect(initialCardnewsState.maxReached).toBe(0);
  });
});
```

이 블록 바로 위에 테스트용 카드 한 장을 둔다.

```ts
const CARD: CardDraft = {
  id: "card-1",
  photoId: "a",
  layout: "full-bleed",
  focal: { x: 0.5, y: 0.5 },
  scrim: 0.7,
  band: 0.45,
  copy: { role: "hook", heading: "후크" },
};
```

`CardDraft` 타입 import 가 파일에 없으면 기존 import 줄에 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/cardnews/reducer.test.ts`
Expected: FAIL — `canLeaveTopic is not a function` 그리고 "처음 단계는 0 이다" 가 현재 값 1 로 실패

- [ ] **Step 3: 구현**

`src/features/cardnews/reducer.ts` 의 `initialCardnewsState` 에서 `step: 1` → `step: 0`, `maxReached: 1` → `maxReached: 0` 으로 바꾼다.

`canLeaveOrder` 아래에 두 함수를 덧붙인다.

```ts
/** 주제 화면 → 만들기 화면. 키워드 없이는 카피를 만들 수 없다. */
export function canLeaveTopic(state: CardnewsState): boolean {
  return state.keyword.trim().length > 0;
}

/**
 * 만들기 화면 → 내보내기 화면.
 *
 * 사진 장수와 카피 생성 여부를 **둘 다** 본다. 예전에는 두 단계로 나뉘어 각각 걸렸지만
 * 한 화면으로 합쳐졌으므로 한 곳에서 판정한다.
 */
export function canLeaveWorkbench(state: CardnewsState): boolean {
  return canLeaveOrder(state) && state.cards.length > 0;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/cardnews/reducer.test.ts`
Expected: PASS

Run: `npx vitest run`
Expected: 전부 PASS — 기존 테스트는 단계 번호를 참조하지 않으므로 영향이 없어야 한다. 하나라도 깨지면 **고치기 전에 보고한다**

- [ ] **Step 5: 커밋**

```bash
git add src/features/cardnews/reducer.ts src/features/cardnews/reducer.test.ts
git commit -m "feat: 단계 게이트를 순수 함수로 뽑고 단계를 0~2 로"
```

---

### Task 2: 브랜드 마크와 D2 셸을 제품 경로로 이관

시안 코드를 라우트 폴더 밖으로 꺼낸다. `src/app/lab2/` 는 라우트지 컴포넌트 보관소가 아니다.

**Files:**
- Create: `src/components/brand/Mark.tsx` (원본 `src/app/lab2/Mark.tsx`)
- Create: `src/features/shell/StudioFrame.tsx` (원본 `src/app/lab2/Frame.tsx`)

**Interfaces:**
- Consumes: `FOCUS_RING` (`@/components/ui`)
- Produces:
  - `Logo({ size?: "md" | "lg" })`, `StudioMark({ size?, label? })`, `SeomamWordmark({ height?, label? })` — `@/components/brand/Mark`
  - `StudioFrame({ step, summary?, title, action?, children })` — `step: number`(0~2), `summary?: readonly { label: string; value: string }[]`
  - `SolidButton({ children, size?, disabled? })`, `LineButton({ children })`, `SectionHead({ title, aside? })`, `STEPS` — 같은 파일

- [ ] **Step 1: 파일 옮기기**

```bash
mkdir -p src/components/brand
git mv src/app/lab2/Mark.tsx src/components/brand/Mark.tsx
git mv src/app/lab2/Frame.tsx src/features/shell/StudioFrame.tsx
```

- [ ] **Step 2: 이름과 import 정리**

`src/features/shell/StudioFrame.tsx` 에서 `export function Frame(` 를 `export function StudioFrame(` 로 바꾸고, `import { Logo, StudioMark } from "./Mark";` 를 `import { Logo, StudioMark } from "@/components/brand/Mark";` 로 바꾼다.

`src/app/lab2/` 에 남은 파일들(`page.tsx`·`Hub.tsx`·`Workbench.tsx`·`Export.tsx`·`Canvas.tsx`·`Editor.tsx`)의 import 를 새 경로로 고친다 — `./Frame` → `@/features/shell/StudioFrame`, `./Mark` → `@/components/brand/Mark`, `Frame` → `StudioFrame`. 시안은 Task 7 에서 지우지만 그전까지 깨져 있으면 안 된다.

- [ ] **Step 3: 확인**

Run: `npx tsc --noEmit`
Expected: 출력 없음

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3500/lab2`
Expected: `200` — dev 서버가 안 떠 있으면 `npm run dev > /tmp/dev.log 2>&1 &` 후 6초 기다린다

- [ ] **Step 4: 커밋**

```bash
git add -A src/components/brand src/features/shell src/app/lab2
git commit -m "refactor: 브랜드 마크와 D2 셸을 제품 경로로 이관"
```

---

### Task 3: 주제 화면과 화면 전환

첫 화면을 실제로 띄운다. 이 태스크가 끝나면 `/cardnews` 가 새 디자인으로 열린다.

**Files:**
- Create: `src/features/cardnews/screens/TopicScreen.tsx`
- Modify: `src/features/cardnews/CardnewsFlow.tsx`

**Interfaces:**
- Consumes: `canLeaveTopic` (Task 1), `StudioFrame`·`SolidButton`·`SectionHead` (Task 2)
- Produces: `TopicScreen({ state, dispatch, onNext }: { state: CardnewsState; dispatch: Dispatch<CardnewsAction>; onNext: () => void })`

- [ ] **Step 1: 주제 화면 만들기**

`src/app/lab2/Hub.tsx` 를 원본으로 삼아 `src/features/cardnews/screens/TopicScreen.tsx` 를 만든다. 마크업은 그대로 두고 아래만 바꾼다.

- 지역 `useState` 두 개(`kind`, `keyword`)를 **제거**하고 `state.keyword` 와 `dispatch({ type: "SET_KEYWORD", keyword })` 로 바꾼다
- 종류 선택(카드뉴스/정보전달)은 **표시만 하고 카드뉴스를 고정 선택**으로 둔다. 정보전달은 조각 3 이라 아직 이 플로우에서 전환할 수 없다 — 정보전달 카드는 `disabled` 로 두고 "곧" 대신 아무 배지도 붙이지 않는다(거짓말이 된다). 대신 `href="/info"` 인 링크로 두어 기존 플로우로 보낸다
- 최근 목록(`RECENT` 상수)은 **제거**한다. 실제 데이터는 `readRecent` 가 주는데 이 화면은 클라이언트 컴포넌트라 서버에서 읽을 수 없다. 조각 2 로 미루고, 그 자리에 아무것도 두지 않는다 — 빈 목록을 가짜로 보여 주지 않는다
- "사진 올리러 가기" 버튼의 `disabled` 를 `!canLeaveTopic(state)` 로 묶고 `onClick={onNext}` 를 건다
- `<Frame step={0} title="새로 만들기">` → `<StudioFrame step={0} title="새로 만들기">`

- [ ] **Step 2: 화면 전환 재작성**

`src/features/cardnews/CardnewsFlow.tsx` 를 아래로 바꾼다. `STEPS` 상수와 `gate()` 함수, `StudioShell` import 를 지운다.

```tsx
"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { CaptureStage } from "@/features/studio/CaptureStage";
import { useExport } from "@/features/studio/useExport";
import { TopicScreen } from "./screens/TopicScreen";
import { toRenderCards } from "./render";
import { cardnewsReducer, initialCardnewsState } from "./reducer";

export function CardnewsFlow() {
  const [state, dispatch] = useReducer(cardnewsReducer, initialCardnewsState);
  const router = useRouter();
  const { registerRef } = useExport();

  const go = (step: number) => dispatch({ type: "SET_STEP", step });

  return (
    <>
      {state.step === 0 && <TopicScreen state={state} dispatch={dispatch} onNext={() => go(1)} />}

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

`router` 와 `useExport` 의 나머지 값은 Task 5·6 에서 쓴다. 지금 미사용 변수가 생기면 그 줄을 잠시 빼 두고, 해당 태스크에서 되살린다 — **미사용 변수를 남기지 않는다**.

- [ ] **Step 3: 확인**

Run: `npx tsc --noEmit`
Expected: 출력 없음

Run: `curl -s http://localhost:3500/cardnews | grep -c "무슨 이야기를 카드로 만들까요"`
Expected: `1`

- [ ] **Step 4: 커밋**

```bash
git add src/features/cardnews
git commit -m "feat: 주제 화면을 실제 상태에 물림"
```

---

### Task 4: 편집 표면 — 캔버스와 툴바

만들기 화면의 두 조각을 먼저 만든다. 이 둘이 이 개편의 핵심이고 나머지는 배치다.

**Files:**
- Create: `src/features/cardnews/parts/CardCanvas.tsx` (원본 `src/app/lab2/Canvas.tsx`)
- Create: `src/features/cardnews/parts/EditToolbar.tsx` (원본 `src/app/lab2/Editor.tsx`)

**Interfaces:**
- Consumes: `CardDraft` (`../reducer`), `Photo` (`@/lib/photos`), `LAYOUT_LABELS`·`CardLayout` (`@/lib/layout-assign`)
- Produces:
  - `export type EditTarget = "heading" | "body" | "photo" | "card"` — **`EditToolbar.tsx` 에서 export 하고 `CardCanvas.tsx` 가 그것을 import 한다**(시안의 `Editor.tsx`/`Canvas.tsx` 관계 그대로). 두 곳에 정의하지 않는다
  - `CardCanvas({ card, photo, target, onSelect, onPatch })`
    - `card: CardDraft`, `photo: Photo | undefined`, `target: EditTarget`
    - `onSelect: (t: EditTarget) => void`
    - `onPatch: (patch: Partial<Omit<CardDraft, "id">>) => void`
  - `EditToolbar({ card, target, onSelect, onPatch, onSwapPhoto })`
    - `onSwapPhoto: () => void`

- [ ] **Step 1: 캔버스 만들기**

`src/app/lab2/Canvas.tsx` 를 원본으로 `src/features/cardnews/parts/CardCanvas.tsx` 를 만든다. 바꿀 것:

- `SampleCard` → `CardDraft`. `card.heading` → `card.copy.heading`, `card.body` → `"body" in card.copy ? card.copy.body : undefined`, `card.action` → `card.copy.role === "cta" ? card.copy.action : undefined`
- 사진 자리표시자(`TONE_CLASS`)를 실제 사진으로 바꾼다. 사진이 있으면 `<img src={photo.thumbUrl} alt={photo.name} className="h-full w-full object-cover" />`, 없으면 `bg-hair-soft` 빈 면. **`next/image` 를 쓰지 않는다** — blob URL 은 최적화할 수 없다(`design-gate` 가 `no-raw-img` 를 넣지 않은 이유)
- 초점 핸들의 위치를 `card.focal` 에 묶는다: `style` 대신 `left`/`top` 을 Tailwind 로 표현할 수 없으므로, 핸들만 인라인 `style={{ left: `${card.focal.x * 100}%`, top: `${card.focal.y * 100}%` }}` 를 쓰고 그 줄에 왜 인라인인지 주석을 단다(값이 연속이라 클래스로 표현 불가 — 기존 `SortableSlot.tsx` 가 dnd-kit transform 에 같은 예외를 둔 선례가 있다)
- 사진 위 포인터 드래그로 `onPatch({ focal })` 를 호출한다. `onPointerDown` 에서 `setPointerCapture`, `onPointerMove` 에서 요소 사각형 대비 비율을 구해 0~1 로 클램프
- 인라인 편집은 `onBlur` 에서 `onPatch({ copy: { ...card.copy, heading: e.currentTarget.textContent ?? "" } })` 로 반영한다

- [ ] **Step 2: 툴바 만들기**

`src/app/lab2/Editor.tsx` 를 원본으로 `src/features/cardnews/parts/EditToolbar.tsx` 를 만든다. 바꿀 것:

- **글자 크기·정렬·글 위치·배율 그룹을 전부 제거한다** — `CardDraft` 에 필드가 없다(Global Constraints)
- 남기는 컨트롤과 배선:
  - 구성 → `onPatch({ layout })`
  - 글 배경(`full-bleed`) → `onPatch({ scrim: v / 100 })`, 값은 `Math.round(card.scrim * 100)`
  - 사진 높이(`split`) → `onPatch({ band: v / 100 })`, 값은 `Math.round(card.band * 100)`
  - 사진 바꾸기 → `onSwapPhoto()`
  - 형광 버튼과 "손해" 배지는 **제거**한다(조각 2)
  - 글자수는 `card.copy.heading.length` / 40, 본문은 120 으로 실제 값에 묶는다
- `LAYOUT_LABEL` 은 `src/app/lab/wb/data.ts` 가 아니라 `@/lib/layout-assign` 의 `LAYOUT_LABELS` 를 쓴다

- [ ] **Step 3: 확인**

Run: `npx tsc --noEmit`
Expected: 출력 없음 — 아직 아무도 이 컴포넌트를 쓰지 않으므로 타입만 맞으면 된다

- [ ] **Step 4: 커밋**

```bash
git add src/features/cardnews/parts
git commit -m "feat: 편집 캔버스와 툴바를 실제 카드 모델에 물림"
```

---

### Task 5: 만들기 화면 조립

사진·순서·편집이 한 화면에서 돌아가게 한다.

**Files:**
- Create: `src/features/cardnews/screens/WorkbenchScreen.tsx`
- Modify: `src/features/cardnews/CardnewsFlow.tsx`

**Interfaces:**
- Consumes: `CardCanvas`·`EditToolbar`·`EditTarget` (Task 4), `canLeaveWorkbench` (Task 1), `slotPhotos`·`trayPhotos` (기존 reducer)
- Produces: `WorkbenchScreen({ state, dispatch, onPrev, onNext })`

- [ ] **Step 1: 화면 만들기**

`src/app/lab2/Workbench.tsx` 를 원본으로 삼는다. 바꿀 것:

- 지역 상태 둘을 둔다: `const [selected, setSelected] = useState(0)`, `const [target, setTarget] = useState<EditTarget>("heading")`. **reducer 에 넣지 않는다** — 저장할 값이 아니다
- 순서 레일은 `slotPhotos(state)` 로 그리고, 칩을 누르면 `setSelected(i)`
- 안 쓴 사진은 `trayPhotos(state)`. 누르면 `dispatch({ type: "SWAP_IN", slotIndex: selected, photoId })`
- "사진 추가" 는 `Dropzone` 을 띄운다 — `src/features/photos/Dropzone.tsx` 를 그대로 쓰고 `onPhotos={(photos) => dispatch({ type: "ADD_PHOTOS", photos })}`, `onError={(m) => dispatch({ type: "SET_ERROR", error: m })}`
- 세트 바의 테마는 `state.themeId` / `dispatch({ type: "SET_THEME", themeId })`, 핸들은 `state.handle` / `SET_HANDLE`. **제목 서체 그룹은 제거**한다(데이터 모델에 없다)
- 카피 생성 버튼: 사진이 5장 이상일 때만 활성. `requestSpec` 을 써서 생성하고 `dispatch({ type: "SET_SPEC", spec })`. 생성 중에는 `SET_BUSY`, 실패하면 `SET_ERROR`
- `state.cards.length === 0` 이면 캔버스 자리에 빈 상태를 보여 준다 — "사진을 올리고 카피를 만들면 여기에 카드가 나와요"
- 오류(`state.error`)가 있으면 툴바 위에 한 줄로 보여 준다
- 헤더 액션의 "내보내기" 는 `disabled={!canLeaveWorkbench(state)}` 에 `onClick={onNext}`. 되돌리기/다시 실행 버튼은 **제거**한다(조각 2)

카피 생성 코드:

```tsx
async function generate() {
  dispatch({ type: "SET_BUSY", busy: true });
  try {
    const spec = await requestSpec<CardnewsSpec>({
      type: "cardnews",
      keyword: state.keyword,
      photos: slotPhotos(state).map((p) => p.thumbUrl),
    });
    dispatch({ type: "SET_SPEC", spec });
  } catch (e) {
    dispatch({ type: "SET_ERROR", error: e instanceof Error ? e.message : "카피 생성에 실패했어요." });
  } finally {
    dispatch({ type: "SET_BUSY", busy: false });
  }
}
```

`requestSpec` 은 `@/features/studio/useGenerate` 에 있다. **보내는 것은 `thumbUrl` 이지 `dataUrl` 이 아니다** — `Photo` 는 둘을 다 갖는데 `dataUrl` 은 원본(PNG 캡처용)이고 `thumbUrl` 이 최장변을 줄인 Claude 전송용이다. 원본을 보내면 페이로드가 몇 배로 커진다.

- [ ] **Step 2: 흐름에 연결**

`CardnewsFlow.tsx` 에 추가한다.

```tsx
{state.step === 1 && (
  <WorkbenchScreen state={state} dispatch={dispatch} onPrev={() => go(0)} onNext={() => go(2)} />
)}
```

- [ ] **Step 3: 확인**

Run: `npx tsc --noEmit`
Expected: 출력 없음

Run: `npx vitest run`
Expected: 전부 PASS

- [ ] **Step 4: 커밋**

```bash
git add src/features/cardnews
git commit -m "feat: 사진·순서·편집을 한 화면으로 합침"
```

---

### Task 6: 내보내기 화면

**Files:**
- Create: `src/features/cardnews/screens/ExportScreen.tsx`
- Modify: `src/features/cardnews/CardnewsFlow.tsx`

**Interfaces:**
- Consumes: `useExport()` → `{ registerRef, download, saveToFolder }`
- Produces: `ExportScreen({ state, onPrev, onDownload, onSave })`

- [ ] **Step 1: 화면 만들기**

`src/app/lab2/Export.tsx` 를 원본으로 삼되 **캡션·해시태그·올리기 섹션을 전부 제거**한다(조각 2). 남기는 것:

- 제목과 안내 문구
- "다섯 장 이어 보기" — `state.cards` 를 실제로 그린다. 각 카드는 `CardCanvas` 를 재사용하지 말고 읽기 전용 축소 렌더로 둔다(편집 표면이 아니다)
- "저장될 파일" — `state.cards.length` 개의 `N.png` 목록과 폴더 경로. 폴더 경로는 `outputDir("cardnews", state.keyword, mmdd())` 로 만든다(`@/lib/paths`, `@/features/studio/useGenerate`)
- 헤더 액션: "폴더 열기" 대신 **"내려받기"**(`onDownload`)와 **"저장"**(`onSave`) 두 개. 인자는 아래 Step 2 에 그대로 적어 뒀다 — 기존 `CardnewsFlow.tsx` 가 쓰던 것과 같다

- [ ] **Step 2: 흐름에 연결**

```tsx
{state.step === 2 && (
  <ExportScreen
    state={state}
    onPrev={() => go(1)}
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
```

- [ ] **Step 3: 확인**

Run: `npx tsc --noEmit` · `npx vitest run`
Expected: 출력 없음 / 전부 PASS

- [ ] **Step 4: 커밋**

```bash
git add src/features/cardnews
git commit -m "feat: 내보내기 화면을 새 디자인으로 교체"
```

---

### Task 7: 옛 화면과 시안 폴더 제거

**Files:**
- Delete: `src/features/cardnews/steps/` 전체(5개), `src/features/cardnews/parts/CardInspector.tsx`, `src/app/lab/`, `src/app/lab2/`

- [ ] **Step 1: 지우기**

```bash
git rm -r src/features/cardnews/steps src/app/lab src/app/lab2
git rm src/features/cardnews/parts/CardInspector.tsx
```

- [ ] **Step 2: 남은 참조 확인**

```bash
grep -rn "steps/TopicStep\|steps/PhotosStep\|steps/OrderStep\|steps/ComposeStep\|steps/ExportStep\|CardInspector\|app/lab" src/ || echo "참조 없음"
```
Expected: `참조 없음`

`src/features/infosend/**` 에도 `steps/` 폴더가 있다 — **그건 지우지 않는다.** 위 명령은 `src/features/cardnews/steps` 만 지정한다.

- [ ] **Step 3: 확인**

Run: `npx tsc --noEmit` · `npx vitest run` · `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3500/info`
Expected: 출력 없음 / 전부 PASS / `200` — 정보전달 플로우가 멀쩡해야 한다

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "chore: 옛 카드뉴스 단계 화면과 시안 폴더 제거"
```

---

### Task 8: 브라우저 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 폭 스위프**

dev 서버를 띄운 상태에서 `/cardnews` 를 390 / 768 / 1024 / 1280 / 1440 / 1920 에서 확인한다. `document.documentElement.scrollWidth` 가 뷰포트 폭을 넘지 않아야 한다. 기존 `scripts/design-audit.mjs` 를 그대로 쓰거나 같은 방식으로 잰다.

Expected: 전 폭 오버플로 0

- [ ] **Step 2: Lighthouse 접근성**

`/cardnews` 를 감사한다.

```bash
npx lighthouse http://localhost:3500/cardnews --only-categories=accessibility \
  --output=json --output-path=/tmp/lh.json --chrome-flags="--headless" --quiet
```
Expected: 95 이상. 미달이면 실패 감사 항목을 고치고 다시 잰다.

기본 렌더 뷰는 주제 화면뿐이라 만들기·내보내기 화면은 이 감사에 안 잡힌다. **그 사실을 리포트에 적는다** — 두 화면의 접근성은 Task 9 의 사람 확인과 코드 정독으로 대신한다.

- [ ] **Step 3: 디자인 게이트와 전체 검증**

Run: `npx vitest run` · `npx tsc --noEmit`
Expected: 전부 PASS / 출력 없음

- [ ] **Step 4: 커밋 (고친 게 있을 때만)**

```bash
git add -A && git commit -m "fix: 폭 오버플로와 접근성 미달 교정"
```

---

### Task 9: 사람 확인

기계가 못 보는 것을 사람이 본다. 이 도구는 사진이 있어야 끝까지 돌아가므로 실제 사진이 필요하다.

**Files:** 없음

- [ ] **Step 1: 사용자에게 요청**

`http://localhost:3500/cardnews` 에서 아래를 확인해 달라고 요청한다.

- 주제를 넣고 다음으로 넘어가는가
- 사진 폴더를 올리면 순서 레일이 채워지는가
- 카피 생성이 되고 캔버스에 카드가 나오는가
- 캔버스에서 헤드라인을 눌러 그 자리에서 고칠 수 있는가
- 사진 위를 끌어 초점이 움직이는가
- 구성(가득/분할/글만)을 바꾸면 프리뷰가 따라오는가
- 내보내기로 넘어가 저장이 되는가
- 정보전달 플로우(`/info`)가 예전처럼 멀쩡한가

- [ ] **Step 2: 계획 체크박스를 채우고 커밋**

```bash
git add docs/superpowers/plans/2026-08-01-cardnews-new-ia.md
git commit -m "docs: 카드뉴스 새 IA 계획 완료 표시"
```

---

## 완료 기준

- `npx vitest run` 전부 통과, `npx tsc --noEmit` 0바이트
- `/cardnews` 폭 스위프 전 구간 오버플로 0, Lighthouse 접근성 95 이상
- `/info` 정보전달 플로우가 그대로 동작
- 사람이 주제 → 만들기 → 내보내기를 실제 사진으로 한 번 완주

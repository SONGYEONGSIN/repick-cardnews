# 정보전달 맞추기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정보전달을 카드뉴스와 같은 흐름·같은 도구로 맞추고, **사진 없이도** 만들 수 있게 한다.

**Architecture:** 이미지 변환 경로(`src/templates/**` → `html-to-image` → 1080×1350 PNG)는 그대로 쓴다 — 이미 두 형식이 공유한다. 바꾸는 것은 흐름(4단계 → 3화면)과 편집 표면(옆 패널 → 캔버스 직접), 그리고 사진이 없을 때의 그림이다. 내보내기·예약·소재 찾기는 **카드뉴스가 쓰는 부품을 그대로 재사용**한다.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, zod v4, vitest(`environment: "node"`)

## Global Constraints

- **한국어만.** 모든 문구는 한국어. `inKorean(raw, fallback)`(`@/features/cardnews/screens/errors`)
- **`docs/ui-standards.md` 를 따른다** — 패널 골격(제목/구분선/박스), 폭(`max-w` 로 절반 비우지 않기, `ch` 금지), 2단(테두리 박스는 늘리고 글은 `items-start`), 호버(선=배경, 채움=`opacity-85`), 빈 자리 박스는 `PLACEHOLDER_BOX`
- **렌더 테스트 불가**(`environment: "node"`). 판단은 순수 함수로 빼서 테스트하고 컴포넌트에는 JSX·배선만 남긴다
- **손으로 베낀 값은 테스트로 묶는다** — 스키마 상한 등
- **`git add -A` 금지.** 만든 경로만. `.claude/`·`.env.local` 이 미추적으로 있다
- **정렬 게이트를 늘린다** — 나란한 것을 새로 만들면 `scripts/design-audit.mjs` 의 `정렬` 절에 한 줄 추가
- `any`·`@ts-ignore`·`eslint-disable`·`console.*` 금지
- **RED 먼저.** 실패를 실행으로 확인한 뒤 구현한다

### 확인된 현재 상태 — 그대로 쓴다

| 무엇 | 값 |
|---|---|
| `InfoState` | `step, maxReached, photos, selectedPhotoId, keyword, themeId, handle, band, bandTouched, focal, spec, error, busy` |
| 막고 있는 것 | `canLeavePhoto(state) = selectedPhoto(state) !== null` (`reducer.ts:68`) |
| 렌더 진입 | `toRenderCard(state): RenderCard \| null`, `layout: "split"`, `photoUrl: … ?? null` |
| 레이아웃 | `SplitPhotoCard` — 사진 높이 `Math.round(1350 * band)`, `photoUrl` 이 있을 때만 `<img>` |
| 본문 | `InfographicBody` — 제목·부제·항목·팁 |
| 스펙 | `InfographicSpec`: `title`(≤40) · `subtitle?`(≤60) · `items` 3~6개(`keyword` ≤30 · `desc` ≤120) · `tip?`(≤120) |
| 흐름 | `InfoFlow` 4단계: 사진 · 주제 · 편집 · 내보내기 |

---

## 순서 — 조각마다 혼자 동작한다

1. **사진 선택사항 + 제목 띠**(Task 1~3) — 끝나면 사진 없이 만들어진다
2. **3화면 IA + 캔버스 편집**(Task 4~6)
3. **내보내기 이식**(Task 7)
4. **소재 찾기 · 점검 · 게이트**(Task 8~9)

---

### Task 1: 사진 없는 카드의 제목 띠

**Files:**
- Modify: `src/templates/layouts/SplitPhotoCard.tsx`, `src/templates/CardRenderer.tsx`, `src/templates/bodies/InfographicBody.tsx`
- Test: `src/templates/infographic-band.test.ts` (신규, 순수 함수만)

**설계**: 사진이 없으면 사진 자리를 **`theme.accent` 로 채운 띠**로 바꾸고 **제목을 그 안에** 넣는다. 본문은 그때 자기 제목을 그리지 않는다(중복 방지).

- 띠 높이는 **제목 길이에 맞춘다**(고정 `band` 아님) — 사진이 없는데 화면의 40%를 빈 색으로 두면 낭비다
- 사진이 있으면 지금 그대로다. **띠는 사진의 대역**이지 별개 모드가 아니다
- 띠 위 글자는 `theme.onPhoto`(여섯 테마 모두 흰색), 배경은 `theme.accent` — `themes.test.ts` 가 이미 이 조합의 대비를 지킨다

**Interfaces:**
- Produces: `titleInBand(photoUrl: string | null, layout: string): boolean` — 제목을 띠에 넣을지. `CardRenderer` 와 `InfographicBody` 가 **같은 함수**로 판단해 어긋나지 않게 한다
- `SplitPhotoCard` 에 `bandTitle?: string` 추가 — 있으면 사진 대신 그 제목을 띠로 그린다

- [ ] **Step 1: 실패하는 테스트 작성**

`src/templates/infographic-band.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { titleInBand } from "@/templates/infographic-band";

describe("titleInBand — 제목을 띠에 넣을지", () => {
  it("split 레이아웃에 사진이 없으면 띠에 넣는다", () => {
    expect(titleInBand(null, "split")).toBe(true);
  });

  it("사진이 있으면 넣지 않는다 — 사진이 그 자리를 쓴다", () => {
    expect(titleInBand("data:image/png;base64,AAA", "split")).toBe(false);
  });

  it("split 이 아니면 넣지 않는다 — 카드뉴스 경로를 건드리지 않는다", () => {
    expect(titleInBand(null, "full-bleed")).toBe(false);
    expect(titleInBand(null, "text-only")).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/templates/infographic-band.test.ts`

- [ ] **Step 3: 구현**

`src/templates/infographic-band.ts`:

```ts
/**
 * 사진이 없는 정보전달 카드는 사진 자리를 **테마 색 띠**로 바꾸고 제목을 그 안에 넣는다.
 *
 * 이 판단을 **한 함수로 둔다** — `CardRenderer`(띠를 그릴지)와 `InfographicBody`(제목을
 * 건너뛸지)가 각자 판단하면 어긋나 제목이 두 번 나오거나 하나도 안 나온다.
 */
export function titleInBand(photoUrl: string | null, layout: string): boolean {
  return layout === "split" && photoUrl === null;
}
```

`SplitPhotoCard` 에 `bandTitle` 을 받아, `photoUrl` 이 없고 `bandTitle` 이 있으면 사진 대신
`theme.accent` 배경 + `theme.onPhoto` 글자로 제목을 그린다. 높이는 내용에 맞춘다(`padding` 으로).

`InfographicBody` 는 `titleInBand(...)` 이 참이면 자기 제목을 그리지 않는다.

- [ ] **Step 4: 통과 확인** — `npx vitest run && npx tsc --noEmit`
- [ ] **Step 5: 커밋**

```bash
git add src/templates/infographic-band.ts src/templates/infographic-band.test.ts \
        src/templates/layouts/SplitPhotoCard.tsx src/templates/CardRenderer.tsx \
        src/templates/bodies/InfographicBody.tsx
git commit -m "feat: 사진 없는 정보전달의 제목 띠"
```

---

### Task 2: 사진을 선택사항으로

**Files:**
- Modify: `src/features/infosend/reducer.ts`
- Test: `src/features/infosend/reducer.test.ts`

**Interfaces:**
- `canLeavePhoto(state)` 를 **항상 `true`** 로 바꾼다 — 사진 없이도 다음으로 간다
- 기존 호출부(`InfoFlow`)는 그대로 동작해야 한다

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("사진이 없어도 다음 단계로 갈 수 있다 — 사진은 선택이다", () => {
  expect(canLeavePhoto(initialInfoState)).toBe(true);
});

it("사진이 있어도 막지 않는다", () => {
  const s = infoReducer(initialInfoState, { type: "ADD_PHOTOS", photos: [photo("p1")] });
  expect(canLeavePhoto(s)).toBe(true);
});
```

기존에 "사진을 골라야 다음으로 간다"를 단언하던 테스트가 있으면 **왜 바꿨는지 주석과 함께 갱신한다**(사진은 선택이 됐다).

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 함수 본문을 `true` 로 바꾸고, 주석에 "렌더는 이미 `photoUrl` 이 없어도 되게 돼 있었다(`toRenderCard`) — 흐름만 막고 있었다"를 남긴다
- [ ] **Step 4: 통과 확인** + `curl -s -o /dev/null -w "%{http_code}" localhost:3500/info` → 200
- [ ] **Step 5: 커밋**

---

### Task 3: 사진 단계를 선택으로 보이게

**Files:**
- Modify: `src/features/infosend/steps/PhotoStep.tsx`, `src/features/infosend/InfoFlow.tsx`

**규칙:**
- 사진 단계에 **"사진 없이 만들기"** 를 분명히 둔다 — 지금은 사진을 올려야만 다음 버튼이 살아 보인다
- 문구로 알린다: "사진이 없으면 제목을 색 띠로 그려요."
- `PLACEHOLDER_BOX` 를 쓴다(`docs/ui-standards.md` §6)

- [ ] **Step 1: 화면 수정** (렌더 테스트 불가 — 판단이 생기면 순수 함수로 뺀다)
- [ ] **Step 2: `npx tsc --noEmit` + `npx vitest run`**
- [ ] **Step 3: `npm run design:audit` 29/29**
- [ ] **Step 4: 커밋**

**여기까지가 1단계다. 이 시점에 사진 없이 정보전달을 만들 수 있어야 한다.**

---

### Task 4: 3화면 IA — 주제 화면

**Files:**
- Create: `src/features/infosend/screens/InfoTopicScreen.tsx`
- Modify: `src/features/infosend/InfoFlow.tsx`, `src/features/infosend/reducer.ts`

**규칙:**
- `StudioFrame step={0} title="새로 만들기"` — 카드뉴스 `TopicScreen` 과 **같은 골격**
- 주제 입력이 화면의 축. 형태 고르기(카드뉴스/정보전달)는 카드뉴스 화면과 같은 모양
- `SET_STEP` 을 0·1·2 로 재정의한다. `maxReached` 도 그에 맞춘다
- 순수 함수 `canLeaveInfoTopic(state)` 을 만들어 테스트한다(주제가 비었으면 못 나간다)

- [ ] Step 1~5: RED → 구현 → 통과 → 게이트 → 커밋

---

### Task 5: 3화면 IA — 만들기 화면(캔버스 직접 편집)

**Files:**
- Create: `src/features/infosend/screens/InfoWorkbenchScreen.tsx`, `src/features/infosend/parts/InfoCanvas.tsx`, `src/features/infosend/parts/InfoToolbar.tsx`
- Modify: `src/features/infosend/InfoFlow.tsx`

**규칙:**
- **캔버스 == 출력.** `InfoCanvas` 는 `InfographicBody`·`SplitPhotoCard` 와 **같은 값·같은 계산**을 쓴다. 카드뉴스 `CardCanvas` 가 그 본보기다 — 인라인 `style` 은 연속값·테마 값에만 쓰고 각각 이유 주석을 단다
- 제목·부제·항목·팁을 **그 자리에서** 고친다(`contentEditable="plaintext-only"` + `innerText`, 공백 정규화 — `CardCanvas` 와 같은 방식)
- 툴바는 **조작 줄 / 안내 줄**(`docs/ui-standards.md` §1). 탭: `제목` `항목` `사진` `카드` `테마`
- 항목 추가·삭제·순서 바꾸기는 기존 액션(`ADD_ITEM`·`REMOVE_ITEM`·`REORDER_ITEM`)을 그대로 쓴다
- 스펙 상한(항목 3~6, 글자 수)을 **테스트로 스키마와 묶는다**

- [ ] Step 1~5

---

### Task 6: 3화면 IA — 옛 단계 정리

**Files:**
- Delete: `src/features/infosend/steps/PhotoStep.tsx`, `TopicStep.tsx`, `ComposeStep.tsx`
- Modify: `src/features/infosend/InfoFlow.tsx`

**규칙:**
- **본인 변경이 만든 orphan 만 정리한다.** 새 화면이 대체한 파일만 지운다
- `ExportStep` 은 Task 7 에서 대체하므로 **여기서 지우지 않는다**
- 지운 파일을 참조하던 테스트가 있으면 새 화면 기준으로 옮긴다

- [ ] Step 1~4

---

### Task 7: 내보내기 이식

**Files:**
- Create: `src/features/infosend/screens/InfoExportScreen.tsx`
- Delete: `src/features/infosend/steps/ExportStep.tsx`

**규칙 — 부품을 재사용한다:**
- `FileSavePanel`·`SharePanel`·`InstagramPublishPanel`(예약 포함)은 **이미지 배열에만 기댄다**. 정보전달(1장)도 그대로 쓸 수 있다
- **단일 이미지 게시 경로를 새로 만든다.** 확인한 사실(2026-08-04): `src/lib/instagram.ts` 에는
  캐러셀 경로만 있다(`media_type: "CAROUSEL"`, `is_carousel_item: "true"`) — Graph API 는 2장
  미만 캐러셀을 거부하므로(`CAROUSEL_MIN_ITEMS = 2`) **지금 코드로 정보전달 1장은 못 올린다**
- 단일 이미지는 캐러셀보다 **단순하다**: 컨테이너 하나(`image_url` + `caption`, `is_carousel_item`
  없이) → `media_publish`. 캐러셀의 아이템 준비·묶기 두 단계가 빠진다
- 캡션 초안은 `defaultCaption(keyword, headings)` 를 쓰되 `headings` 자리에 제목·항목 키워드를 넣는다
- 내보내는 방법 고르기 구조와 `저장될 파일` 배치는 카드뉴스와 같게(`docs/ui-standards.md`)

- [ ] **Step 1: `publishSingleImage` 테스트 작성**(RED) — 컨테이너 요청에 `is_carousel_item` 이
      **없어야** 하고, `media_type` 을 캐러셀로 보내지 않아야 한다. 실패는 `friendlyPublishError`
      로 한국어가 되고 토큰이 안 섞여야 한다. **실제 인스타를 부르지 마라 — mock 만**
- [ ] **Step 2: 실패 확인 → 구현** — 기존 `waitUntilReady`·진행 보고(`onProgress`)를 재사용한다
- [ ] **Step 3: `/api/publish` 가 장수에 따라 갈라지게** — 1장이면 단일, 2~10장이면 캐러셀.
      **예약 발행(`schedule-runner`)도 같은 갈림을 탄다**
- [ ] Step 4~6: 화면 → 통과 → 게이트 → 커밋

---

### Task 8: 소재 찾기 · 점검 목록

**Files:**
- Modify: `src/features/infosend/screens/InfoTopicScreen.tsx`, `InfoWorkbenchScreen.tsx`
- Create: `src/features/infosend/checks.ts` + 테스트

**규칙:**
- 소재 찾기는 `MaterialFinderScreen` 을 **그대로 재사용**한다 — 주제만 채우면 되므로 형식과 무관하다
- 점검 목록은 카드뉴스 `workbenchChecks` 와 **같은 모양**(`{ tone, text }`)으로 만들되 정보전달 기준으로: 빈 제목 / 빈 항목 / 글자 수 초과 / 항목 수가 3개 미만
- **사진 없음은 경고가 아니다** — 선택이다

- [ ] Step 1~5 (RED 먼저, 순수 함수로)

---

### Task 9: 정렬 게이트 확장

**Files:**
- Modify: `scripts/design-audit.mjs`

**규칙:**
- 지금 `정렬` 절은 카드뉴스만 밟는다. **정보전달 경로를 추가한다** — `/info` 에서 주제 입력 → (사진 없이) 만들기 → 내보내기
- 카피 생성은 **가짜 응답으로 가로챈다**(`{ spec: … }` 형태, `InfographicSpec`). 진짜로 부르면 사용자 할당량을 쓴다
- 나란한 박스의 `top`·`height` 가 같은지 본다

- [ ] **Step 1: 게이트 추가**
- [ ] **Step 2: 통과 확인** — `npm run design:audit`
- [ ] **Step 3: 일부러 깨뜨려 FAIL 이 나는지 확인하고 되돌린다.** 통과만 하는 검사는 아무것도 검증하지 않는다
- [ ] **Step 4: 커밋**

---

## 사람이 확인해야 하는 것

브라우저가 로컬 dev 서버에 닿지 않아 자동 검증이 불가능하다.

- 사진 없이 정보전달을 끝까지 만들 수 있는가
- 제목 띠가 테마를 바꾸면 함께 바뀌는가
- 사진을 넣으면 예전처럼 사진이 그 자리에 들어가는가
- 캔버스에서 제목·항목·팁을 직접 고칠 수 있는가
- 내보내기 세 방법과 예약이 카드뉴스와 같게 동작하는가
- **인스타 1장 게시** — 정보전달을 실제로 한 번 올려 본다(자동 테스트는 mock 뿐이다)

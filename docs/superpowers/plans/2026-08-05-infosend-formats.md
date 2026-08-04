# 정보전달 형식 5종 구현 계획

설계: `docs/superpowers/specs/2026-08-05-infosend-formats-design.md`

**순서 원칙** — 조각마다 혼자 동작한다. 각 태스크가 끝난 시점에 화면이 깨져 있으면 안 된다.

## 순서

1. **스키마와 프롬프트**(Task 1~2) — 끝나면 서버가 다섯 형식을 만들 수 있다(화면은 아직 목록형만)
2. **템플릿**(Task 3~6) — 끝나면 다섯 형식이 카드로 그려진다
3. **화면**(Task 7~9) — 형식 고르기·편집·점검
4. **게이트**(Task 10)

---

### Task 1: 스키마를 형식별 union 으로

**Files** — Modify: `src/lib/schema.ts` · Test: `src/lib/schema.test.ts`(신규 또는 기존)

- [ ] RED: 다섯 형식이 각각 통과하고, `format` 이 틀리면 거절하는 테스트
- [ ] RED: 형식별 항목 수 하한·상한(3~6 / 3~5 / 3~5 / 2~3 / 4~8)
- [ ] GREEN: `discriminatedUnion("format", [...])`
- [ ] `src/lib/fixtures.ts` 의 정보전달 픽스처에 `format: "list"` 추가
- [ ] 통과 확인 후 커밋

### Task 2: 형식별 생성 프롬프트

**Files** — Modify: `src/lib/prompt.ts`, `src/app/api/generate/route.ts` · Test: `src/lib/prompt.test.ts`, `src/app/api/generate/route.test.ts`

- [ ] RED: `buildSystemPrompt("informationsend", "compare", …)` 가 비교 규칙을 담는다(형식마다)
- [ ] RED: 라우트가 `format` 을 받아 프롬프트에 넘기고, **모델 응답에 `format` 이 없으면 채워** 검증한다
- [ ] GREEN: `format` 파라미터 추가, `FORMAT_RULES` 표
- [ ] 통과 확인 후 커밋

### Task 3: 비교 템플릿

**Files** — Create: `src/templates/bodies/CompareBody.tsx` · Modify: `src/templates/CardRenderer.tsx`

- [ ] `CardRenderer` 가 `copy.format` 으로 본문을 고르게 한다(`list` 는 기존 그대로)
- [ ] 머리줄 두 칸은 테마 강조색, 행은 `hair` 선으로 구분
- [ ] 브라우저로 1080×1350 안에 들어가는지 실측(항목 5개 상한에서)
- [ ] 커밋

### Task 4: 순서 템플릿
**Files** — Create: `src/templates/bodies/StepsBody.tsx`
- [ ] 번호 원 + 아래로 잇는 선. 마지막 항목에는 선을 그리지 않는다
- [ ] 상한(5개) 실측 후 커밋

### Task 5: 숫자 템플릿
**Files** — Create: `src/templates/bodies/StatBody.tsx`
- [ ] 값 96~120px, 설명 27~32px. 2개일 때와 3개일 때 크기를 달리한다
- [ ] 상한(3개) 실측 후 커밋

### Task 6: 체크리스트 템플릿
**Files** — Create: `src/templates/bodies/CheckBody.tsx`
- [ ] 네모 체크 박스 + 한 줄. 8개에서 잘리지 않는지 실측
- [ ] 커밋

### Task 7: 형식 고르기

**Files** — Modify: `src/features/infosend/reducer.ts`, `screens/InfoWorkbenchScreen.tsx` · Create: `src/features/infosend/formats.ts` + 테스트

- [ ] RED: `FORMATS` 목록(id·이름·설명·항목 수)과 `formatOf(spec)`
- [ ] RED: 형식을 바꿀 때 이미 카피가 있으면 "다시 만들어야 한다" 를 알리는 판정
- [ ] GREEN: 왼쪽 칸에 형식 고르기, `SET_FORMAT` 액션
- [ ] 브라우저로 다섯 형식 생성 → 카드 확인(가짜 응답)
- [ ] 커밋

### Task 8: 형식별 편집기

**Files** — Create: `parts/CompareEditor.tsx`, `parts/StatEditor.tsx`, `parts/CheckEditor.tsx` · Modify: `parts/InfoCopyToolbar.tsx`

- [ ] `항목` 탭이 형식별 편집기를 고른다(`list`·`steps` 는 기존 재사용)
- [ ] 편집이 카드에 즉시 반영되는지 형식마다 브라우저 확인
- [ ] 커밋

### Task 9: 형식별 점검

**Files** — Modify: `src/features/infosend/checks.ts` + 테스트

- [ ] RED: 형식마다 빈 항목·수 부족 판정(`compare` 는 세 칸이 다 차야 한다)
- [ ] GREEN 후 커밋

### Task 10: 게이트

**Files** — Modify: `scripts/design-audit.mjs`

- [ ] 형식을 바꿔 카피를 만든 뒤 카드가 자리 안에 들어가는지(형식 하나 이상)
- [ ] **일부러 깨뜨려 FAIL 을 확인**하고 되돌린다
- [ ] 커밋

---

## 사람이 확인해야 하는 것

- 다섯 형식이 **읽히는가** — 비교표가 표로 보이는가, 숫자가 크게 보이는가
- 형식을 바꿨을 때 카피가 그 형식답게 나오는가(Claude 실호출, 형식당 1회)
- 항목을 상한까지 채웠을 때 카드에서 잘리지 않는가

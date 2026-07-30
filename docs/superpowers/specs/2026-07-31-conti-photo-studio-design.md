# 콘티 — 사진 기반 카드뉴스 제작 스튜디오 (전면 개편)

- 날짜: 2026-07-31
- 브랜치: `feat/card-studio`
- 대체 대상: [2026-07-20-repick-cardnews-studio-design.md](./2026-07-20-repick-cardnews-studio-design.md) 의 UI 계층
- 참조 하네스: [SONGYEONGSIN/repick-design](https://github.com/SONGYEONGSIN/repick-design) — `vault/00-principles/page-brief-core.md`, `vault/00-principles/dash-brief-v3.md`, `vault/20-catalog/colors.catalog.md`, `vault/20-catalog/motion.catalog.md`

---

## 1. 문제

현재 스튜디오(`src/app/studio.tsx`, 182줄)는 키워드 하나로 카피를 생성해 텍스트 카드를 뽑는 단일 폼이다. 두 가지가 동시에 문제다.

**기능 결손** — 사용자는 이미 사진을 직접 보정해서 쓴다. 그 사진이 시스템에 들어올 자리가 없다.

**완성도 결손** — repick-design 하네스 기준으로 재면 결함이 구조적이다.

| 하네스 기준 | 현재 상태 |
|---|---|
| "진짜 라이트 = 순백 기반" (`dash-brief-v3` §피드백 1) | `bg-stone-50` 크림 + `orange-700` — 하네스가 **가짜 라이트로 명시 금지**한 조합 |
| 앱 셸 (사이드바 + 탑바) | 없음. 좌 폼 / 우 미리보기 2단 그리드가 전부 |
| 컴포넌트 시스템 | 없음. 버튼·인풋이 매 자리에서 개별 Tailwind 문자열로 재작성됨 |
| 인터랙션 최소 4종 | 0종 (버튼 클릭 외 없음) |
| 레이아웃 아키타입 | 단일 폼 — 다섯 단계 작업을 한 화면에 평면 배치 |

## 2. 목표

1. 사용자가 직접 보정한 사진 폴더를 통째로 받아 카드뉴스의 소재로 쓴다.
2. 드래그앤드롭으로 사진이 나오는 순서를 정한다.
3. 나머지(카피 생성 · 테마 · PNG 렌더 · 폴더 저장)는 **기존 파이프라인을 그대로 재사용**한다.
4. 전 과정을 스텝별로 분해해 한 화면에 한 가지 결정만 남긴다.
5. 하네스 기준의 앱 셸·컴포넌트 시스템·인터랙션 밀도를 확보한다.

### 비목표

- 브라우저 내 사진 보정(크롭·필터·색보정). 사용자가 외부 툴에서 끝내고 들어온다는 것이 전제다.
- 다크 모드. 토큰을 CSS 변수로 분리해 나중에 얹을 수 있게만 해 둔다.
- 프로젝트 저장/불러오기. 한 번의 세션에서 만들고 내보내는 도구다.
- 배포. 로컬 개발 서버(`:3500`)에서 돈다.

---

## 3. 아이덴티티

기존 `RE:PICK` 네이밍은 도구 이름에서 뺀다. 발행 브랜드와 제작 도구를 분리한다.

- **이름**: 콘티 (Conti Studio). 영상·출판 현장에서 스토리보드를 부르는 말. 칸마다 그림 한 컷과 글 한 줄이 붙어 순서대로 이어지는 형식이 카드뉴스와 같고, "콘티를 짠다"가 이 도구의 작업 그 자체다.
- **마크**: 콘티 칸 — 사각 프레임 안에 위쪽 그림 영역(채움) + 아래쪽 대사 줄 2개. 제품이 실제로 렌더하는 `split` 레이아웃과 같은 형태다. 인라인 SVG 컴포넌트(`components/ui/ContiMark.tsx`), 외부 파일 0.
- **액센트**: 플럼 `#7A2E6B` 단 1색. 흰 배경 대비 8.66:1 (AA 통과). 링·활성 상태·진행률에만 쓰고 그 외는 전부 무채색.

`knowledge/brand-voice.md`의 RE:픽 브랜드 보이스는 **카피 생성 프롬프트 입력으로 그대로 유지**한다. 바뀌는 것은 도구 껍데기의 이름뿐이다.

### 워터마크

카드에 찍히는 핸들은 고정값 `@repick`에서 **3번 스텝의 입력 필드**로 옮긴다. `themes.ts`의 `watermark` 필드를 제거하고 `Project.handle`이 `CardFrame`으로 내려간다. 기본값은 빈 문자열이고, 비어 있으면 워터마크 영역을 렌더하지 않는다.

---

## 4. 디자인 언어

| 항목 | 결정 | 근거 |
|---|---|---|
| 캔버스 | `#FFFFFF` / `#FBFAFB`, 카드 white + 헤어라인 보더 + `shadow-sm` | `dash-brief-v3` "진짜 라이트" |
| 뉴트럴 | zinc 계열에 플럼 쪽으로 미세 편향 — `#FBFAFB` `#E7E4E8` `#6E6A72` | 순수 중성회색은 고르지 않은 것처럼 읽힌다 |
| 액센트 | 플럼 `#7A2E6B` **1색** | `colors.catalog` 단일 액센트 원칙 |
| 텍스트 | `#16151A` / `#57545C` / `#8B8791` 3단 | 무채색 위계 |
| 폰트 | Pretendard Variable 전역 단일, 웨이트 **정확히 3종**(400/600/800) | `page-brief-core` §4. CDN 로딩은 `layout.tsx`에 이미 존재 |
| 숫자 | `tabular-nums` (카드 번호·해상도·용량·글자수) | `page-brief-core` §4 |
| 아이콘 | lucide-react. UI 크롬에 이모지 0개 | `page-brief-core` §2 `no-emoji` |
| 모션 | Subtle 티어만 — hover 150–200ms, 스텝 전환 200ms fade, 스켈레톤 pulse. `transform`·`opacity`만 애니메이트하고 `motion-reduce`로 게이팅 | `motion.catalog` dash 열 ✅ |
| 포커스 | `focus-visible` 링 필수. `outline-none` 단독 금지 | `page-brief-core` §3 |

토큰은 `src/lib/design-tokens.ts`에 `as const`로 중앙 관리하고 `globals.css`의 `@theme`에서 CSS 변수로 노출한다. 컴포넌트는 Tailwind 클래스로만 참조한다.

### 의도적으로 어기는 하네스 규칙

| 규칙 | 이 프로젝트의 처리 | 이유 |
|---|---|---|
| "카피 언어 영문 전용" (`page-brief-core` §1) | UI 전부 한국어 | 그 규칙은 글로벌 벤치마크 정합용이다. 한국어 콘텐츠를 만드는 한국어 도구에 적용하면 목적과 반대로 간다 |
| "원시 `<img>` 금지 → `next/image`" | 카드 템플릿과 사진 프리뷰는 원시 `<img>`. 해당 라인에 사유 주석 | `html-to-image`가 DOM을 캡처하려면 data URL을 문 순수 `<img>`여야 한다. `next/image`는 blob·dataURL을 최적화할 수 없고 `unoptimized`도 하네스가 금지한다 |
| "인라인 스타일 금지" (`rules/donts.md`) | 카드 템플릿(`src/templates/**`)만 인라인 유지. 스튜디오 앱 껍데기는 100% Tailwind | 커밋 `36a1594`가 이미 확립한 경계 — PNG export를 위해 계산된 스타일이 필요하다 |
| "모바일 390px 폭 검증" (`page-brief-core` §5) | 1280 이상만 검증 | 폴더 드롭 · 드래그 리오더 · 1080×1350 편집이 성립하지 않는 데스크톱 전용 제작 도구다. 좁은 폭 대응은 쓰지 않을 경로에 비용을 쓰는 것 |

---

## 5. 화면 구성

### 앱 셸

```
┌──────────────┬────────────────────────────────────────────────────┐
│ ▣ 콘티        │  ② 순서 정하기          사진 8 · 카드 5    [초기화] │ ← 탑바 56px
│              ├────────────────────────────────────────────────────┤
│ ●─ 1 사진 ✓  │                                                    │
│ │            │                 스텝 캔버스                         │
│ ●─ 2 순서 ◀  │                                                    │
│ │            │                                                    │
│ ○─ 3 주제    │                                                    │
│ │            │                                                    │
│ ○─ 4 편집    │                                                    │
│ │            │                                                    │
│ ○─ 5 내보내기 │                                                    │
│              ├────────────────────────────────────────────────────┤
│ 사진 8장     │                        [← 이전]  [다음 →]           │ ← 고정 푸터
└──────────────┴────────────────────────────────────────────────────┘
   240px 고정                    flex-1 min-w-0
```

- 좌 레일 240px 고정, 메인 `flex-1 min-w-0` (`dash-brief-v3` 그리드 검증 룰 v2).
- 스텝 레일 항목은 `완료 / 현재 / 미도달` 3상태. 미도달은 `disabled`, 완료는 클릭해 되돌아갈 수 있다.
- 헤더 컨트롤 높이 44px 통일.
- 1280 / 1366 / 1440 / 1600 / 1920 전 구간에서 여유폭 16px 이상 확보. 모바일은 비대상(데스크톱 제작 도구).

### 스텝

| # | 스텝 | 화면 | 인터랙션 |
|---|---|---|---|
| 1 | 사진 | **유형 세그먼트(정보전달 / 카드뉴스)** + 대형 드롭존(폴더 통째로 드롭) + `webkitdirectory` 폴더 선택 버튼 → 썸네일 그리드. 파일명·해상도·용량·4:5 크롭 경고 배지 | 유형 전환 · 드롭 · 폴더 선택 · 개별 제외 토글 |
| 2 | 순서 / 고르기 | 드래그앤드롭 레일(슬롯 = 정원) + 미사용 트레이. 정원 초과분은 트레이로 내려가고, 트레이의 사진을 슬롯으로 끌면 자리가 바뀐다 | **dnd 리오더(키보드 포함)** |
| 3 | 주제 | 키워드 · 테마 3종 · 워터마크 핸들 → `카피 생성` | 테마 선택 시 프리뷰 즉시 반영 |
| 4 | 편집 | 좌 카드 썸네일 레일 / 중앙 대형 프리뷰 / 우 인스펙터 | **선택→프리뷰·인스펙터 동기화**, 레이아웃 세그먼트 토글, 인라인 편집(글자수 카운터), 초점·스크림 슬라이더 |
| 5 | 내보내기 | 전체 카드 요약 그리드 + PNG 다운로드 / 폴더 저장, 결과 경로 표시 | 저장 진행 상태 |

인터랙션 6종(드롭 · 리오더 · 선택 동기화 · 레이아웃 토글 · 인라인 편집 · 초점/스크림 슬라이더)으로 하네스 최소 4종을 넘긴다. 2번의 dnd는 `@dnd-kit`으로 구현해 키보드 조작(Space→화살표→Space)을 확보한다 — Lighthouse 접근성 95 하드게이트 때문이다.

카피 재생성은 3번 스텝으로 돌아가 **전체 재생성**하는 경로만 둔다. 카드 단위 재생성은 카드 하나를 위해 나머지 카드의 맥락을 다시 보내야 해서 비용 대비 이득이 없다.

### 유형이 정원을 정하므로 유형 선택이 먼저다

`type`은 2번 스텝의 정원(informationsend 1 / cardnews 5~6)을 결정한다. 따라서 유형 선택은 **1번 스텝 맨 위**에 놓는다. 사진을 받기 전에 정원이 정해져야 드롭존 안내 문구("사진 5~6장을 올려주세요")와 2번의 게이트가 같은 값을 보고 판단한다. 유형을 3번에 두면 2번을 통과한 뒤 정원이 뒤집히는 상태가 생긴다.

2번 스텝은 **정원 하나로 두 유형을 모두 처리한다.** 슬롯 수 = 정원이므로 카드뉴스는 슬롯 5~6개의 순서 정하기가 되고, 정보전달은 슬롯 1개의 대표 사진 고르기가 된다. 트레이에서 슬롯으로 끌어 교체하는 동작은 양쪽이 같다 — 분기 구현이 아니라 같은 메커니즘의 다른 정원이다. 스텝 라벨만 정원에 따라 "순서 정하기" / "대표 사진 고르기"로 바뀐다.

### 카드 레이아웃 3종

사용자가 카드별로 고른다. 4번 스텝 진입 시 자동 배정되고 인스펙터에서 바꾼다.

| id | 구성 | 자동 배정 |
|---|---|---|
| `full-bleed` | 사진이 1080×1350 전면. 하단에서 올라오는 스크림 위에 카피 | cardnews 1번 카드 |
| `split` | 사진 밴드 + 테마 배경 + 카피. 밴드 비율은 유형이 정한다 — cardnews 60% / informationsend 35%(리스트가 자리를 더 쓴다) | cardnews 2 ~ N-1번, informationsend 유일 카드 |
| `text-only` | 배정된 사진을 렌더하지 않고 테마 배경 + 카피만. CTA용 | cardnews 마지막 카드 |

`full-bleed`는 사진 위에 흰 텍스트를 얹으므로 스크림 불투명도를 인스펙터에서 조절하고, 기본값은 대비 4.5:1을 확보하는 값으로 잡는다.

사진이 4:5가 아니면 1번 스텝에서 경고 배지를 달되 **거부하지 않는다**. `object-fit: cover` + 초점 좌표로 담고, 어디가 잘리는지는 4번 스텝의 초점 슬라이더로 사용자가 정한다.

---

## 6. 상태 모델

AI는 카피만 책임진다. 사진 배정·레이아웃·초점은 클라이언트가 소유한다. 이 분리 덕분에 **기존 zod 스키마(`InfographicSpec` / `CardnewsSpec`)를 한 줄도 바꾸지 않는다.**

```ts
type Photo = {
  id: string;         // 파일명+크기 기반 결정론 id
  name: string;
  dataUrl: string;    // 원본 — PNG 캡처용
  thumbUrl: string;   // 최장변 1024px — Claude 전송용
  width: number;
  height: number;
  bytes: number;
};

type CardLayout = "full-bleed" | "split" | "text-only";

type CardDraft = {
  id: string;
  photoId: string | null;
  layout: CardLayout;
  focal: { x: number; y: number };  // 0~1, object-position
  scrim: number;                     // 0~1
  copy: CardnewsCard | InfographicSpec;
};

type Project = {
  step: 1 | 2 | 3 | 4 | 5;
  photos: Photo[];
  order: string[];      // photoId[] — 사용분, 순서 그 자체
  keyword: string;
  type: "informationsend" | "cardnews";
  themeId: ThemeId;
  handle: string;       // 워터마크
  cards: CardDraft[];
};
```

단일 reducer(`features/studio/useProject.ts`) + Context. 스텝 컴포넌트는 dispatch만 받는다.

### 사진 : 카드 = 1 : 1

- `cardnews` 정원 5~6장, `informationsend` 정원 1장.
- 정원보다 적으면 2번 스텝에서 다음으로 못 넘어간다 — "카드뉴스는 사진 5~6장이 필요해요. 2장 더 추가하세요".
- 정원보다 많으면 상위 N장이 카드가 되고 나머지는 미사용 트레이에 남는다.
- 이 규칙 덕분에 "사진이 모자란 카드" 상태가 아예 생기지 않는다. 폴백 분기가 필요 없다.
- `text-only`로 배정된 카드도 **사진 배정 자체는 유지한다.** 렌더에서 쓰지 않을 뿐이다. 사용자가 마지막 카드를 `split`으로 바꾸면 그 사진이 즉시 살아난다 — 배정과 표현을 분리했기 때문에 가능하다.

`informationsend`는 유일 카드의 `copy`가 `InfographicSpec` 전체(제목 + items 3~6개 + tip)이고, 사진 1장이 상단 밴드로 들어간다.

---

## 7. 데이터 흐름

```
① 사진    type 선택 → 정원 확정
          File[] ──photos.ts──▶ Photo[] { dataUrl(원본), thumbUrl(1024px) }
② 순서    dnd-kit ──order.ts(정원)──▶ order: photoId[]  /  미사용
③ 주제    keyword · themeId · handle
          └▶ POST /api/generate { keyword, type, photos: thumbUrl[] }
               └ prompt.ts → image 블록 N개 + 텍스트 1개
                 → messages.parse + zodOutputFormat → ContentSpec
④ 편집    ContentSpec + order ──layout-assign.ts──▶ CardDraft[] → 인라인 편집
⑤ 내보내기 CardRenderer(원본 dataUrl, 1080×1350) ──html-to-image──▶ Blob[]
               ├ downloadBlob
               └ POST /api/save → cardnews/<slug>-<MMDD>/N.png + ledger append
```

원본과 다운스케일본을 나누는 이유는 Claude에 원본 6장을 보내지 않기 위해서다. 다운스케일은 클라이언트 canvas에서 하고, 카드 렌더는 원본을 쓴다.

### `/api/generate` 확장

요청 바디에 `photos: string[]`(dataURL, 선택)이 추가된다. 라우트는 각 dataURL에서 media type과 base64 본문을 갈라 Anthropic `image` 블록으로 만들고, 텍스트 블록 앞에 순서대로 배치한다.

시스템 프롬프트에 붙는 사진 규칙은 유형별로 다르다.

- `cardnews` — "N번째 사진이 N번째 카드다. 각 카드의 카피는 그 카드의 사진에 실제로 보이는 것에 근거해 쓴다."
- `informationsend` — "사진 1장은 이 인포그래픽의 대표 이미지다. title·subtitle이 사진과 어긋나지 않게 쓰고, items는 키워드 주제를 따른다."

양쪽 공통으로 "사진에 보이지 않는 것을 사실처럼 쓰지 말 것"을 명시한다.

`messages.parse` + `zodOutputFormat` 구조는 그대로다. 출력 스키마도 그대로다.

## 8. 파일 구조

```
src/
  app/
    layout.tsx              메타데이터 → 콘티
    globals.css             @theme 토큰 (플럼)
    page.tsx                Studio 마운트
    api/generate/route.ts   ← 이미지 블록 지원
    api/save/route.ts       ← 변경 없음
  features/studio/
    StudioShell.tsx         앱 셸
    useProject.ts           reducer + Context
    steps/                  Step1Photos … Step5Export
    parts/                  Dropzone · PhotoGrid · SortableCardRail
                            StageCanvas · CardInspector
  components/ui/            Button Field SegmentedControl Badge Card
                            StepRail ContiMark
  lib/
    photos.ts               File→Photo, 비율 판정, 다운스케일 치수
    order.ts                reorder · 정원 분리
    layout-assign.ts        기본 레이아웃 배정
    design-tokens.ts        토큰 중앙 관리
    prompt.ts               ← vision 빌더 추가
    schema.ts export.ts paths.ts ledger.ts auth.ts   변경 없음
  templates/
    CardRenderer.tsx        layout 분기
    layouts/                FullBleed · SplitPhoto · TextOnly
    CardFrame.tsx           handle prop 수용
    themes.ts               watermark 제거, 스크림 토큰 추가
```

`studio.tsx`는 삭제되고 셸 / 스텝 5개 / 파트로 분해된다. 전 파일 400줄 이하를 지킨다.

### 신규 의존성

`@dnd-kit/core` `@dnd-kit/sortable` `@dnd-kit/utilities` `lucide-react` — 4개.

`@dnd-kit`을 쓰는 이유는 네이티브 HTML5 DnD가 키보드 조작을 제공하지 않아 접근성 게이트를 통과할 수 없기 때문이다.

---

## 9. 테스트

RED → GREEN → REFACTOR. 순수 로직을 `lib/`으로 뽑아낸 것은 이 테스트 가능성 때문이다.

| 파일 | 검증 |
|---|---|
| `lib/photos.test.ts` | dataUrl에서 media type 추출 · 4:5 비율 판정 · 다운스케일 치수(비율 유지, 최장변 1024) |
| `lib/order.test.ts` | reorder(from→to) 결과와 불변성 · 정원 초과분 분리 · 유형별 정원(1 / 5~6) · **정원 1에서도 트레이↔슬롯 교체가 성립** · 유형을 바꾸면 정원이 다시 계산됨 |
| `lib/layout-assign.test.ts` | cardnews 첫=full-bleed · 중간=split · 마지막=text-only · informationsend 1장이면 split |
| `lib/prompt.test.ts` | vision 메시지 블록 개수·순서(이미지 N개 → 텍스트 1개) · 빈 배열이면 텍스트 블록만 |
| `app/api/generate/route.test.ts` | `parseBody`가 photos 배열 형식·개수 검증 |

기존 6개 테스트 파일(`schema` `paths` `ledger` `auth` `prompt` `route`)은 그대로 통과해야 한다. 스키마·경로·ledger·auth를 건드리지 않으므로 회귀 가드로 쓴다.

UI는 스텝 전환·드래그 리오더·PNG 캡처를 `/verify`의 브라우저 검증으로 확인한다.

## 10. 완료 기준

1. `npm test` 전부 통과 (기존 6 + 신규 5).
2. `npx tsc --noEmit` 에러 0.
3. `npm run build` 통과.
4. **카드뉴스 완주** — 폴더 8장을 드롭 → 순서 변경 → 카피 생성 → 편집 → 폴더 저장까지 한 번에 끝나고, `cardnews/<슬러그>-<MMDD>/`에 PNG 5장이 실제로 생성된다.
5. **정보전달 완주** — 같은 8장에서 유형을 정보전달로 바꾸면 정원이 1로 줄고, 트레이에서 대표 사진 1장을 고른 뒤 `informationsend/<슬러그>-<MMDD>/1.png`가 생성된다. 유형을 되돌리면 이전 순서가 복원되지 않아도 되지만, 정원 계산은 즉시 5~6으로 돌아온다.
6. 1280 / 1440 / 1920에서 가로 오버플로 0.
7. 키보드만으로 5스텝 전 경로 도달 — 2번 스텝의 순서 변경 포함.

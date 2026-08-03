# 콘티 — 사진 기반 카드뉴스 제작 스튜디오 (전면 개편)

- 날짜: 2026-07-31
- 브랜치: `feat/card-studio`
- 대체 대상: [2026-07-20-repick-cardnews-studio-design.md](./2026-07-20-repick-cardnews-studio-design.md) 의 UI 계층
- 참조 하네스: [SONGYEONGSIN/repick-design](https://github.com/SONGYEONGSIN/repick-design) — `vault/00-principles/page-brief-core.md`, `vault/00-principles/dash-brief-v3.md`, `vault/20-catalog/colors.catalog.md`, `vault/20-catalog/motion.catalog.md`

---

## 1. 문제

현재 스튜디오(`src/app/studio.tsx`, 182줄)는 키워드 하나로 카피를 생성해 텍스트 카드를 뽑는 단일 폼이다. 세 가지가 동시에 문제다.

**기능 결손** — 사용자는 이미 사진을 직접 보정해서 쓴다. 그 사진이 시스템에 들어올 자리가 없다.

**유형 혼재** — 카드뉴스(5~6장 설득 시퀀스)와 정보전달(1장 인포그래픽)은 필요한 작업이 다른데 한 폼의 토글 하나로 눌려 있다. 두 유형이 같은 화면을 쓰면 어느 쪽도 자기한테 맞는 화면을 갖지 못한다.

**완성도 결손** — repick-design 하네스 기준으로 재면 결함이 구조적이다.

| 하네스 기준 | 현재 상태 |
|---|---|
| "진짜 라이트 = 순백 기반" (`dash-brief-v3` §피드백 1) | `bg-stone-50` 크림 + `orange-700` — 하네스가 **가짜 라이트로 명시 금지**한 조합 |
| 앱 셸 (사이드바 + 탑바) | 없음. 좌 폼 / 우 미리보기 2단 그리드가 전부 |
| 컴포넌트 시스템 | 없음. 버튼·인풋이 매 자리에서 개별 Tailwind 문자열로 재작성됨 |
| 인터랙션 최소 4종 | 0종 (버튼 클릭 외 없음) |
| 레이아웃 아키타입 | 단일 폼 — 여러 단계 작업을 한 화면에 평면 배치 |

## 2. 목표

1. 사용자가 직접 보정한 사진 폴더를 통째로 받아 소재로 쓴다.
2. 드래그앤드롭으로 사진이 나오는 순서를 정한다.
3. 나머지(카피 생성 · 테마 · PNG 렌더 · 폴더 저장)는 **기존 파이프라인을 그대로 재사용**한다.
4. **카드뉴스와 정보전달을 별도 화면으로 분리**하고, 각 화면이 그 유형에 필요한 스텝만 갖는다.
5. 하네스 기준의 앱 셸·컴포넌트 시스템·인터랙션 밀도를 확보한다.

### 비목표

- 브라우저 내 사진 보정(크롭·필터·색보정). 사용자가 외부 툴에서 끝내고 들어온다는 것이 전제다.
- 다크 모드. 토큰을 CSS 변수로 분리해 나중에 얹을 수 있게만 해 둔다.
- 프로젝트 저장/불러오기. 한 번의 세션에서 만들고 내보내는 도구다. 허브의 최근 목록은 **읽기 전용 표시**일 뿐 클릭해 복원되지 않는다.
- 배포. 로컬 개발 서버(`:3500`)에서 돈다.
- 모바일. 폴더 드롭과 1080×1350 편집이 성립하지 않는다.

---

## 3. 아이덴티티

기존 `RE:PICK` 네이밍은 도구 이름에서 뺀다. 발행 브랜드와 제작 도구를 분리한다.

- **이름**: 콘티 (Conti Studio). 영상·출판 현장에서 스토리보드를 부르는 말. 칸마다 그림 한 컷과 글 한 줄이 붙어 순서대로 이어지는 형식이 카드뉴스와 같고, "콘티를 짠다"가 이 도구의 작업 그 자체다.
- **마크**: 콘티 칸 — 사각 프레임 안에 위쪽 그림 영역(채움) + 아래쪽 대사 줄 2개. 제품이 실제로 렌더하는 `split` 레이아웃과 같은 형태다. 인라인 SVG 컴포넌트(`components/ui/ContiMark.tsx`), 외부 파일 0.
- **액센트**: 플럼 `#7A2E6B` 단 1색. 흰 배경 대비 8.66:1 (AA 통과). 링·활성 상태·진행률에만 쓰고 그 외는 전부 무채색.

`knowledge/brand-voice.md`의 RE:픽 브랜드 보이스는 **카피 생성 프롬프트 입력으로 그대로 유지**한다. 바뀌는 것은 도구 껍데기의 이름뿐이다.

### 워터마크

카드에 찍히는 핸들은 고정값 `@repick`에서 **주제 스텝의 입력 필드**로 옮긴다. `themes.ts`의 `watermark` 필드를 제거하고 프로젝트 상태의 `handle`이 `CardFrame`으로 내려간다. 기본값은 빈 문자열이고, 비어 있으면 워터마크 영역을 렌더하지 않는다.

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

## 5. 화면 구성 — 세 개의 라우트

유형은 **작업을 시작하기 전에** 고른다. 한 번 플로우에 들어가면 그 안에 유형 토글은 없다.

```
/           허브 — 무엇을 만들지 고른다
/cardnews   카드뉴스 제작 — 5스텝
/info       정보전달 제작 — 4스텝
```

라우트로 나누는 이유는 두 가지다. 첫째, 유형이 스텝 구성과 정원을 결정하므로 같은 화면에 얹으면 "이미 지난 스텝의 전제가 뒤집히는" 상태가 생긴다 — 토글을 어디에 두든 패치일 뿐이고, 분리하면 그 상태가 존재하지 않는다. 둘째, 두 유형은 편집 화면의 아키타입 자체가 다르다(아래 §5.2·§5.3).

### 5.1 허브 `/`

서버 컴포넌트. 콘티 락업 아래 두 개의 선택 카드를 놓는다.

| | 카드뉴스 | 정보전달 |
|---|---|---|
| 설명 | 사진 5~6장으로 넘겨 보는 설득 시퀀스 | 사진 1장에 정보를 얹은 인포그래픽 |
| 미니 프리뷰 | 카드 5장이 겹쳐 넘어가는 실루엣 | 위 사진 밴드 + 아래 번호 리스트 실루엣 |
| 스텝 | 5 | 4 |
| 산출 경로 | `cardnews/<슬러그>-<MMDD>/` | `informationsend/<슬러그>-<MMDD>/` |

하단에 **최근 만든 것** 5건 — `knowledge/ledger.jsonl` 마지막 5줄을 서버에서 직접 읽어 유형·키워드·날짜·장수·폴더 경로를 표시한다. 읽기 전용이고 클릭해도 복원되지 않는다. API 라우트를 새로 만들지 않는다.

### 5.2 카드뉴스 `/cardnews` — 5스텝

```
┌──────────────┬────────────────────────────────────────────────────┐
│ ▣ 콘티        │  ② 순서 정하기          사진 8 · 카드 5    [초기화] │ ← 탑바 56px
│   카드뉴스    ├────────────────────────────────────────────────────┤
│              │                                                    │
│ ●─ 1 사진 ✓  │                 스텝 캔버스                          │
│ ●─ 2 순서 ◀  │                                                    │
│ ○─ 3 주제    │                                                    │
│ ○─ 4 편집    │                                                    │
│ ○─ 5 내보내기 │                                                    │
│              ├────────────────────────────────────────────────────┤
│ 사진 8장     │                        [← 이전]  [다음 →]           │ ← 고정 푸터
└──────────────┴────────────────────────────────────────────────────┘
   240px 고정                    flex-1 min-w-0
```

| # | 스텝 | 화면 | 인터랙션 |
|---|---|---|---|
| 1 | 사진 | 대형 드롭존(폴더 통째로 드롭) + `webkitdirectory` 폴더 선택 → 썸네일 그리드. 파일명·해상도·용량·4:5 크롭 경고 배지. 5~6장 정원 안내 | 드롭 · 폴더 선택 · 개별 제외 |
| 2 | 순서 | 슬롯 5~6개의 드래그 리오더 레일 + 미사용 트레이. 정원 초과분은 트레이로 내려가고, 트레이의 사진을 슬롯으로 끌면 교체된다 | **dnd 리오더(키보드 포함)** |
| 3 | 주제 | 키워드 · 테마 3종 · 워터마크 핸들 → `카피 생성` | 테마 선택 시 프리뷰 즉시 반영 |
| 4 | 편집 | **3-페인** — 좌 카드 썸네일 레일 / 중앙 대형 스테이지 / 우 인스펙터 | **선택→스테이지·인스펙터 동기화**, 레이아웃 세그먼트 토글, 인라인 편집(글자수 카운터), 초점·스크림 슬라이더 |
| 5 | 내보내기 | 전체 카드 요약 그리드 + PNG 다운로드 / 폴더 저장, 결과 경로 | 저장 진행 상태 |

인터랙션 6종.

### 5.3 정보전달 `/info` — 4스텝

순서 스텝이 없다. 카드가 1장뿐이라 정할 순서가 없기 때문이다. 대신 **여러 장 중 대표 1장 고르기**가 사진 스텝에 흡수되고, 순서를 정하는 대상은 사진이 아니라 **인포그래픽 항목(items)**이 된다.

| # | 스텝 | 화면 | 인터랙션 |
|---|---|---|---|
| 1 | 사진 | 드롭존 + 폴더 선택 → 썸네일 그리드에서 **대표 1장 클릭 선택**. 선택된 장에 플럼 링 | 드롭 · 폴더 선택 · 대표 선택 |
| 2 | 주제 | 키워드 · 테마 3종 · 워터마크 핸들 → `카피 생성` | 테마 선택 시 프리뷰 즉시 반영 |
| 3 | 편집 | **2-페인** — 좌 대형 스테이지 / 우 인스펙터. 카드가 1장이라 썸네일 레일이 없다 | **항목 dnd 리오더**, 항목 추가·삭제(3~6 경계), 제목·부제·항목·팁 인라인 편집, 사진 밴드 비율·초점 슬라이더 |
| 4 | 내보내기 | 단일 카드 프리뷰 + PNG 다운로드 / 폴더 저장, 결과 경로 | 저장 진행 상태 |

인터랙션 6종. 두 플로우 모두 하네스 최소 4종을 넘긴다.

### 5.4 카드 레이아웃

| id | 구성 | 쓰는 곳 |
|---|---|---|
| `full-bleed` | 사진이 1080×1350 전면. 하단에서 올라오는 스크림 위에 카피 | 카드뉴스 1번 카드 (기본) |
| `split` | 사진 밴드 + 테마 배경 + 카피. 밴드 비율은 플로우가 정한다 — 카드뉴스 60% / 정보전달 35%(리스트가 자리를 더 쓴다) | 카드뉴스 2~N-1번, 정보전달 유일 카드 |
| `text-only` | 배정된 사진을 렌더하지 않고 테마 배경 + 카피만 | 카드뉴스 마지막 카드 (기본) |

카드뉴스는 4번 스텝 진입 시 위 기본값으로 자동 배정되고 인스펙터에서 카드별로 바꾼다. `text-only`도 사진 배정 자체는 유지하므로 `split`으로 바꾸면 그 사진이 즉시 살아난다. 정보전달은 `split` 고정이고 밴드 비율만 조절한다.

`full-bleed`는 사진 위에 흰 텍스트를 얹으므로 스크림 불투명도를 인스펙터에서 조절하고, 기본값은 대비 4.5:1을 확보하는 값으로 잡는다.

사진이 4:5가 아니면 사진 스텝에서 경고 배지를 달되 **거부하지 않는다**. `object-fit: cover` + 초점 좌표로 담고, 어디가 잘리는지는 편집 스텝의 초점 슬라이더로 사용자가 정한다.

### 5.5 플로우 이탈

플로우 안에는 유형 토글이 없다. 좌상단 콘티 락업을 누르면 허브로 나가고, 그때 진행 중인 작업이 있으면 확인 다이얼로그를 한 번 띄운다("만들던 카드뉴스가 사라져요"). 프로젝트 저장이 비목표이므로 이 확인 하나가 유일한 보호 장치다.

---

## 6. 상태 모델

AI는 카피만 책임진다. 사진 배정·레이아웃·초점은 클라이언트가 소유한다. 이 분리 덕분에 **기존 zod 스키마(`InfographicSpec` / `CardnewsSpec`)를 한 줄도 바꾸지 않는다.**

두 플로우는 **각자의 reducer**를 갖는다. 상태 모양이 실제로 다르기 때문이다 — 하나로 합치면 한쪽에서만 의미 있는 필드가 항상 절반씩 비어 있게 된다.

```ts
// 공용
type Photo = {
  id: string;         // 파일명+크기 기반 결정론 id
  name: string;
  dataUrl: string;    // 원본 — PNG 캡처용
  thumbUrl: string;   // 최장변 1024px — Claude 전송용
  width: number;
  height: number;
  bytes: number;
};

// features/cardnews/useCardnewsProject.ts
type CardLayout = "full-bleed" | "split" | "text-only";
type CardDraft = {
  id: string;
  photoId: string;
  layout: CardLayout;
  focal: { x: number; y: number };   // 0~1, object-position
  scrim: number;                      // 0~1
  copy: CardnewsCard;
};
type CardnewsProject = {
  step: 1 | 2 | 3 | 4 | 5;
  photos: Photo[];
  order: string[];        // photoId[] — 슬롯에 든 것, 순서 그 자체 (5~6)
  keyword: string;
  themeId: ThemeId;
  handle: string;
  cards: CardDraft[];
};

// features/infosend/useInfoProject.ts
type InfoProject = {
  step: 1 | 2 | 3 | 4;
  photos: Photo[];
  selectedPhotoId: string | null;   // 대표 1장
  keyword: string;
  themeId: ThemeId;
  handle: string;
  band: number;                      // 사진 밴드 비율 0.2~0.5
  focal: { x: number; y: number };
  spec: InfographicSpec | null;      // 제목 + items 3~6 + tip
};
```

### 정원

- 카드뉴스: 슬롯 5~6. 미달이면 2번 스텝에서 다음으로 못 넘어간다 — "카드뉴스는 사진 5~6장이 필요해요. 2장 더 추가하세요". 초과분은 미사용 트레이에 남는다.
- 정보전달: 대표 1장. 미선택이면 1번 스텝에서 못 넘어간다.

카드뉴스는 사진과 카드가 1:1이라 "사진이 모자란 카드" 상태가 생기지 않는다. 폴백 분기가 필요 없다.

---

## 7. 데이터 흐름

두 플로우가 같은 API 두 개를 공유한다. `/api/generate`의 `type` 파라미터는 이미 존재하므로 라우트를 나누지 않는다.

```
공통 ① 사진   File[] ──photos.ts──▶ Photo[] { dataUrl(원본), thumbUrl(1024px) }

카드뉴스
  ② 순서      dnd-kit ──reorder.ts──▶ order: photoId[] (5~6) / 미사용
  ③ 주제      keyword · themeId · handle
              └▶ POST /api/generate { type:"cardnews", keyword, photos: thumbUrl[] }
                   └ prompt.ts → image 블록 N개 + 텍스트 1개
                     → messages.parse + zodOutputFormat → CardnewsSpec
  ④ 편집      CardnewsSpec + order ──layout-assign.ts──▶ CardDraft[] → 인라인 편집
  ⑤ 내보내기  CardRenderer(원본, 1080×1350) ──html-to-image──▶ Blob[]
                 ├ downloadBlob
                 └ POST /api/save → cardnews/<슬러그>-<MMDD>/N.png + ledger

정보전달
  ② 주제      keyword · themeId · handle
              └▶ POST /api/generate { type:"informationsend", keyword, photos:[대표 1장] }
                   → InfographicSpec
  ③ 편집      spec 인라인 편집 + items dnd 리오더 + band·focal
  ④ 내보내기  동일 → informationsend/<슬러그>-<MMDD>/1.png + ledger
```

원본과 다운스케일본을 나누는 이유는 Claude에 원본 6장을 보내지 않기 위해서다. 다운스케일은 클라이언트 canvas에서 하고, 카드 렌더는 원본을 쓴다.

### `/api/generate` 확장

요청 바디에 `photos: string[]`(dataURL, 선택)이 추가된다. 라우트는 각 dataURL에서 media type과 base64 본문을 갈라 Anthropic `image` 블록으로 만들고, 텍스트 블록 앞에 순서대로 배치한다.

시스템 프롬프트에 붙는 사진 규칙은 유형별로 다르다.

- `cardnews` — "N번째 사진이 N번째 카드다. 각 카드의 카피는 그 카드의 사진에 실제로 보이는 것에 근거해 쓴다."
- `informationsend` — "사진 1장은 이 인포그래픽의 대표 이미지다. title·subtitle이 사진과 어긋나지 않게 쓰고, items는 키워드 주제를 따른다."

양쪽 공통으로 "사진에 보이지 않는 것을 사실처럼 쓰지 말 것"을 명시한다.

`messages.parse` + `zodOutputFormat` 구조는 그대로다. 출력 스키마도 그대로다.

---

## 8. 파일 구조

```
src/
  app/
    layout.tsx              메타데이터 → 콘티
    globals.css             @theme 토큰 (플럼)
    page.tsx                허브 (서버 컴포넌트 — ledger 최근 5건)
    cardnews/page.tsx       카드뉴스 플로우 마운트
    info/page.tsx           정보전달 플로우 마운트
    api/generate/route.ts   ← 이미지 블록 지원
    api/save/route.ts       ← 변경 없음
  features/
    shell/                  StudioShell · StepRail · TopBar · FooterNav   (양쪽 공용)
    photos/                 Dropzone · PhotoGrid · PhotoBadge             (양쪽 공용)
    cardnews/
      useCardnewsProject.ts
      steps/                Photos · Order · Topic · Compose · Export
      parts/                SortablePhotoRail · CardRail · CardInspector · StageCanvas
    infosend/
      useInfoProject.ts
      steps/                Photo · Topic · Compose · Export
      parts/                PhotoPicker · SortableItemList · ItemInspector · StageCanvas
  components/ui/            Button · Field · SegmentedControl · Badge · Card · ContiMark
  lib/
    photos.ts               File→Photo, 비율 판정, 다운스케일 치수
    reorder.ts              순수 배열 재배치 (사진·항목 양쪽에서 씀)
    layout-assign.ts        카드뉴스 기본 레이아웃 배정
    design-tokens.ts        토큰 중앙 관리
    prompt.ts               ← vision 빌더 추가
    schema.ts export.ts paths.ts ledger.ts auth.ts   변경 없음
  templates/
    CardRenderer.tsx        layout 분기
    layouts/                FullBleed · SplitPhoto · TextOnly
    CardFrame.tsx           handle prop 수용
    themes.ts               watermark 제거, 스크림 토큰 추가
```

`studio.tsx`는 삭제된다. 셸·사진 처리·UI 원자·템플릿은 두 플로우가 공유하고, 스텝과 인스펙터만 각자 갖는다. 전 파일 400줄 이하를 지킨다.

### 신규 의존성

`@dnd-kit/core` `@dnd-kit/sortable` `@dnd-kit/utilities` `lucide-react` — 4개.

`@dnd-kit`을 쓰는 이유는 네이티브 HTML5 DnD가 키보드 조작을 제공하지 않아 접근성 게이트를 통과할 수 없기 때문이다. 카드뉴스의 사진 리오더와 정보전달의 항목 리오더 양쪽에서 쓴다.

---

## 9. 테스트

RED → GREEN → REFACTOR. 순수 로직을 `lib/`으로 뽑아낸 것은 이 테스트 가능성 때문이다.

| 파일 | 검증 |
|---|---|
| `lib/photos.test.ts` | dataUrl에서 media type 추출 · 4:5 비율 판정 · 다운스케일 치수(비율 유지, 최장변 1024) |
| `lib/reorder.test.ts` | move(from→to) 결과와 불변성 · 범위 밖 인덱스 |
| `lib/layout-assign.test.ts` | 첫=full-bleed · 중간=split · 마지막=text-only · 5장/6장 양쪽 |
| `lib/prompt.test.ts` | vision 블록 개수·순서(이미지 N개 → 텍스트 1개) · 빈 배열이면 텍스트 블록만 · 유형별 사진 규칙 문구 |
| `app/api/generate/route.test.ts` | `parseBody`가 photos 배열 형식·개수 검증 |
| `features/cardnews/useCardnewsProject.test.ts` | 정원 5~6 게이트 · 초과분 트레이 이동 · 트레이↔슬롯 교체 |
| `features/infosend/useInfoProject.test.ts` | 대표 1장 선택·교체 · items 추가/삭제 3~6 경계 · 항목 리오더 |

기존 6개 테스트 파일(`schema` `paths` `ledger` `auth` `prompt` `route`)은 그대로 통과해야 한다. 스키마·경로·ledger·auth를 건드리지 않으므로 회귀 가드로 쓴다.

UI는 스텝 전환·드래그 리오더·PNG 캡처를 `/verify`의 브라우저 검증으로 확인한다.

## 10. 완료 기준

1. `npm test` 전부 통과 (기존 6 + 신규 7).
2. `npx tsc --noEmit` 에러 0.
3. `npm run build` 통과.
4. **카드뉴스 완주** — 허브에서 카드뉴스 선택 → 폴더 8장 드롭 → 순서 변경 → 카피 생성 → 편집 → 폴더 저장까지 한 번에 끝나고, `cardnews/<슬러그>-<MMDD>/`에 PNG 5장이 실제로 생성된다.
5. **정보전달 완주** — 허브에서 정보전달 선택 → 같은 8장 드롭 → 대표 1장 선택 → 카피 생성 → 항목 순서 변경 → 저장까지 끝나고, `informationsend/<슬러그>-<MMDD>/1.png`가 생성된다.
6. 허브의 최근 목록에 위 두 건이 반영된다.
7. 1280 / 1440 / 1920에서 가로 오버플로 0.
8. 키보드만으로 두 플로우 전 경로 도달 — 카드뉴스 순서 변경과 정보전달 항목 순서 변경 포함.

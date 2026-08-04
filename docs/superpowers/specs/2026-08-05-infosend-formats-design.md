# 정보전달 형식 5종 설계

**날짜** 2026-08-05 · **상태** 설계 확정, 구현 전

## 왜

정보전달은 지금 **틀이 하나뿐**이다. 스키마가 `title · subtitle · items[3~6]{keyword,desc} · tip`
하나만 허용하고 레이아웃도 `split` 고정이라, 주제가 무엇이든 `제목 띠 → 부제 → 번호 매긴 항목
→ TIP 상자` 로만 나온다. Claude 가 매번 같은 틀을 고르는 게 아니라 **그 틀 말고는 만들 수 없다.**

비교("에어컨 vs 선풍기")·순서("청소하는 법")·수치("1도에 7%")는 지금 전부 항목 설명 안에 뭉개져
들어간다. 담는 정보의 모양이 다르면 형식도 달라야 한다.

## 무엇을 만드는가

형식 **5종**. 기존 목록형을 포함해 다섯이다.

| id | 이름 | 언제 쓰나 | 항목 모양 | 개수 |
|----|------|----------|----------|------|
| `list` | 목록 | 지금과 같다. 팁 여러 개를 나열 | `{keyword, desc}` | 3~6 |
| `compare` | 비교 | 둘 중 무엇이 나은가 | `{label, left, right}` | 3~5 |
| `steps` | 순서 | 따라 하는 법, 순서가 뜻을 가진다 | `{keyword, desc}` | 3~5 |
| `stat` | 숫자 | 수치 자체가 메시지 | `{value, label}` | 2~3 |
| `check` | 체크리스트 | 설명 없이 목록만 | `{text}` | 4~8 |

### 배열 이름을 `items` 로 통일한다

형식마다 항목 **한 개의 모양**은 다르지만 **배열 필드 이름은 `items` 로 같게 둔다.**

그러면 reducer 의 `ADD_ITEM`·`UPDATE_ITEM`·`REMOVE_ITEM`·`REORDER_ITEM` 이 형식과 무관하게
그대로 돈다 — 형식별로 갈라지는 것은 **항목 한 개를 그리는 편집칸**과 **템플릿**뿐이다.
이름을 형식마다 다르게 두면(`rows`/`steps`/`stats`) 그 네 동작을 형식 수만큼 복제해야 한다.

## 스키마

`format` 을 판별자로 하는 discriminated union.

```ts
const Common = {
  type: z.literal("informationsend"),
  title: z.string().min(1).max(40),
  subtitle: z.string().max(60).optional(),
  tip: z.string().max(120).optional(),
};

const ListSpec = z.object({ ...Common, format: z.literal("list"),
  items: z.array(z.object({ keyword: z.string().min(1).max(30), desc: z.string().min(1).max(120) })).min(3).max(6) });

const CompareSpec = z.object({ ...Common, format: z.literal("compare"),
  columns: z.object({ left: z.string().min(1).max(16), right: z.string().min(1).max(16) }),
  items: z.array(z.object({ label: z.string().min(1).max(20), left: z.string().min(1).max(40), right: z.string().min(1).max(40) })).min(3).max(5) });

const StepsSpec = z.object({ ...Common, format: z.literal("steps"),
  items: z.array(z.object({ keyword: z.string().min(1).max(30), desc: z.string().min(1).max(120) })).min(3).max(5) });

const StatSpec = z.object({ ...Common, format: z.literal("stat"),
  items: z.array(z.object({ value: z.string().min(1).max(8), label: z.string().min(1).max(40) })).min(2).max(3) });

const CheckSpec = z.object({ ...Common, format: z.literal("check"),
  items: z.array(z.object({ text: z.string().min(1).max(40) })).min(4).max(8) });

export const InfographicSpec = z.discriminatedUnion("format", [ListSpec, CompareSpec, StepsSpec, StatSpec, CheckSpec]);
```

**옛 스펙 호환은 두지 않는다.** 스펙은 어디에도 저장되지 않는다 — 편집기 상태로만 살고,
예약은 이미지(PNG)를 저장한다. 화면을 새로 고치면 사라지는 값이라 마이그레이션이 필요 없다.

**`format` 이 없으면 서버가 채운다.** 사용자가 고른 형식을 `/api/generate` 가 알고 있으므로,
모델 응답에 `format` 이 빠져 있어도 검증 전에 넣는다 — 모델이 판별자를 빠뜨렸다고 100초를
버리지 않는다.

## 생성

`buildSystemPrompt(type, format, vault, hasPhotos)` 로 형식을 받는다. 형식별 규칙 한 줄:

- `list` — "items 3~4개(각 keyword+desc)" (지금과 같다. 5개 이상은 카드에 안 들어간다)
- `compare` — "columns.left/right 에 비교 대상 이름, items 3~4개(각 label + left + right).
  같은 기준으로 양쪽을 재라. 한쪽만 좋게 쓰지 마라"
- `steps` — "items 3~4개. **순서가 뜻을 가진다** — 앞 단계를 해야 다음이 된다"
- `stat` — "items 2~3개. value 는 숫자와 단위만(예: `7%`, `26℃`, `2주`), label 은 그 숫자가
  무엇인지 한 줄"
- `check` — "items 5~6개. 각 항목은 **한 줄 동작**. 설명을 붙이지 마라"

## 템플릿

`src/templates/bodies/` 에 형식별 본문 컴포넌트. `CardRenderer` 가 `copy.format` 으로 고른다.

| format | 컴포넌트 | 그리는 법 |
|--------|---------|----------|
| `list` | `InfographicBody`(기존) | 번호 원 + 키워드 형광 + 설명 |
| `compare` | `CompareBody` | 머리줄 두 칸(테마 강조색), 행마다 기준 + 좌/우 |
| `steps` | `StepsBody` | 번호를 **단계**로: 원 + 아래로 잇는 선 |
| `stat` | `StatBody` | 값을 크게(96~120px), 아래 설명. 2~3개를 세로로 |
| `check` | `CheckBody` | 네모 체크 박스 + 한 줄. 설명 없음 |

공통은 그대로 쓴다 — 제목 띠(`titleInBand`), 팁 상자, `fit` 배수, 테마 색.

## 화면

**형식은 카피 만들기 전에 고른다.** 만들기 화면 왼쪽, `사진` 아래·`카피 만들기` 위.

```
왼쪽
┌─────────────────┐
│ 사진   [폴더 선택]│
│ 형식              │
│ [목록][비교][순서] │
│ [숫자][체크]      │
│ [카피 만들기]      │
│ 카피 고치기 [글|항목]│
└─────────────────┘
```

만든 뒤 형식을 바꾸면 **담는 정보가 달라 카피를 다시 만들어야 한다.** 바꾸는 순간
"다시 만들면 지금 고친 글은 사라져요" 를 그 자리에서 말하고, 누르기 전에는 바꾸지 않는다.

## 편집

`InfoCopyToolbar` 의 `항목` 탭이 형식별 편집기를 고른다.

| format | 편집기 | 칸 |
|--------|-------|-----|
| `list`·`steps` | `InfoItemsEditor`(기존) | 키워드(한 줄) + 설명(여러 줄) |
| `compare` | `CompareEditor` | 두 열 이름 + 행마다 기준·왼쪽·오른쪽 |
| `stat` | `StatEditor` | 값(짧게) + 설명 |
| `check` | `CheckEditor` | 한 줄 입력 하나 |

`글` 탭(제목·부제·팁)은 형식과 무관하게 같다.

## 점검

`infoChecks` 를 형식별로 나눈다 — 빈 제목은 공통, 항목 수 하한·상한과 "빈 항목" 판정은
형식마다 다르다(`compare` 는 세 칸이 다 차야 한다).

## 검증

- 순수 함수(스키마 상한·형식별 판정·프롬프트 문구)는 RED→GREEN
- 형식마다 카드가 **1080×1350 안에 들어가는지** 실측 — 항목 상한에서 잘리지 않아야 한다
- `design:audit` 정렬 게이트에 형식 전환 경로를 추가
- 브라우저로 다섯 형식을 각각 만들어 카드가 나오는지 확인(카피 생성은 가짜 응답)

## 하지 않는 것

- 옛 스펙 마이그레이션 (저장되지 않는 값이다)
- 형식별 사진 배치 차이 (사진은 지금처럼 위쪽 밴드 하나)
- 카드뉴스 쪽 형식 추가 (이번 범위 밖)

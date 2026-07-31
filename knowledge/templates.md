# 템플릿 카탈로그

컴포넌트-per-role 방식이 아니라 **레이아웃 × 카피 바디** 조합이다. `CardRenderer`(`src/templates/CardRenderer.tsx`)가 둘을 조합해 최종 카드를 그린다.

## 레이아웃 (`src/templates/layouts/`)

| id | 구성 | 언제 쓰나 |
|----|------|-----------|
| full-bleed | 사진 전면 + 스크림 위 카피 | 카드뉴스 첫 장(표지) |
| split | 사진 밴드 + 아래 카피 영역 | 카드뉴스 중간 장, 정보전달 전체 |
| text-only | 사진 없이 카피만 | 카드뉴스 마지막 장(CTA) |

배정 로직은 `src/lib/layout-assign.ts`의 `assignLayouts(count)`: 카드뉴스는 첫 장 full-bleed·마지막 장 text-only·나머지 split. 정보전달은 항상 split으로 고정(`src/features/infosend/render.ts`). ledger(`ledger.jsonl`)에 기록되는 `templateIds`는 이 레이아웃 이름이며, 옛 컴포넌트 이름이 아니다.

## 카피 바디 (`src/templates/bodies/`)

| id | 대상 | 구조 |
|----|------|------|
| InfographicBody | informationsend | 제목 + (선택)부제 + 번호 항목 3~6개(키워드+설명) + (선택)TIP |
| CardnewsBody | cardnews | role 별 분기 — hook(배지+제목+부제) / problem·evidence(배지+제목+본문) / solution(제목+본문+번호 스텝) / cta(제목+액션+핸들) |

## 테마 (`src/templates/themes.ts`, 렌더 타임 UI 선택)

- violet-doodle: 보라 + 손글씨(Gaegu) + 두들. 구조/교육형.
- mint-clean: 민트+옐로 하이라이트 + 고딕(Do Hyeon). 정보전달형.
- mono-bold: 흑백 대비 + 굵은 고딕. 임팩트형.

각 테마는 `bg`/`fg`/`accent`/`highlight`/`displayFont`에 더해 `onPhoto`(사진 위 스크림에 얹는 텍스트 색)를 갖는다. 워터마크(핸들)는 테마 상수가 아니라 주제 스텝에서 사용자가 직접 입력한다.

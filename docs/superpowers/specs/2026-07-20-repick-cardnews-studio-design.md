# RE:픽 카드 스튜디오 — 설계 문서 (Design Spec)

- **작성일**: 2026-07-20
- **프로젝트**: `repick-cardnews`
- **상태**: 설계 승인 대기 → 승인 후 `/plan` 으로 구현 계획 작성

---

## 1. 목적 (Purpose)

키워드 하나를 입력하면 인스타그램용 콘텐츠 이미지를 자동 생성하는 웹 스튜디오. 두 가지 산출물을 지원한다.

- **informationsend**: 1장 완결형 인포그래픽 (예: "에어컨 전기세 절약하는 6가지 방법")
- **cardnews**: 5~6장 설득 구조 카드뉴스 (궁금증 → 문제제기 → 증거 → 해결책 → CTA)

RE:픽 브랜드의 콘텐츠 생성 축이며, 형제 프로젝트 `repick-design`의 스택·지식관리(vault) 패턴을 계승한다.

---

## 2. 목표 / 비목표 (Goals / Non-Goals)

### MVP 목표 (Phase 1)
1. 키워드 → Claude가 지식베이스 기반으로 카피 자동 생성 (구조화 출력)
2. informationsend 템플릿 1종 + cardnews 그래픽 템플릿 5종 렌더
3. 실시간 미리보기(캐러셀) → PNG export (html-to-image)
4. 결과물을 `informationsend/`·`cardnews/` 폴더에 저장 + `ledger.jsonl` 기록
5. `knowledge/` 볼트 (브랜드 보이스 · 카피 공식 · 템플릿 카탈로그 · 성과 원장 · LLM 위키)

### 비목표 (Phase 2 이후, 별도 스펙)
- 제품 사진 카드 (cardnew1~6 형태, 사진 업로드 + 텍스트 오버레이)
- CLI 대량 배치 생성 (Playwright 렌더 경로)
- 성과 수치 피드백 자동 루프 (ledger → 프롬프트 자동 튜닝)
- 인라인 카피 수동 편집 에디터
- 다중 포맷(스토리 1080×1920, 정사각 1080×1080) — MVP는 4:5 고정

---

## 3. 핵심 원칙: 두 개의 디자인 언어

창의성/파괴성은 **앱 껍데기**와 **카드 콘텐츠**를 의도적으로 다른 미감으로 분리하는 데서 나온다.

| 레이어 | 미감 | 참조 |
|--------|------|------|
| **스튜디오 앱 UI** (도구) | repick-design 에디토리얼 — 차갑고 정제됨, 여백 큰 편집자 도구, stone+orange 또는 violet DNA, Pretendard | `repick-design/app/src/app/(marketing)/landing-client.tsx`, `dash-rg/tokens.ts` |
| **카드 결과물** (콘텐츠) | 인스타 감성 — 뜨겁고 시끄러움, 큰 손글씨/굵은 헤드, 형광 하이라이트, 두들, 이모지, 강한 대비 | `knowledge/references/` (에어컨·몽벨·구조1·2) |

**규칙**: 앱 껍데기는 산출물 미감을 흉내내지 않는다. 도구는 조용하고, 산출물은 요란하다.

---

## 4. 아키텍처 (Architecture)

### 4.1 데이터 흐름

```
키워드 + 유형(informationsend|cardnews) + 옵션
        │
        ▼
POST /api/generate
   ├─ knowledge/ 볼트 로드 (brand-voice.md + copy-formulas.md)
   ├─ Claude Sonnet 5 호출 (지식 주입, 구조화 출력 / tool-use)
   └─ zod 검증된 ContentSpec JSON 반환
        │
        ▼
템플릿 React 컴포넌트 (1080×1350 고정 캔버스)
   └─ 실시간 미리보기 (캐러셀)
        │
        ▼
html-to-image (클라이언트) → PNG(들)
        │
        ├─ 브라우저 다운로드 (즉시)
        └─ POST /api/save → informationsend|cardnews/<키워드>-<날짜>/ 저장
                              + ledger.jsonl append
```

### 4.2 기술 스택 (repick-design 계승)

- **프레임워크**: Next.js 16 (App Router), React 19
- **언어**: TypeScript strict, path alias `@/*` → `src/*`
- **스타일**: Tailwind CSS v4 (CSS-first `@theme inline`, config 파일 없음)
- **폰트**:
  - 앱 껍데기 & 카드 본문: **Pretendard Variable** (CDN)
  - 카드 디스플레이(헤드라인): 손글씨/굵은 한글 디스플레이 폰트 (예: `Gaegu`, `Jua`, `Do Hyeon` — Google Fonts, `next/font`로 로드 + export 시 임베드)
- **LLM**: `@anthropic-ai/sdk`, 모델 `claude-sonnet-5`, 구조화 출력(tool-use/JSON schema). 키는 `ANTHROPIC_API_KEY` (env, 서버 전용)
- **이미지 export**: `html-to-image` (1차). 폰트/CORS 이슈 시 `modern-screenshot` 폴백
- **검증**: `zod` (ContentSpec 스키마)
- **패키지 매니저**: npm

### 4.3 앱 위치 & 폴더 배치

Next.js 앱은 `repick-cardnews` 루트에 둔다 (repick-design과 달리 자동화 루프가 없어 단순화). 라우트는 `src/app/`.

```
repick-cardnews/
├── src/app/            # Next.js App Router (스튜디오 UI + API 라우트)
├── src/lib/            # 순수 로직 (스키마, 프롬프트 조립, ledger, 경로 빌더)
├── src/templates/      # 카드 템플릿 React 컴포넌트
├── knowledge/          # 지식관리 볼트 (아래 §6)
├── informationsend/    # 산출물 (참고본은 knowledge/references/로 이동)
├── cardnews/           # 산출물
└── docs/superpowers/   # 설계/계획 문서
```

---

## 5. 유닛 분해 (Isolation & Clarity)

각 유닛은 단일 책임 · 명확한 인터페이스 · 독립 테스트 가능.

| 유닛 | 책임 | 인터페이스 | 의존 |
|------|------|-----------|------|
| **Knowledge Vault** | 브랜드/카피 규칙·이력의 단일 진실 공급원 | MD/JSONL 파일 (읽기) + `appendLedger()` (쓰기) | fs |
| **Copy Engine** (`/api/generate`) | 키워드 → 검증된 ContentSpec | `generate(keyword, type, opts) → ContentSpec` | Anthropic SDK, Vault, zod |
| **ContentSpec Schema** (`src/lib/schema.ts`) | 두 산출물의 데이터 계약 | zod 스키마 + TS 타입 | zod |
| **Template System** (`src/templates/`) | ContentSpec → 픽셀(DOM) | `<Card spec={...} theme={...} />` | React, 테마 토큰 |
| **Export** (`src/lib/export.ts`) | DOM 노드 → PNG Blob | `exportNode(el) → Blob` | html-to-image |
| **Save** (`/api/save`) | PNG + 메타 → 폴더 + ledger | `save(type, keyword, blobs)` | fs, Vault |
| **Studio UI** (`src/app/page.tsx`) | 사용자 입력 → 생성 → 미리보기 → 다운로드 조율 | 화면 | 위 전부 |

**경계 검증**: Copy Engine은 템플릿을 모른다(ContentSpec만 안다). 템플릿은 Claude를 모른다(spec만 받는다). Export는 콘텐츠를 모른다(DOM 노드만 받는다). → 각각 독립 교체·테스트 가능.

---

## 6. 지식관리 설계 (Knowledge Vault)

repick-design `vault/` 패턴 계승. 사용자가 선택한 5요소를 파일로 매핑한다.

```
knowledge/
├── MEMORY.md            # LLM 위키 인덱스 (한 줄 포인터, 읽기/쓰기)
├── brand-voice.md       # RE:픽 말투·금지어·이모지·문장 길이 규칙 → 프롬프트 주입
├── copy-formulas.md     # 설득 구조(구조1·2)·후크 패턴·CTA 패턴 → 프롬프트 주입
├── templates.md         # 레이아웃 카탈로그 (id/역할/언제 쓰는지) — works.ts식 레지스트리
├── ledger.jsonl         # 생성 이력 + (선택) 성과 (append-only)
└── references/          # 기존 예시 이미지 이동본 (에어컨/몽벨/구조1·2)
```

### 6.1 프롬프트 주입 (LLM 위키의 읽기 경로)
`/api/generate`는 `brand-voice.md` + `copy-formulas.md` 를 읽어 Claude system 프롬프트에 주입한다. → 톤·설득 구조가 항상 일관.

### 6.2 되먹임 (LLM 위키의 쓰기 경로)
생성 성공 시 `ledger.jsonl` 에 1 엔트리 append:
```json
{"ts":"2026-07-20T12:00:00Z","type":"cardnews","keyword":"에어컨 전기세","cards":6,"template_ids":["hook","problem",...],"model":"claude-sonnet-5","paths":["cardnews/에어컨전기세-0720/1.png",...],"perf":null}
```
`perf`는 Phase 2에서 인스타 반응 수치를 수동/자동 기입 → 잘 된 패턴 학습의 근거.

---

## 7. 데이터 계약: ContentSpec 스키마

Copy Engine ↔ Template System 의 인터페이스. zod로 검증(LLM 오출력 방어).

**중요 — `theme`는 LLM 출력이 아니다.** Copy Engine(Claude)은 **콘텐츠(문구)만** 반환한다. `theme`(카드 미감)는 UI에서 사용자가 선택하는 **렌더 타임 prop**으로, 템플릿에 별도 주입된다. → Copy Engine은 시각을 모른다(§5 경계 검증과 일치). 아래 스키마의 콘텐츠 필드만 LLM이 생성하고, `theme`는 `<Card spec={content} theme={themeId} />` 형태로 합류한다.

### 7.1 informationsend (인포그래픽 1장) — LLM 생성 콘텐츠
```ts
{
  type: "informationsend",
  title: string,            // "에어컨 전기세 절약하는 6가지 방법"
  subtitle?: string,        // "이렇게 사용하면 전기요금 아낄 수 있어요!"
  items: Array<{            // 3~6개
    keyword: string,        // "처음엔 파워냉방" (하이라이트 대상)
    desc: string,           // "처음 10~20분은 파워냉방으로..."
  }>,
  tip?: string,             // 하단 TIP 박스
}
```

### 7.2 cardnews (설득 시퀀스 5~6장) — LLM 생성 콘텐츠
```ts
{
  type: "cardnews",
  keyword: string,
  cards: Array<                       // 5~6장, 순서 = 설득 흐름
    | { role: "hook",     heading: string, sub?: string, badge?: string }
    | { role: "problem",  heading: string, body: string }
    | { role: "evidence", heading: string, body: string }
    | { role: "solution", heading: string, body: string, steps?: string[] }
    | { role: "cta",      heading: string, action: string, handle?: string }
  >,
}
```

**6장 처리**: `cards`는 5~6개. 5개일 때 각 role 1개(hook·problem·evidence·solution·cta). 6개일 때는 중간 role을 하나 반복(예: evidence 2장 또는 solution 2장)해 흐름을 늘린다. LLM이 길이를 판단하되, 첫 카드는 항상 `hook`, 마지막은 항상 `cta`로 고정(zod refine로 강제).

### 7.3 테마 (렌더 타임, UI 선택)
`ThemeId` = MVP 2~3종 (예: `violet-doodle`, `mint-clean`, `mono-bold`). 카드 미감 토큰(악센트·형광색·디스플레이 폰트)을 묶은 상수 세트 (`src/templates/themes.ts`, `dash-rg/tokens.ts` 방식). 기본값 자동 선택, 사용자가 UI에서 변경 가능.

---

## 8. 템플릿 시스템

- 고정 캔버스 **1080×1350 (4:5)** — 인스타 캐러셀 규격.
- 각 `role` → 공통 프레임(`<CardFrame>`: 배경·여백·워터마크) + 역할별 레이아웃 컴포넌트.
  - `InfographicCard` (informationsend)
  - `HookCard` · `ProblemCard` · `EvidenceCard` · `SolutionCard` · `CtaCard` (cardnews)
- 결정론적 렌더: `Math.random`/`Date.now` 금지 (repick-design 규약). 동일 spec → 동일 픽셀 (테스트·hydration 안정).
- 두들/형광은 인라인 SVG + CSS로 (canvas 미사용).

---

## 9. 렌더링/Export 설계

- **엔진**: `html-to-image` — 미리보기 DOM 노드가 곧 export 소스 (WYSIWYG).
- **폰트 안정성**: export 전 `await document.fonts.ready` 로 폰트 로드 보장 (미로드 시 폰트 깨짐 방어). 카드 폰트는 export 시 임베드.
- **스케일**: 화면 미리보기는 축소 표시, export는 `pixelRatio`로 1080×1350 실측 해상도 보장.
- **cardnews**: 카드별 노드를 순회하며 N장 PNG 생성.
- **Phase 2 경로**: 서버 Playwright 스크린샷 (CLI 대량 배치). repick-design 검증 스크린샷 자산 재사용.

---

## 10. 폴더 출력 규약 (승인된 기본안)

- 기존 참고 예시(`informationsend/`·`cardnews/` 안의 현재 이미지) → `knowledge/references/`로 **이동**.
- 생성물은 원 폴더에 하위 폴더로 저장:
  - `informationsend/<키워드>-<MMDD>/1.png`
  - `cardnews/<키워드>-<MMDD>/1.png … 6.png`
- 파일명 슬러그: 공백/특수문자 정리 (경로 빌더 유닛에서 순수 함수로, 테스트 대상).

---

## 11. 에러 처리 (디버깅 규칙 준수 — 에러 숨김 금지)

| 상황 | 처리 |
|------|------|
| Claude API 실패 | 사용자에게 명시적 에러 + 재시도 버튼. 삼키지 않음. |
| LLM 오출력(스키마 불일치) | zod 검증 실패 → 1회 자동 재생성(구조화 출력으로 확률 낮음) → 재실패 시 원문+에러 노출 |
| 폰트 미로드 | `document.fonts.ready` 대기; 타임아웃 시 경고 후 진행 |
| 폴더 쓰기 권한 실패 | 서버 에러 그대로 표면화, 다운로드 폴백 제공 |
| 빈/과다 키워드 | 입력 검증 (길이·공백) |

---

## 12. 테스트 전략 (TDD: 순수 로직 RED→GREEN 우선)

- **단위**: ContentSpec zod 스키마(경계값), 프롬프트 조립(Vault 주입 결과), `appendLedger`, 경로/슬러그 빌더.
- **컴포넌트**: 각 템플릿이 fixture spec으로 결정론적 렌더 (스냅샷).
- **통합(경량)**: `/api/generate` (Claude 모킹) → 유효 ContentSpec. Export가 non-empty Blob 생성.
- **E2E(Phase 1 스모크)**: 키워드 입력 → 생성(모킹) → 미리보기 표시 → 다운로드 트리거.

---

## 13. 구현 순서 (수직 슬라이스)

1. 스캐폴드 (Next.js 16 + Tailwind v4 + Pretendard, repick-design 미러)
2. `knowledge/` 볼트 시드 + 참고 예시 이동
3. ContentSpec 스키마(zod) + 픽스처
4. 템플릿: `InfographicCard` 1종 먼저 (informationsend E2E 관통)
5. Copy Engine `/api/generate` (Claude + Vault 주입)
6. Export + `/api/save` + ledger append
7. 스튜디오 UI (입력→생성→캐러셀→다운로드)
8. cardnews 템플릿 5종 확장
9. 두 번째 유형 관통 검증

---

## 14. 미해결/Phase 2 기록

- 제품 사진 카드 (업로드 + 텍스트 오버레이) — 별도 스펙
- CLI 대량 배치 (Playwright)
- 성과 수치 피드백 루프 (ledger `perf` 활용)
- 인라인 카피 편집 에디터
- 추가 포맷(스토리/정사각)
- 카드 폰트 최종 선정 (Gaegu/Jua/Do Hyeon 중 실측 후 확정)

---

## 15. 결정 로그 (Decision Log)

| 결정 | 선택 | 근거 |
|------|------|------|
| 결과물 형태 | 웹 앱 (키워드→미리보기→다운로드) | 사용자 확정 |
| 카피 생성 | AI 자동 (Claude) | 사용자 확정 |
| 사진 카드 | Phase 2 | MVP는 순수 그래픽만 (사용자 확정) |
| 지식관리 | 볼트 5요소 + LLM 위키 | 사용자 확정 |
| 렌더 엔진 | html-to-image (클라) | WYSIWYG, 두들/형광/이모지 충실도, 서버 브라우저 불필요 |
| 스택 | repick-design 미러 (Next16/React19/Tailwind v4/Pretendard/npm) | 형제 일관성, 자산 재사용 |
| 폴더 | 참고본→knowledge/references, 생성물→원폴더/<키워드>-<날짜>/ | 사용자 확정(기본안) |

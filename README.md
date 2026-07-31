# 콘티 — 카드 스튜디오

직접 작업한 사진 폴더를 올려 순서를 정하고, Claude가 사진을 보고 쓴 카피를 얹어 인스타 카드 PNG로 뽑습니다.

## 실행
1. `npm install`
2. 로컬 `claude` CLI가 로그인되어 있어야 합니다 — 이 앱은 `claude -p` 서브프로세스를 호출하며, `ANTHROPIC_API_KEY`나 `ANTHROPIC_AUTH_TOKEN`은 읽지 않습니다
3. `npm run dev` → http://localhost:3500

## 화면
- `/` 허브 — 무엇을 만들지 고르고, 최근 만든 것을 봅니다
- `/cardnews` 카드뉴스 5스텝 — 사진 → 순서 → 주제 → 편집 → 내보내기
- `/info` 정보전달 4스텝 — 사진 → 주제 → 편집 → 내보내기

## 산출물 폴더
- `cardnews/<키워드슬러그>-<MMDD>/1.png … N.png`
- `informationsend/<키워드슬러그>-<MMDD>/1.png`

## 지식관리 (`knowledge/`)
- `brand-voice.md` / `copy-formulas.md` → 생성 프롬프트에 주입
- `templates.md` → 레이아웃·테마 카탈로그
- `ledger.jsonl` → 생성 이력(append-only). 허브의 "최근 만든 것"이 이 파일을 읽습니다

## 설계 문서
- 스펙: `docs/superpowers/specs/2026-07-31-conti-photo-studio-design.md`
- 계획: `docs/superpowers/plans/2026-07-31-conti-photo-studio.md`

## 스택
Next.js 16 · React 19 · Tailwind v4 · Claude CLI(claude-opus-4-8, vision) · zod · html-to-image · @dnd-kit · lucide-react

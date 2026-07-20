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

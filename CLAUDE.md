# repick-cardnews

사진 폴더를 넣으면 인스타 카드뉴스·정보전달 이미지를 만들어 주는 **로컬 스튜디오**.

## 무엇으로 도는가

- Next.js App Router · TypeScript · Tailwind · zod v4
- 카피 생성은 **로컬 `claude -p` CLI 서브프로세스**다. `ANTHROPIC_API_KEY` 를 쓰지 않는다 —
  로컬 OAuth 자격으로만 돈다
- 카드 이미지는 `src/templates/**` 가 그리고, 편집 화면(`CardCanvas`)이 **같은 값·같은 계산**을
  써서 화면과 저장 결과가 어긋나지 않게 한다

## 명령

```bash
npm run dev            # 3500 포트
npx tsc --noEmit       # 타입 (출력 0바이트여야 한다)
npx vitest run         # 테스트
npm run design:audit   # 정적 게이트 + 폭 스위프(dev 서버가 떠 있어야 한다)
```

## 반드시 읽을 것

- **화면을 만들거나 고치면 → `docs/ui-standards.md`**
  패널 골격 · 폭 · 2단 · 되돌릴 수 없는 조작 · 색 · 검증. 여백이 남는 화면이 반복돼서 규칙으로
  못 박은 것이다
- **배포를 건드리면 → `docs/deploy-setup.md`**
  Vercel 에 올라가 있다. 예약은 밖에서 오는 cron 이 깨운다. 토큰 자동 갱신은 **아직 안 된다**
- 인스타 연동을 건드리면 → `docs/instagram-setup.md`
- 소재 찾기·트렌드를 건드리면 → `docs/trend-setup.md`

## 지켜야 하는 것

- **사용자에게 영어·raw JSON 을 보이지 않는다.** 모든 문구는 한국어. `inKorean(raw, fallback)`
- **비밀값은 응답·오류·로그 어디에도 담지 않는다.** `.env.local` 에 실제 자격 증명이 있다 —
  열지 말고, 값을 로그·보고서에 옮기지 마라
- **`git add -A` 금지.** 만든 경로만 명시적으로 (`.claude/`·`.env.local` 이 미추적으로 있다)
- **테스트는 `environment: "node"`** 다. React 렌더 테스트를 쓸 수 없다 — 판단 로직을 순수
  함수로 빼서 테스트하고 컴포넌트에는 JSX·배선만 남긴다
- **손으로 베낀 값은 테스트로 묶는다.** 스키마 상한·API 상수·서버와 화면이 공유하는 목록 등.
  이 저장소는 그렇게 드리프트를 잡아 왔다(`MAX_STEPS`, `HEADING_MAX`, 테마 명암비,
  `FINDER_CATEGORIES`)
- **실측하지 않은 외부 API 값을 적지 않는다.** 확인했으면 근거와 날짜를 주석에 남긴다

## 자동으로 안 잡히는 것

`npm run design:audit` 의 폭 스위프는 `/`·`/info` 만 훑는다. **사진과 카드가
있어야 열리는 화면(작업대·내보내기)은 사람이 봐야 한다.**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

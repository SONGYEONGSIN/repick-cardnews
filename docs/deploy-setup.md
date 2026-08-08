# 배포 (Vercel)

이 스튜디오는 **Vercel 에 올라가 있다.** 주소는 바뀌지 않는다.

```
https://repick-cardnews.vercel.app
```

**이 문서는 실제로 확인한 것만 적는다.** 아직 안 되는 것은 아래 "안 되는 것" 에 그대로 적어 둔다.

## 지금 되는 것 (2026-08-08 실측)

| 무엇 | 확인한 방법 |
|---|---|
| 카피 생성 | 배포된 `/api/generate` 호출 → 200, 13.7초 |
| 로그인 | 고정 주소에서 `/` 307, 틀린 비밀번호 401, 맞으면 화면 200 |
| 인스타그램 이미지 경로 | `/s/없는토큰/1.png` → **404**(앱까지 닿음) |

## 안 되는 것 — 고치기 전까지 쓰지 마라

- **예약 발행.** 예약 큐와 카드 PNG 를 로컬 디스크에 쓰고(`src/lib/schedule-queue.ts`),
  스케줄러가 서버 프로세스 안 1분 타이머로 돈다(`src/instrumentation.ts`). 서버리스에는
  둘 다 없다. **화면에서 예약을 걸 수는 있지만 올라가지 않는다.**
- **인스타그램 토큰 자동 갱신.** `.env.local` 파일을 다시 쓰는 방식이라
  (`src/lib/instagram-token-refresh.ts`) 배포본에서는 동작하지 않는다. 만료 전에 사람이
  직접 갱신해야 한다.

즉시 올리기(`지금 바로 업로드`)는 위 둘과 무관하므로 **동작할 것으로 보이지만 아직 실측하지
않았다.** 처음 쓸 때 결과를 확인하고 이 문서를 고칠 것.

## 카피 생성이 배포에서 도는 방식

로컬은 PATH 의 `claude` 를 쓴다. 배포 서버에는 그런 게 없으므로 둘을 더 얹었다.

1. **실행 파일을 함께 싣는다.** `@anthropic-ai/claude-code` 를 의존성에 넣고,
   `next.config.ts` 의 `outputFileTracingIncludes` 로 배포에 포함시킨다 — `spawn` 으로만
   부르는 파일이라 Next 추적기가 스스로 찾지 못한다. **267MB 짜리 네이티브 바이너리다.**
2. **토큰을 넘긴다.** `REPICK_CLAUDE_OAUTH_TOKEN`(→ `claude setup-token` 으로 발급).
   API 키가 아니라 구독 자격에 붙은 OAuth 토큰이다. `.env.local` 에 남은 옛 토큰이 새지
   않도록 **이 이름으로 받은 값만** 자식 프로세스에 넘긴다(`src/lib/claude-cli.ts`).

## 로그인

Vercel Hobby 는 **배포별 URL 만 보호하고 고정 주소(`*.vercel.app`)는 공개**다. 그래서 앱이
직접 막는다(`src/middleware.ts` → `src/lib/auth.ts`).

- `/s/*` 만 연다 — 인스타그램 서버가 카드 이미지를 가져가야 한다. 그 경로는 추측할 수 없는
  토큰이 지킨다
- 설정(`APP_PASSWORD`·`AUTH_SECRET`)이 없으면 **아무도 못 들어온다.** 열리는 쪽으로 실패하면
  배포 한 번에 인스타 계정이 열린다
- 비밀번호는 해시하지 않고 상수시간으로 비교한다. 해시가 막는 것은 "환경변수는 봤지만
  로그인은 못 하게" 인데, 환경변수를 본 사람은 이미 인스타 토큰을 쥔다. 대신 **외울 수 없는
  긴 무작위 문자열**을 써서 대입 공격을 막는다

## 배포하기

```bash
npx vercel deploy --prod
npx vercel alias set <새로 나온 배포 URL> repick-cardnews.vercel.app
```

`alias set` 을 빠뜨리면 고정 주소가 옛 배포를 계속 가리킨다.

## 환경변수

값은 Vercel 프로젝트 설정에 있다. 무엇을 채워야 하는지는 `.env.example` 에 적혀 있다.
**production 과 preview 양쪽에 넣어야 한다** — 한쪽만 넣으면 그쪽 배포에서만 돈다.

`PUBLIC_BASE_URL` 은 아직 넣지 않았다. 예약 발행을 되살릴 때 `https://repick-cardnews.vercel.app`
로 넣는다.

## 막혔을 때

- 로그인 화면만 반복되면 `AUTH_SECRET` 이 배포에 없는 것이다(없으면 잠긴다)
- 카피 생성이 실패하면 `REPICK_CLAUDE_OAUTH_TOKEN` 만료를 먼저 본다 — 다시 발급하려면
  로컬에서 `claude setup-token`
- `/s/…` 가 404 가 아니라 307 을 주면 인스타그램이 이미지를 못 가져간다. `isPublicPath` 를 본다

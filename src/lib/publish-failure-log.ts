import { InstagramApiError, InstagramTimeoutError } from "@/lib/instagram";

/**
 * 게시 실패의 **진단용 한 줄**. 서버 콘솔에만 남긴다 — 사용자에게 가는 문구는 언제나
 * `friendlyPublishError` 의 한국어다.
 *
 * 왜 필요한가: 실패 원문을 어디에도 남기지 않아, 인스타그램이 왜 거절했는지 알 방법이
 * 없었다(2026-08-05: "게시에 실패했어요" 만 보이고 그 뒤가 캄캄했다). 원인을 모르면 고칠
 * 수도 없다.
 *
 * **비밀값은 반드시 가린다.** 토큰이 응답 본문에 되비칠 수 있으므로(`Error validating
 * access token: …`) 넘겨받은 값들을 전부 지운 뒤에 돌려준다.
 */
export function publishFailureDetail(e: unknown, secrets: readonly string[]): string {
  const raw =
    e instanceof InstagramApiError
      ? `${e.message} · ${JSON.stringify(e.body)}`
      : e instanceof InstagramTimeoutError
        ? `시간 초과 · ${e.message}`
        : e instanceof Error
          ? e.message
          : String(e);

  let out = raw;
  for (const secret of secrets) {
    if (secret.length >= 8) out = out.split(secret).join("***");
  }
  return out.slice(0, 500);
}

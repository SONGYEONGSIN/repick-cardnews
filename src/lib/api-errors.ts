/**
 * Anthropic SDK 의 오류를 사용자에게 보여 줄 한국어 문장으로 바꾼다.
 *
 * SDK 는 실패 시 응답 본문(JSON)을 그대로 message 에 담는다. 그걸 화면에 흘리면
 * 사용자는 `{"type":"error","error":{...}}` 덩어리를 보게 된다 — Pro/Max 계정에서
 * rate limit 은 정상적으로 마주치는 상황이라 특히 그렇다.
 */
/** SDK 의 APIError 는 status 를 갖지만 Error 타입에는 없다 — 단언 없이 좁힌다. */
function statusOf(e: Error): number | null {
  if ("status" in e && typeof e.status === "number") return e.status;
  return null;
}

export function friendlyGenerateError(e: unknown): string {
  if (!(e instanceof Error)) return "생성 중 오류가 났어요. 다시 시도해 주세요.";

  const status = statusOf(e);

  if (status === 429) {
    return "지금 요청이 몰려 있어요. 잠시 후 다시 시도해 주세요.";
  }
  if (status === 401 || status === 403) {
    return "Claude 인증이 만료됐거나 권한이 없어요. .env.local 의 토큰을 다시 확인해 주세요.";
  }
  if (status === 529) {
    return "Claude 가 과부하 상태예요. 잠시 후 다시 시도해 주세요.";
  }
  if (status !== null && status >= 500) {
    return "Claude 쪽에서 오류가 났어요. 잠시 후 다시 시도해 주세요.";
  }
  if (status === 400) {
    return "요청이 올바르지 않아요. 사진 수나 키워드를 확인해 주세요.";
  }

  // status 가 없으면 네트워크·타임아웃 등 우리 쪽 오류다 — 메시지가 이미 사람이 읽을 만하다.
  return e.message;
}

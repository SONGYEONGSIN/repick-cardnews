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

/**
 * 실패한 게시가 **무엇을 넘겼는지**. 어느 호출인지까지 좁혔는데도 원인이 안 잡힐 때, 남은
 * 차이는 값뿐이다(2026-08-05: 손으로는 되고 예약만 `/media` 에서 거절).
 *
 * **공유 토큰은 가린다** — 그 주소를 아는 사람은 사진을 가져갈 수 있다. 호스트와 파일 이름은
 * 남긴다: 주소가 맞는지 봐야 하기 때문이다. 캡션은 **길이만** 담는다.
 */
export function publishContextLine({
  imageUrl,
  captionLength,
  imageCount,
}: {
  imageUrl: string;
  captionLength: number;
  imageCount: number;
}): string {
  const masked = imageUrl.replace(/\/s\/[^/]+\//, "/s/***/");
  return `주소 ${masked} · 캡션 ${captionLength}자 · ${imageCount}장`;
}

/**
 * 인스타그램 게시물 해시태그 — 2025-12부터 게시물당 5개로 제한한다(넘으면 탐색·추천에
 * 노출되지 않는다). 이 파일은 화면(`InstagramPublishPanel`)과 서버(`/api/publish`)가
 * 함께 쓰는 순수 함수만 담는다 — 네트워크·DOM 어느 쪽에도 의존하지 않는다.
 */
export const MAX_HASHTAGS = 5;

/** 사용자가 `#`을 붙이든 안 붙이든 같은 값으로 정리한다. 앞뒤 공백도 없앤다. */
export function normalizeHashtag(raw: string): string {
  return raw.trim().replace(/^#+/, "").trim();
}

/**
 * 공백·쉼표로 구분된 원문을 해시태그 배열로 쪼갠다. 정규화 후 빈 값은 버리고, 중복은
 * 처음 나온 것만 남긴다(개수 제한을 실제로 쓴 태그 기준으로 판단하기 위해).
 */
export function parseHashtags(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of raw.split(/[\s,]+/)) {
    const normalized = normalizeHashtag(token);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export type HashtagValidation = { ok: true } | { ok: false; message: string };

/** 인스타그램의 게시물당 5개 제한을 넘으면 왜 막혔는지 한국어로 알려준다. */
export function validateHashtagCount(tags: string[]): HashtagValidation {
  if (tags.length > MAX_HASHTAGS) {
    return {
      ok: false,
      message: `해시태그는 최대 ${MAX_HASHTAGS}개까지만 쓸 수 있어요(지금 ${tags.length}개) — 인스타그램은 5개를 넘으면 탐색·추천에 올리지 않아요.`,
    };
  }
  return { ok: true };
}

/**
 * 캡션과 해시태그를 인스타그램에 보낼 하나의 글로 합친다. 캡션 뒤에 빈 줄을 하나 두고
 * `#태그` 를 공백으로 나열한다 — 인스타그램 앱이 흔히 쓰는 배치(본문과 태그 줄 분리)다.
 */
export function combineCaptionWithHashtags(caption: string, tags: string[]): string {
  const trimmedCaption = caption.trim();
  if (tags.length === 0) return trimmedCaption;
  const tagLine = tags.map((t) => `#${t}`).join(" ");
  return trimmedCaption ? `${trimmedCaption}\n\n${tagLine}` : tagLine;
}

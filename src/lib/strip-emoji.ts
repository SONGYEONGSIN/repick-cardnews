/**
 * Claude 가 쓴 카피에서 **이모지를 걷어낸다.**
 *
 * 시키지 않아도 얹어 오는데(2026-08-04: 제목 끝에 돈다발 그림, 팁 앞뒤로 체크 표시),
 * 카드에서는 제목을 한 줄 더 밀어내 띠를 키우고 팁 앞에 군더더기를 남긴다.
 *
 * **지우는 것과 남기는 것**: 유니코드 속성 `Extended_Pictographic` 만 지운다 — 그림 문자
 * 계열이다. `°C`·`%`·`→`·`·` 같은 실제로 쓰는 기호는 이 속성이 아니라 그대로 남는다.
 * 국기(지역 지표), 피부색·변형 선택자(FE0F), 이어 붙이는 ZWJ 도 함께 지운다 — 안 지우면
 * 그림만 빠지고 보이지 않는 조각이 남는다.
 */
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/gu;

export function stripEmoji(text: string): string {
  return text.replace(EMOJI, "").replace(/\s+/g, " ").trim();
}

/** 스펙처럼 중첩된 값 전체를 훑어 문자열마다 `stripEmoji` 를 건다. */
export function stripEmojiDeep<T>(value: T): T {
  if (typeof value === "string") return stripEmoji(value) as T;
  if (Array.isArray(value)) return value.map(stripEmojiDeep) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripEmojiDeep(v)])) as T;
  }
  return value;
}

/**
 * 카드 우측 상단의 **[광고]** 표기.
 *
 * 협찬·광고를 받은 게시물에는 그 사실을 밝혀야 한다(표시광고법). 인스타에서 흔히 쓰는
 * 자리와 모양을 그대로 따랐다 — 우측 상단, 작게, 대괄호.
 *
 * **문구를 마음대로 바꾸지 않는다.** 줄이거나 영어로 쓰면 표기로 인정되지 않을 수 있다.
 * 그래서 상수로 못 박고 테스트로 묶는다.
 */
export const AD_BADGE_TEXT = "[광고]";

/** 카드 폭(1080) 기준 크기. 눈에 띄되 내용을 가리지 않는 선. */
export const AD_BADGE_FONT_SIZE = 26;

/**
 * 사진 위에서는 카드 글자색이 사진에 묻힌다 — 스크림 위에 얹는 색(`onPhoto`)을 쓴다.
 * 팁 상자(`InfoFrame`)가 같은 이유로 같은 판단을 한다.
 */
export function adBadgeColor(theme: { fg: string; onPhoto: string }, onPhoto: boolean): string {
  return onPhoto ? theme.onPhoto : theme.fg;
}

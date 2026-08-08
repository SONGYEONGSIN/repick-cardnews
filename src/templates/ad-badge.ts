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

/**
 * 이 카드에 표기를 넣을지.
 *
 * 인스타는 캐러셀 **첫 장 우측 상단에 `1/4` 장수 표시**를 얹는다. 거기에 [광고]를 두면 가려져
 * 표기를 안 한 것과 같아진다 — 참고 사진에서 실제로 겹쳤다(2026-08-09). 그래서 여러 장일
 * 때는 **둘째 장부터** 넣는다.
 *
 * **한 장짜리(정보전달)는 예외다.** 장수 표시가 없으니 가릴 것도 없고, 첫 장을 건너뛰면
 * 어디에도 안 붙어 표기 자체가 사라진다.
 */
export function showAdBadge(ad: boolean, index: number, total: number): boolean {
  if (!ad) return false;
  return total === 1 || index > 0;
}

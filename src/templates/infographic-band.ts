/**
 * 사진이 없는 정보전달 카드는 사진 자리를 **테마 색 띠**로 바꾸고 제목을 그 안에 넣는다.
 *
 * 이 판단을 **한 함수로 둔다** — `CardRenderer`(띠를 그릴지)와 `InfographicBody`(제목을
 * 건너뛸지)가 각자 판단하면 어긋나 제목이 두 번 나오거나 하나도 안 나온다.
 *
 * 띠는 **사진의 대역**이지 별개 모드가 아니다. 사진을 넣으면 그 자리에 사진이 들어가고 제목은
 * 본문으로 돌아간다 — 레이아웃이 하나라 코드가 갈라지지 않는다.
 */
export function titleInBand(photoUrl: string | null, layout: string): boolean {
  // 빈 문자열도 "없음"으로 본다 — 사진을 지운 뒤 빈 값이 남을 수 있다.
  return layout === "split" && !photoUrl;
}

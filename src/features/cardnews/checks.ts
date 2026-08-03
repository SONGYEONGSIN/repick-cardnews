import { isBlankText } from "@/templates/layout-utils";
import type { CardnewsState } from "./reducer";

/**
 * 만들기 화면 사이드바의 **점검 목록** — 지금 상태에서 내보내기 전에 고쳐야 할 것을 짚는다.
 *
 * 사이드바가 "형태 / 올린 사진" 두 줄뿐이라 아래가 비어 있었다. 빈 자리를 장식으로 채우지 않고,
 * **여기서만 보이는 사실**(카드 전체를 훑어야 알 수 있는 것)을 넣는다 — 툴바는 지금 고른 카드
 * 하나만 보여 주므로 "몇 번 카드에 사진이 없는지"는 카드를 하나씩 넘겨 봐야 알 수 있었다.
 *
 * 순수 함수다 — 이 저장소 vitest 는 `environment: "node"` 라 화면을 못 그리고, 판단은 전부
 * 이런 함수로 빼서 테스트한다.
 */

/** 스키마(`CardnewsCard`)의 상한과 같아야 한다 — `checks.test.ts` 가 그 일치를 잠근다. */
export const HEADING_MAX = 40;
export const BODY_MAX = 120;

export type WorkbenchCheck = {
  /** `todo` 는 사용자가 할 일이 남았다는 뜻, `ok` 는 다 됐다는 뜻이다. */
  tone: "todo" | "ok";
  text: string;
};

function countCards(state: CardnewsState, match: (card: CardnewsState["cards"][number]) => boolean): number {
  return state.cards.filter(match).length;
}

export function workbenchChecks(state: CardnewsState): WorkbenchCheck[] {
  // 카드가 아직 없으면 점검할 게 없다 — 사진만 올린 상태에서 "고칠 게 있다"고 말하면 안 된다.
  if (state.cards.length === 0) return [];

  const checks: WorkbenchCheck[] = [];

  // '글만' 구성은 원래 사진을 안 쓴다 — 사진 없음을 문제로 세면 거짓 경고가 된다.
  const noPhoto = countCards(
    state,
    (c) => c.layout !== "text-only" && !state.photos.some((p) => p.id === c.photoId),
  );
  if (noPhoto > 0) checks.push({ tone: "todo", text: `사진이 없는 카드 ${noPhoto}장` });

  const blankHeading = countCards(state, (c) => isBlankText(c.copy.heading));
  if (blankHeading > 0) checks.push({ tone: "todo", text: `헤드라인이 빈 카드 ${blankHeading}장` });

  const blankBody = countCards(state, (c) => "body" in c.copy && isBlankText(c.copy.body));
  if (blankBody > 0) checks.push({ tone: "todo", text: `본문이 빈 카드 ${blankBody}장` });

  const tooLong = countCards(
    state,
    (c) => c.copy.heading.length > HEADING_MAX || ("body" in c.copy && c.copy.body.length > BODY_MAX),
  );
  if (tooLong > 0) checks.push({ tone: "todo", text: `글자 수를 넘긴 카드 ${tooLong}장` });

  if (checks.length === 0) checks.push({ tone: "ok", text: "다 됐어요. 내보낼 수 있어요." });
  return checks;
}

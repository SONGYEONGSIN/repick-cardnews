import { isBlankText } from "@/templates/layout-utils";
import type { WorkbenchCheck } from "@/features/cardnews/checks";
import { ITEMS_MIN, type InfoState } from "./reducer";

/**
 * 만들기 화면 사이드바의 **점검 목록** — 카드뉴스 `workbenchChecks` 와 같은 자리, 같은 모양
 * (`{ tone, text }`)이다. 두 형식을 오가며 다른 규칙을 배우지 않게 한다.
 *
 * 정보전달은 카드 한 장이라 "몇 번째 카드"가 없다 — 대신 제목·항목·글자 수를 본다.
 * **사진 없음은 세지 않는다.** 사진은 선택이라(없으면 제목이 테마 색 띠로 그려진다) 경고하면
 * 아무 문제 없는 상태를 결함으로 읽게 만든다.
 *
 * 순수 함수다 — 이 저장소 vitest 는 `environment: "node"` 라 화면을 못 그리고, 판단은 전부
 * 이런 함수로 빼서 테스트한다.
 */

/** 스키마(`InfographicSpec`)의 상한과 같아야 한다 — `checks.test.ts` 가 그 일치를 잠근다. */
export const TITLE_MAX = 40;
export const SUBTITLE_MAX = 60;
export const ITEM_KEYWORD_MAX = 30;
export const ITEM_DESC_MAX = 120;
export const TIP_MAX = 120;

export function infoChecks(state: InfoState): WorkbenchCheck[] {
  const spec = state.spec;
  // 카피가 아직 없으면 점검할 게 없다 — 만들기 전에 "고칠 게 있다"고 말하면 안 된다.
  if (!spec) return [];

  const checks: WorkbenchCheck[] = [];

  if (isBlankText(spec.title)) checks.push({ tone: "todo", text: "제목이 비어 있어요" });

  const blankItems = spec.items.filter((item) => isBlankText(item.keyword) || isBlankText(item.desc)).length;
  if (blankItems > 0) checks.push({ tone: "todo", text: `내용이 빈 항목 ${blankItems}개` });

  // 넘긴 **곳**을 센다 — 항목 하나에 키워드·설명이 둘 다 넘칠 수 있어 항목 수로는 못 센다.
  const overLimits = [
    spec.title.length > TITLE_MAX,
    (spec.subtitle ?? "").length > SUBTITLE_MAX,
    (spec.tip ?? "").length > TIP_MAX,
    ...spec.items.flatMap((item) => [item.keyword.length > ITEM_KEYWORD_MAX, item.desc.length > ITEM_DESC_MAX]),
  ].filter(Boolean).length;
  if (overLimits > 0) checks.push({ tone: "todo", text: `글자 수를 넘긴 곳 ${overLimits}군데` });

  if (spec.items.length < ITEMS_MIN) {
    checks.push({ tone: "todo", text: `항목이 ${spec.items.length}개예요 — ${ITEMS_MIN}개부터 채워 주세요` });
  }

  if (checks.length === 0) checks.push({ tone: "ok", text: "다 됐어요. 내보낼 수 있어요." });
  return checks;
}

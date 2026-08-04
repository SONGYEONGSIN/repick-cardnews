/**
 * 만들기 화면이 **지금 무엇을 보여 줄 차례인지** 정한다.
 *
 * 정보전달은 사진이 선택이다. 그런데 드롭존과 '카피 만들기'를 나란히 두면 사진이 필수처럼
 * 읽힌다 — 그래서 쓸지 말지를 먼저 묻고, 고른 뒤에 다음 것을 보여 준다.
 *
 * 순수 함수다 — 이 저장소 vitest 는 `environment: "node"` 라 화면을 못 그린다.
 */

/** 사용자가 시작 방식을 골랐는가. 저장할 값이 아니라 이 화면을 보는 동안의 선택이다. */
export type StartChoice = "unset" | "with-photo" | "without-photo";

/** 왼쪽 칸이 지금 보여 줄 것. `choose` 고르기 · `upload` 사진 올리기 · `ready` 만들기. */
export type PhotoStage = "choose" | "upload" | "ready";

export function photoStage(choice: StartChoice, photoCount: number, hasSpec: boolean): PhotoStage {
  // 되돌아왔을 때 이미 만든 카드가 있으면 처음 질문을 다시 묻지 않는다 — 고치러 온 것이다.
  if (hasSpec) return "ready";
  if (choice === "unset") return "choose";
  if (choice === "with-photo" && photoCount === 0) return "upload";
  return "ready";
}

export function canGenerate(stage: PhotoStage): boolean {
  return stage === "ready";
}

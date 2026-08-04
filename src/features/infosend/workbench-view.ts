import { elapsedLabel } from "@/features/cardnews/screens/topic-suggest";

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

/**
 * 드롭존을 여는 길은 **둘**이다: 처음에 '사진 올리고 만들기'를 고른 경우(`upload`)와, 이미
 * 만들 준비가 된 상태에서 '사진 올리기'를 다시 누른 경우(`ready` + `adding`).
 *
 * 두 길을 각자 그리다가 나가는 문을 한쪽에만 달아 두 번째 경로에서 다시 막혔다 — 그래서
 * 판단을 여기 한 곳에 둔다.
 */
export function dropzoneOpen(stage: PhotoStage, adding: boolean, busy: boolean): boolean {
  // 카피를 쓰는 중에는 그 위에 파일을 떨구게 두지 않는다.
  if (busy) return false;
  return stage === "upload" || (stage === "ready" && adding);
}

/**
 * 드롭존에서 빠져나가는 문. 사진이 없으면 '사진 없이 만들기'로 나가고, 이미 올린 사진이
 * 있으면 '취소'다 — 사진이 있는데 '사진 없이'로 보내면 그 사진이 그대로 카드에 남아 말과
 * 달라진다.
 */
export function dropExit(photoCount: number): "cancel" | "without-photo" {
  return photoCount > 0 ? "cancel" : "without-photo";
}

/**
 * 카피 생성은 실측 24초, 상한 120초(`@/app/api/generate/route`)다. 그동안 화면이 버튼 글자만
 * 바꿔 두면 **얼마나 더 기다려야 하는지 알 수 없다** — 지난 시간과 예상 시간을 함께 말한다.
 */
const GENERATE_EXPECTED_SECONDS = 30;
export const GENERATE_EXPECTED_LABEL = elapsedLabel(GENERATE_EXPECTED_SECONDS);

export function generateStatus({
  busy,
  elapsed,
  hasSpec,
  canStart,
}: {
  busy: boolean;
  /** 생성을 시작한 뒤 지난 초. */
  elapsed: number;
  hasSpec: boolean;
  canStart: boolean;
}): string {
  if (busy) return `카피를 쓰는 중이에요 · ${elapsedLabel(elapsed)} 지났어요 (보통 ${GENERATE_EXPECTED_LABEL} 안팎)`;
  if (!canStart) return "사진을 올리면 만들 수 있어요.";
  if (hasSpec) return "다시 만들면 지금 고친 글은 사라져요.";
  return "주제를 보고 제목·항목·팁을 써요.";
}

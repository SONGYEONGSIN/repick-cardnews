/**
 * 인스타에 올리는 화면의 **문지기**와 **올릴 때 고르기**.
 *
 * 예전엔 연결 확인·토큰 갱신·즉시 올리기·예약이 한 자리에 뒤섞여 있었고, 연결을 확인하지
 * 않아도 올리기 버튼이 눌렸다 — 그러다 오래 기다린 끝에 인증 실패로 튕겼다. 이제 연결
 * 확인을 통과해야 다음으로 넘어간다.
 *
 * 순수 함수다 — 이 저장소 vitest 는 `environment: "node"` 라 화면을 못 그린다.
 */

export type UploadGate = {
  /** '연결 확인' 을 눌러 실제로 계정이 확인됐는가. */
  verified: boolean;
  /** 다른 내보내기(저장·폰으로 보내기 등)가 도는 중인가. */
  busy: boolean;
  /** 이 패널이 지금 올리는 중인가. */
  publishing: boolean;
  hasCard: boolean;
  /** 이 세션이 건 예약이 아직 대기 중인가 — 겹쳐 올리면 두 번 올라간다. */
  alreadyScheduled: boolean;
};

export function canUpload(gate: UploadGate): boolean {
  return gate.verified && gate.hasCard && !gate.busy && !gate.publishing && !gate.alreadyScheduled;
}

/**
 * 못 누르는 이유. 막을 게 없으면 `null`.
 *
 * 겹칠 때는 **먼저 해야 하는 것**을 말한다 — 순서대로 안내하지 않으면 하나를 고치고 또
 * 막히는 일이 반복된다.
 */
export function uploadBlockReason(gate: UploadGate): string | null {
  if (!gate.verified) return "먼저 연결 확인을 눌러 주세요.";
  if (!gate.hasCard) return "올릴 카드가 없어요.";
  if (gate.alreadyScheduled) return "이미 예약이 걸려 있어요. 바꾸려면 아래에서 먼저 취소해 주세요.";
  if (gate.publishing) return "올리는 중이에요.";
  if (gate.busy) return "다른 내보내기가 도는 중이에요.";
  return null;
}

export type UploadMode = "now" | "later";

/** 올릴 때를 고르는 두 갈래. 셋 이상으로 늘리지 않는다 — 고르는 것이지 할 일 목록이 아니다. */
export const UPLOAD_MODES: readonly { id: UploadMode; label: string; note: string }[] = [
  { id: "now", label: "지금 바로", note: "누르면 바로 올라가요" },
  { id: "later", label: "예약", note: "정해 둔 시각에 자동으로" },
];

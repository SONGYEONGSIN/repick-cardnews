import { describe, it, expect } from "vitest";
import { UPLOAD_MODES, canUpload, uploadBlockReason, type UploadGate } from "./publish-gate";

/**
 * 인스타에 올리는 화면의 **문지기**.
 *
 * 예전엔 연결 확인·토큰 갱신·즉시 올리기·예약이 한 자리에 뒤섞여 있었고, 연결을 확인하지
 * 않아도 올리기 버튼이 눌렸다 — 그러다 100초를 기다린 끝에 인증 실패로 튕겼다. 이제
 * **연결 확인을 통과해야** 다음으로 넘어간다.
 *
 * 순수 함수다 — 이 저장소 vitest 는 `environment: "node"` 라 화면을 못 그린다.
 */
const ok: UploadGate = {
  verified: true,
  busy: false,
  publishing: false,
  hasCard: true,
  alreadyScheduled: false,
};

describe("canUpload", () => {
  it("연결을 확인했고 카드가 있으면 올릴 수 있다", () => {
    expect(canUpload(ok)).toBe(true);
  });

  it("연결 확인 전에는 못 올린다 — 100초 기다린 끝에 인증 실패로 튕기지 않게", () => {
    expect(canUpload({ ...ok, verified: false })).toBe(false);
  });

  it("카드가 없으면 못 올린다", () => {
    expect(canUpload({ ...ok, hasCard: false })).toBe(false);
  });

  it("다른 내보내기가 도는 중이면 못 올린다", () => {
    expect(canUpload({ ...ok, busy: true })).toBe(false);
  });

  it("이미 올리는 중이면 또 못 누른다 — 두 번 누르면 두 번 올라간다", () => {
    expect(canUpload({ ...ok, publishing: true })).toBe(false);
  });

  it("이미 예약이 걸려 있으면 못 올린다 — 예약분과 겹쳐 두 번 올라간다", () => {
    expect(canUpload({ ...ok, alreadyScheduled: true })).toBe(false);
  });
});

describe("uploadBlockReason — 왜 못 누르는지 말한다", () => {
  it("막을 이유가 없으면 null 이다", () => {
    expect(uploadBlockReason(ok)).toBeNull();
  });

  it("연결 확인이 먼저다", () => {
    expect(uploadBlockReason({ ...ok, verified: false })).toContain("연결 확인");
  });

  it("카드가 없으면 그렇게 말한다", () => {
    expect(uploadBlockReason({ ...ok, hasCard: false })).toContain("카드");
  });

  it("예약이 걸려 있으면 그렇게 말한다", () => {
    expect(uploadBlockReason({ ...ok, alreadyScheduled: true })).toContain("예약");
  });

  // 두 가지가 겹치면 **먼저 해야 하는 것**을 말한다 — 순서대로 안내하지 않으면 헤맨다.
  it("연결 확인과 카드 없음이 겹치면 연결 확인을 먼저 말한다", () => {
    expect(uploadBlockReason({ ...ok, verified: false, hasCard: false })).toContain("연결 확인");
  });
});

describe("UPLOAD_MODES — 올릴 때를 고른다", () => {
  it("지금 바로와 예약, 둘뿐이다", () => {
    expect(UPLOAD_MODES.map((m) => m.id)).toEqual(["now", "later"]);
  });

  it("각 방법이 무엇인지 한 줄로 말한다", () => {
    for (const mode of UPLOAD_MODES) {
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.note.length).toBeGreaterThan(0);
    }
  });
});

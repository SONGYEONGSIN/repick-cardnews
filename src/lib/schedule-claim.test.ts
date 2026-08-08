import { describe, expect, it } from "vitest";
import { CLAIM_STALE_MS, canClaim } from "./schedule-claim";

describe("canClaim", () => {
  it("대기 중이면 올릴 수 있다", () => {
    expect(canClaim({ status: "pending" }, 1000)).toBe(true);
  });

  // 다른 tick 이 이미 들고 있다. 여기서 또 올리면 같은 사진이 두 번 올라간다.
  it("방금 찜한 것은 건너뛴다", () => {
    expect(canClaim({ status: "publishing", claimedAt: 1000 }, 1000 + CLAIM_STALE_MS - 1)).toBe(false);
  });

  // 함수가 중간에 죽으면 publishing 인 채로 영원히 남는다 — 풀어 줘야 한다.
  it("찜한 지 오래되면 다시 가져온다", () => {
    expect(canClaim({ status: "publishing", claimedAt: 1000 }, 1000 + CLAIM_STALE_MS)).toBe(true);
  });

  it("claimedAt 이 없는 publishing 은 다시 가져온다 — 옛 기록", () => {
    expect(canClaim({ status: "publishing" }, 5000)).toBe(true);
  });

  it("끝난 것은 다시 올리지 않는다", () => {
    for (const status of ["published", "failed", "missed", "canceled"]) {
      expect(canClaim({ status }, 1000), status).toBe(false);
    }
  });

  it("기준은 10분이다 — 낮추면 이 테스트가 먼저 깨진다", () => {
    expect(CLAIM_STALE_MS).toBe(10 * 60 * 1000);
  });
});

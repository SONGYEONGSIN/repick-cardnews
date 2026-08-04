import { describe, it, expect } from "vitest";
import { tunnelFailureMessage, type TunnelReach } from "@/lib/tunnel-reach";

/**
 * "터널이 꺼졌다"와 "주소가 옛 터널을 가리킨다"가 **같은 문구**로 나왔다(2026-08-05). 실제로
 * 그 둘을 구분 못 해, 터널은 멀쩡히 도는데 `.env.local` 만 옛 주소인 상황에서 사용자가
 * 터널을 붙잡고 한참을 헤맸다. 닿았는지·응답이 뭔지로 갈라 말한다.
 */
describe("tunnelFailureMessage", () => {
  it("아예 못 닿으면 주소부터 의심하게 말한다", () => {
    const msg = tunnelFailureMessage("unreachable");
    expect(msg).toContain("주소");
    expect(msg).toContain("PUBLIC_BASE_URL");
  });

  it("닿았는데 사진이 안 열리면 그렇게 말한다 — 터널 탓으로 몰지 않는다", () => {
    const msg = tunnelFailureMessage("not-ok");
    expect(msg).toContain("사진");
    expect(msg).not.toContain("꺼져");
  });

  it("두 문구가 서로 다르다 — 갈라 놓은 이유가 그것이다", () => {
    expect(tunnelFailureMessage("unreachable")).not.toBe(tunnelFailureMessage("not-ok"));
  });

  it("어느 쪽도 영문이나 원문을 흘리지 않는다", () => {
    for (const kind of ["unreachable", "not-ok"] as Exclude<TunnelReach, "ok">[]) {
      const msg = tunnelFailureMessage(kind);
      expect(/[A-Za-z]{4,}/.test(msg.replace("PUBLIC_BASE_URL", ""))).toBe(false);
    }
  });
});

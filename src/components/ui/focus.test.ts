import { describe, it, expect } from "vitest";
import { FOCUS_RING } from "@/components/ui/focus";

describe("FOCUS_RING", () => {
  it("focus-visible 로만 링을 노출한다", () => {
    // outline-none 단독은 금지 — 키보드 사용자가 포커스를 잃는다
    expect(FOCUS_RING).toContain("focus-visible:");
    expect(FOCUS_RING).not.toMatch(/(^|\s)outline-none(\s|$)/);
  });

  it("액센트 색 링과 오프셋을 갖는다", () => {
    expect(FOCUS_RING).toContain("focus-visible:outline-2");
    expect(FOCUS_RING).toContain("focus-visible:outline-offset-2");
    expect(FOCUS_RING).toContain("outline-plum");
  });
});

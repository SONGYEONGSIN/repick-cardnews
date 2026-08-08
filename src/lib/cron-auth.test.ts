import { describe, expect, it } from "vitest";
import { checkCronSecret } from "./cron-auth";

describe("checkCronSecret", () => {
  it("맞으면 통과", () => {
    expect(checkCronSecret("비밀값", "비밀값")).toBe(true);
  });

  it("틀리면 거절", () => {
    expect(checkCronSecret("틀린값", "비밀값")).toBe(false);
  });

  // 설정이 없으면 잠긴다 — 열어 두면 아무나 게시를 돌릴 수 있다.
  it("서버에 비밀이 설정돼 있지 않으면 거절한다", () => {
    expect(checkCronSecret("무엇이든", undefined)).toBe(false);
    expect(checkCronSecret("무엇이든", "")).toBe(false);
  });

  it("안 주면 거절", () => {
    expect(checkCronSecret(null, "비밀값")).toBe(false);
    expect(checkCronSecret("", "비밀값")).toBe(false);
  });
});

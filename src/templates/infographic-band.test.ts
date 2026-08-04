import { describe, it, expect } from "vitest";
import { titleInBand } from "@/templates/infographic-band";

describe("titleInBand — 제목을 띠에 넣을지", () => {
  it("split 레이아웃에 사진이 없으면 띠에 넣는다", () => {
    expect(titleInBand(null, "split")).toBe(true);
  });

  it("사진이 있으면 넣지 않는다 — 사진이 그 자리를 쓴다", () => {
    expect(titleInBand("data:image/png;base64,AAA", "split")).toBe(false);
  });

  it("split 이 아니면 넣지 않는다 — 카드뉴스 경로를 건드리지 않는다", () => {
    expect(titleInBand(null, "full-bleed")).toBe(false);
    expect(titleInBand(null, "text-only")).toBe(false);
  });

  it("빈 문자열 사진은 사진이 없는 것으로 본다 — 지운 뒤 빈 값이 남을 수 있다", () => {
    expect(titleInBand("", "split")).toBe(true);
  });
});

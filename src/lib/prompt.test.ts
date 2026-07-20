import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/prompt";

const vault = { brandVoice: "해요체 기본", copyFormulas: "hook→problem→evidence→solution→cta" };

describe("buildSystemPrompt", () => {
  it("볼트 텍스트를 프롬프트에 주입한다", () => {
    const p = buildSystemPrompt("cardnews", vault);
    expect(p).toContain("해요체 기본");
    expect(p).toContain("hook→problem→evidence→solution→cta");
  });
  it("유형별 출력 규칙을 포함한다", () => {
    expect(buildSystemPrompt("informationsend", vault)).toContain("informationsend");
    expect(buildSystemPrompt("cardnews", vault)).toContain("cardnews");
  });
});

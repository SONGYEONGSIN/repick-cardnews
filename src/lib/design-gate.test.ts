import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { colors } from "@/lib/design-tokens";

/** 스튜디오 UI 경로만 검사한다 — src/templates 는 카드 산출물이라 규칙이 다르다. */
const ROOTS = ["src/app", "src/components", "src/features"];

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const root of ROOTS) {
    for (const name of readdirSync(root, { recursive: true })) {
      if (typeof name !== "string") continue;
      if (!name.endsWith(".tsx") && !name.endsWith(".ts")) continue;
      if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
      out.push(path.join(root, name));
    }
  }
  return out;
}

function violations(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of sourceFiles()) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file}:${i + 1} ${line.trim()}`);
    });
  }
  return hits;
}

/** TS 토큰 키를 Tailwind 유틸 이름으로 변환. hairSoft → hair-soft, ink2 → ink-2 */
function utilityName(key: string): string {
  return key.replace(/([A-Z])/g, "-$1").replace(/(\d)/g, "-$1").toLowerCase();
}

describe("디자인 게이트 — 스튜디오 UI", () => {
  it("이모지를 쓰지 않는다 (아이콘은 lucide-react)", () => {
    // U+1F300-U+1FAFF (이모지), U+2600-U+27BF (심볼/날씨),
    // U+2B00-U+2BFF (추가 화살표/기호 — ⭐ U+2B50),
    // U+1F1E6-U+1F1FF (지역 지표 — 국기)
    expect(
      violations(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/u)
    ).toEqual([]);
  });

  it("세리프·장식 폰트를 쓰지 않는다", () => {
    expect(violations(/font-serif|font-\[.*(serif|cursive)/)).toEqual([]);
  });

  it("허용 목록 밖 폰트를 지정하지 않는다", () => {
    // 스튜디오는 전역 --font-sans 하나만 쓴다. fontFamily 직접 지정은 카드 템플릿 몫이다.
    expect(violations(/fontFamily\s*:/)).toEqual([]);
  });

  it("텍스트 색에 투명도 수식을 붙이지 않는다", () => {
    // design-tokens.ts 의 모든 색상 토큰을 대상으로 동적 생성.
    // 새 토큰 추가 시 자동으로 커버된다.
    const colorTokens = Object.keys(colors).map(utilityName);
    expect(colorTokens.length).toBeGreaterThan(0);
    // 기본 토큰 이름 검증: 전환이 의도대로 작동하는지 확인
    expect(colorTokens).toContain("ink");
    expect(colorTokens).toContain("ink-2");
    expect(colorTokens).toContain("hair-soft");
    expect(colorTokens).toContain("plum-hover");

    const pattern = new RegExp(`text-(${colorTokens.join("|")})/\\d+`);
    expect(violations(pattern)).toEqual([]);
  });

  it("컴포넌트에 하드코딩 색상을 쓰지 않는다", () => {
    // 모든 색상 유틸 + 모든 variant prefix 를 한 번에 잡는다.
    // /-\[#[0-9a-fA-F]{3,8}\]/ 는 bg-[#...], text-[#...], md:bg-[#...] 등 모두 매칭.
    expect(violations(/-\[#[0-9a-fA-F]{3,8}\]/)).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

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

describe("디자인 게이트 — 스튜디오 UI", () => {
  it("이모지를 쓰지 않는다 (아이콘은 lucide-react)", () => {
    expect(violations(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)).toEqual([]);
  });

  it("세리프·장식 폰트를 쓰지 않는다", () => {
    expect(violations(/font-serif|font-\[.*(serif|cursive)/)).toEqual([]);
  });

  it("허용 목록 밖 폰트를 지정하지 않는다", () => {
    // 스튜디오는 전역 --font-sans 하나만 쓴다. fontFamily 직접 지정은 카드 템플릿 몫이다.
    expect(violations(/fontFamily\s*:/)).toEqual([]);
  });

  it("텍스트 색에 투명도 수식을 붙이지 않는다", () => {
    // text-ink-3/60 같은 표현은 계산된 대비를 무너뜨린다.
    expect(violations(/text-(ink|ink-2|ink-3|plum)\/\d+/)).toEqual([]);
  });

  it("컴포넌트에 하드코딩 색상을 쓰지 않는다", () => {
    // design-tokens.ts 와 globals.css 만 원시 색상을 갖는다.
    expect(violations(/(bg|text|border|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/)).toEqual([]);
  });
});

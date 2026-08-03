import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { colors, utilityName } from "@/lib/design-tokens";

/** 스튜디오 UI 경로만 검사한다 — src/templates 는 카드 산출물이라 규칙이 다르다. */
const ROOTS = ["src/app", "src/components", "src/features"];

/**
 * 이모지 규칙만 src/lib 도 함께 본다 — `api-errors.ts` 가 만드는 한국어 에러 문구처럼
 * 사용자 화면에 그대로 노출되는 카피가 거기 있다. 다른 규칙(하드코딩 색상 등)은 그대로
 * ROOTS 만 본다 — src/lib 에는 design-tokens.ts·contrast.ts 처럼 raw hex 가 정당하게 있다.
 */
const EMOJI_ROOTS = [...ROOTS, "src/lib"];

function sourceFiles(roots: string[]): string[] {
  const out: string[] = [];
  for (const root of roots) {
    for (const name of readdirSync(root, { recursive: true })) {
      if (typeof name !== "string") continue;
      if (!name.endsWith(".tsx") && !name.endsWith(".ts")) continue;
      if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
      out.push(path.join(root, name));
    }
  }
  return out;
}

function violations(pattern: RegExp, roots: string[] = ROOTS): string[] {
  const hits: string[] = [];
  for (const file of sourceFiles(roots)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file}:${i + 1} ${line.trim()}`);
    });
  }
  return hits;
}

describe("디자인 게이트 — 스튜디오 UI", () => {
  it("이모지를 쓰지 않는다 (아이콘은 lucide-react)", () => {
    // U+1F300-U+1FAFF (이모지), U+2600-U+27BF (심볼/날씨),
    // U+2B00-U+2BFF (추가 화살표/기호 — ⭐ U+2B50),
    // U+1F1E6-U+1F1FF (지역 지표 — 국기)
    expect(
      violations(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/u, EMOJI_ROOTS)
    ).toEqual([]);
  });

  it("세리프·장식 폰트를 쓰지 않는다", () => {
    expect(violations(/font-serif|font-\[.*(serif|cursive)/)).toEqual([]);
  });

  it("허용 목록 밖 폰트를 지정하지 않는다", () => {
    // 인라인 fontFamily 지정(객체 프로퍼티 `fontFamily:`)을 막아 Tailwind 유틸 밖에서
    // 폰트를 지정하는 경로를 차단한다. Tailwind 유틸인 font-sans(기본 본문)와
    // font-mono(ExportStep·FlowCard 의 파일 경로 같은 고정폭 표기)는 둘 다 허용 목록 안이다.
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

  /**
   * `ch` 는 라틴 문자 `0` 의 폭 기준이다. 이 프로젝트의 글은 전부 한글이고 한글 글자는 그
   * 두 배쯤 넓어서, `max-w-[62ch]` 는 의도한 읽기 폭의 절반(한글 30자 남짓)이 된다 — 문단이
   * 일찍 잘리고 오른쪽에 큰 여백이 남는다. 실제로 그렇게 보인다는 지적을 받아 되돌렸다.
   *
   * 읽기 폭은 `rem` 으로 잡는다(`max-w-[46rem]` ≈ 한글 55자). docs/ui-standards.md §2.
   */
  it("폭을 ch 단위로 잡지 않는다 — 한글에서는 의도의 절반이 된다", () => {
    expect(violations(/-\[\d+(\.\d+)?ch\]/)).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { STEPS } from "@/features/shell/StudioFrame";

/**
 * 허브(`/`)는 두 흐름을 **소개**하는 화면이라, 흐름이 바뀌면 조용히 거짓말을 하게 된다.
 * 실제로 그랬다(2026-08-04): 두 흐름 다 3화면이 됐는데 허브는 `5스텝`·`4스텝`이라고 적어
 * 두고 있었다 — 손으로 베낀 숫자였기 때문이다.
 *
 * 이 저장소는 그런 값을 테스트로 묶어 왔다(`MAX_STEPS`, `HEADING_MAX`, 테마 명암비).
 * 여기서는 **베끼는 것 자체를 막는다** — 숫자는 `STEPS` 에서만 온다.
 */

const HUB = readFileSync("src/app/page.tsx", "utf8");

describe("허브가 흐름을 정확히 말한다", () => {
  it("스텝 수를 손으로 적지 않는다 — STEPS 에서 가져온다", () => {
    const hardcoded = HUB.split("\n")
      .map((line, i) => ({ line: line.trim(), no: i + 1 }))
      .filter(({ line }) => /steps=\{\s*\d/.test(line))
      .map(({ line, no }) => `src/app/page.tsx:${no} ${line}`);
    expect(hardcoded).toEqual([]);
  });

  /**
   * 흐름 파일이 `StudioFrame` 에 넘기는 화면 번호는 `STEPS` 안에 있어야 한다. 화면을 하나
   * 더 만들면서 `STEPS` 를 안 고치면 진행 표시가 그 화면을 아예 못 그린다.
   */
  it("모든 화면 번호가 STEPS 범위 안이다", () => {
    const files = [
      "src/features/cardnews/screens/TopicScreen.tsx",
      "src/features/cardnews/screens/WorkbenchScreen.tsx",
      "src/features/cardnews/screens/ExportScreen.tsx",
      "src/features/infosend/screens/InfoTopicScreen.tsx",
      "src/features/infosend/screens/InfoWorkbenchScreen.tsx",
      "src/features/infosend/screens/InfoExportScreen.tsx",
    ];
    const used = files.flatMap((file) => {
      const found = readFileSync(file, "utf8").match(/step=\{(\d+)\}/g) ?? [];
      return found.map((m) => Number(m.replace(/\D/g, "")));
    });
    expect(used.length).toBe(files.length);
    expect(used.every((n) => n < STEPS.length)).toBe(true);
    // 세 화면이 각각 다른 번호를 쓴다 — 같은 번호를 두 화면이 쓰면 진행 표시가 안 움직인다.
    expect(new Set(used)).toEqual(new Set(STEPS.map((_, i) => i)));
  });

  it("정보전달 설명이 사진을 필수라고 말하지 않는다 — 사진은 선택이다", () => {
    const info = HUB.slice(HUB.indexOf('title="정보전달"'));
    const description = info.slice(0, info.indexOf("outputPath"));
    expect(description).not.toContain("사진 1장에");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { STEPS } from "@/features/shell/StudioFrame";

/**
 * 첫 화면(`/`)은 카드뉴스 주제 화면이다 — 허브를 없애면서 여기로 옮겨 왔다(2026-08-04).
 * 화면을 옮기거나 지울 때 한 곳만 고치고 나머지를 놓치기 쉬워, 그 어긋남을 여기서 잡는다.
 */
describe("화면 번호가 STEPS 와 맞는다", () => {
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
});

/**
 * 형태 소개 문구는 **두 주제 화면에 다 있다** — 한쪽만 고치면 화면마다 다른 말을 한다.
 * 실제로 그랬다(2026-08-04): `/cardnews` 쪽은 항목이 "3~4개"라고 적혀 있었는데 실제
 * 상한은 3~6개였고, 사진도 필수처럼 적혀 있었다.
 *
 * 숫자는 `ITEMS_MIN`·`ITEMS_MAX` 에서만 온다 — 여기서 베끼는 것 자체를 막는다.
 */
describe("형태 소개 문구가 정확하다", () => {
  const TOPIC_SCREENS = [
    "src/features/cardnews/screens/TopicScreen.tsx",
    "src/features/infosend/screens/InfoTopicScreen.tsx",
  ];

  it("항목 수를 손으로 적지 않는다", () => {
    const hardcoded = TOPIC_SCREENS.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ line: line.trim(), no: i + 1 }))
        .filter(({ line }) => /항목 \d/.test(line))
        .map(({ line, no }) => `${file}:${no} ${line}`),
    );
    expect(hardcoded).toEqual([]);
  });

  it("두 화면이 같은 항목 수를 말한다", () => {
    for (const file of TOPIC_SCREENS) {
      expect(readFileSync(file, "utf8")).toContain("{ITEMS_MIN}~{ITEMS_MAX}개");
    }
  });

  it("정보전달을 사진이 있어야 하는 것처럼 말하지 않는다", () => {
    const claims = TOPIC_SCREENS.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ line: line.trim(), no: i + 1 }))
        .filter(({ line }) => /사진 1장/.test(line))
        .map(({ line, no }) => `${file}:${no} ${line}`),
    );
    expect(claims).toEqual([]);
  });
});

/**
 * 앱 안의 링크가 **없는 라우트**를 가리키면 눌렀을 때 404 가 뜬다. 화면을 옮기거나 지울 때
 * 한 곳만 고치고 나머지를 놓치기 쉬워서, 라우트 목록을 실제 파일에서 읽어 대조한다.
 *
 * 동적 경로(`/s/[token]`)와 템플릿으로 만드는 주소는 리터럴이 아니라 여기서 보지 않는다.
 */
describe("앱 안 링크가 살아 있는 라우트만 가리킨다", () => {
  it("href 로 적힌 경로가 전부 존재한다", () => {
    const routes = new Set(
      readdirSync("src/app", { recursive: true })
        .filter((n): n is string => typeof n === "string" && n.endsWith("page.tsx"))
        // Windows 의 readdir 은 `settings\page.tsx` 처럼 역슬래시로 준다. 링크는 어느 OS 에서든
        // 정슬래시라, 여기서 맞춰 두지 않으면 살아 있는 라우트를 죽었다고 신고한다.
        .map((n) => n.split(path.sep).join("/"))
        .map((n) => "/" + n.replace(/\/?page\.tsx$/, ""))
        .map((r) => (r === "/" ? "/" : r.replace(/\/$/, ""))),
    );

    const dead: string[] = [];
    for (const file of readdirSync("src", { recursive: true })) {
      if (typeof file !== "string" || !file.endsWith(".tsx")) continue;
      const full = path.join("src", file);
      readFileSync(full, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const m = line.match(/href="(\/[^"]*)"/);
          // 동적 구간이 들어간 경로는 리터럴 대조 대상이 아니다.
          if (!m || m[1].includes("[")) return;
          if (!routes.has(m[1])) dead.push(`${full}:${i + 1} ${m[1]}`);
        });
    }
    expect(dead).toEqual([]);
  });
});

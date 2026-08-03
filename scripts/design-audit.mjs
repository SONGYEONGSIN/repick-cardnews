/**
 * 스튜디오 UI 브라우저 감사 — 접근성 점수와 폭별 가로 오버플로.
 *
 * dev 서버가 떠 있어야 한다: npm run dev
 * 실행: npm run design:audit
 *
 * 한계 2가지 (해결은 후속 작업, 지금은 사실만 명시한다):
 * 1. `document.documentElement.scrollWidth` 만 잰다. `StudioShell` 의 `<main>` 은
 *    `overflow-y-auto` 라 `overflow-x` 가 함께 `auto` 로 계산되고, 그 안에서 생기는
 *    가로 오버플로는 그 스크롤 컨테이너가 흡수해 document 레벨에서는 안 보인다.
 * 2. 각 라우트의 **초기 화면만** 로드한다. 위저드의 이후 스텝은 조작하지 않으므로
 *    측정 대상이 아니다.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const BASE = "http://localhost:3500";
const ROUTES = ["/", "/cardnews", "/info"];
const WIDTHS = [1280, 1366, 1440, 1600, 1920, 390, 768, 1024];
const A11Y_MIN = 95;

function lighthouseScore(url) {
  const out = path.join(mkdtempSync(path.join(tmpdir(), "lh-")), "r.json");
  const r = spawnSync("npx", ["lighthouse", url, "--only-categories=accessibility",
    "--output=json", `--output-path=${out}`, "--chrome-flags=--headless", "--quiet"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return { score: null, failures: ["lighthouse 실행 실패"] };
  const report = JSON.parse(readFileSync(out, "utf8"));
  const failures = Object.values(report.audits)
    .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode !== "notApplicable")
    .map((a) => a.id);
  return { score: Math.round(report.categories.accessibility.score * 100), failures };
}

const results = [];

for (const route of ROUTES) {
  const { score, failures } = lighthouseScore(BASE + route);
  const pass = score !== null && score >= A11Y_MIN;
  results.push({ gate: "a11y", route, pass, detail: `${score} (실패: ${failures.join(", ") || "없음"})` });
}

const browser = await chromium.launch();
for (const route of ROUTES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const response = await page.goto(BASE + route, { waitUntil: "networkidle" });
    if (!response || !response.ok()) {
      results.push({
        gate: "sweep", route, pass: false,
        detail: `${width}px → 라우트가 200 을 응답하지 않음 (status ${response?.status() ?? "없음"})`,
      });
      await page.close();
      continue;
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const slack = width - scrollWidth;
    const pass = slack >= 0;
    results.push({ gate: "sweep", route, pass, detail: `${width}px → scrollWidth ${scrollWidth} (여유 ${slack})` });
    await page.close();
  }
}
await browser.close();

for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.gate} ${r.route} — ${r.detail}`);
if (results.length === 0) {
  console.log("\n측정된 항목이 없음 — ROUTES 설정을 확인하세요");
  process.exit(1);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length === 0 ? 0 : 1);

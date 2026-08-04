/**
 * 스튜디오 UI 브라우저 감사 — 접근성 점수와 폭별 가로 오버플로.
 *
 * dev 서버가 떠 있어야 한다: npm run dev
 * 실행: npm run design:audit
 *
 * 한계 2가지 (해결은 후속 작업, 지금은 사실만 명시한다):
 * 1. `document.documentElement.scrollWidth` 만 잰다. `StudioFrame` 의 `<main>` 은
 *    `overflow-y-auto` 라 `overflow-x` 가 함께 `auto` 로 계산되고, 그 안에서 생기는
 *    가로 오버플로는 그 스크롤 컨테이너가 흡수해 document 레벨에서는 안 보인다.
 * 2. 폭 스위프는 각 라우트의 **초기 화면만** 로드한다. 사진과 카드가 있어야 열리는 화면
 *    (작업대·내보내기)은 아래 `정렬` 게이트가 따로 밟는다.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const BASE = "http://localhost:3500";
// 첫 화면이 카드뉴스 주제 화면이다(허브 제거, 2026-08-04) — 라우트는 둘뿐이다.
const ROUTES = ["/", "/info"];
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

/**
 * 정렬 게이트 — **나란히 놓인 것들이 같은 자리에서 시작하고 같은 높이인가.**
 *
 * 눈으로는 8px 을 못 본다. 실제로 오늘만 세 번 어긋났다: 빈 자리 박스 높이(289 vs 179),
 * 만들기 두 칸의 시작 위치(141 vs 133), 내보내기 두 박스 높이(156 vs 284). 전부 사람이
 * 화면을 보고 지적해서야 알았다 — 폭 스위프는 초기 화면만 훑어 여기까지 못 온다.
 *
 * 카피 생성은 **가짜 응답으로 가로챈다**. 진짜로 부르면 한 번에 100초 + 사용자 Claude
 * 할당량을 쓴다. 사진도 그때그때 만들어 쓰고 저장소에 남기지 않는다.
 */
const FAKE_SPEC = {
  type: "cardnews",
  keyword: "정렬 점검",
  cards: [
    { role: "hook", heading: "정렬 점검용 후크", badge: "" },
    { role: "problem", heading: "정렬 점검용 문제", body: "본문입니다." },
    { role: "evidence", heading: "정렬 점검용 근거", body: "본문입니다." },
    { role: "solution", heading: "정렬 점검용 해법", body: "본문입니다.", steps: ["하나", "둘", "셋"] },
    { role: "cta", heading: "정렬 점검용 마무리", action: "저장하기" },
  ],
};

const FAKE_INFO_SPEC = {
  type: "informationsend",
  title: "정렬 점검용 제목",
  subtitle: "정렬 점검용 부제",
  items: [
    { keyword: "하나", desc: "설명입니다." },
    { keyword: "둘", desc: "설명입니다." },
    { keyword: "셋", desc: "설명입니다." },
  ],
  tip: "정렬 점검용 팁 한 줄.",
};

function makePhotos(dir) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    let c, crc = 0xffffffff;
    for (let n = 0; n < body.length; n++) {
      c = (crc ^ body[n]) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc = (crc >>> 8) ^ c;
    }
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
    return Buffer.concat([len, body, crcBuf]);
  };
  const png = (w, h, rgb) => {
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) {
      raw[y * (w * 3 + 1)] = 0;
      for (let x = 0; x < w; x++) {
        const o = y * (w * 3 + 1) + 1 + x * 3;
        raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2];
      }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
    ]);
  };
  for (let i = 1; i <= 5; i++) writeFileSync(path.join(dir, `${i}.png`), png(800, 1000, [40 + i * 35, 90, 130]));
  return dir;
}

/** 같은 줄에 있어야 할 두 요소의 top·height 가 같은지. 픽셀 반올림 오차 1px 은 봐준다. */
function samePlace(a, b) {
  return Math.abs(a.top - b.top) <= 1 && Math.abs(a.height - b.height) <= 1;
}

const alignBrowser = await chromium.launch();
try {
  const page = await alignBrowser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.route("**/api/generate", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ spec: FAKE_SPEC }) }));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.fill("#kw", "정렬 점검");
  await page.getByRole("button", { name: /사진 올리러 가기/ }).click();

  // 사진이 없을 때 나란히 뜨는 두 자리 표시가 같은 자리·같은 높이여야 한다.
  const empties = await page.$$eval("[class*='border-dashed']", (els) =>
    els.map((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), height: Math.round(r.height) }; }));
  results.push({
    gate: "정렬", route: "/ 만들기(빈 상태)",
    pass: empties.length === 2 && samePlace(empties[0], empties[1]),
    detail: empties.map((e) => `top ${e.top}·${e.height}px`).join(" / ") || "자리 표시를 못 찾음",
  });

  const dir = makePhotos(mkdtempSync(path.join(tmpdir(), "align-")));
  await page.setInputFiles('input[type="file"]', dir);
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /카피 만들기/ }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /내보내기|다음/ }).first().click();
  await page.waitForTimeout(1200);

  // 내보내기의 '파일로 저장' 과 '저장될 파일' 은 나란한 테두리 박스다.
  const boxes = await page.$$eval("[class*='border-hair']", (els) =>
    els.filter((el) => el.getBoundingClientRect().height > 60)
      .map((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), height: Math.round(r.height), text: (el.textContent || "").slice(0, 12) }; }));
  const fileBoxes = boxes.filter((b) => b.text.includes("네트워크") || b.text.includes("cardnews/"));
  results.push({
    gate: "정렬", route: "/ 내보내기(파일로 저장)",
    pass: fileBoxes.length === 2 && samePlace(fileBoxes[0], fileBoxes[1]),
    detail: fileBoxes.map((b) => `top ${b.top}·${b.height}px`).join(" / ") || "두 박스를 못 찾음",
  });

  // ── 정보전달(/info) — 사진 없이 끝까지 간다. 사진이 선택이라 이 경로가 기본이다.
  await page.route("**/api/generate", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ spec: FAKE_INFO_SPEC }) }));
  await page.goto(`${BASE}/info`, { waitUntil: "networkidle" });
  await page.fill("#info-kw", "정렬 점검");
  await page.getByRole("button", { name: /만들러 가기/ }).click();
  await page.waitForTimeout(600);
  // 고르기 화면에서도 왼쪽(고르기)과 오른쪽(카드 자리)의 박스가 같은 자리·같은 높이여야 한다.
  const emptyPair = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll("div")].filter((e) => {
      const c = e.className;
      return typeof c === "string" && /border-hair/.test(c) && /rounded-xl/.test(c) && e.getBoundingClientRect().height > 100;
    });
    const r = (e) => { const x = e.getBoundingClientRect(); return { top: Math.round(x.top), height: Math.round(x.height) }; };
    const left = boxes.find((e) => e.getBoundingClientRect().left < 700);
    const right = boxes.find((e) => e.getBoundingClientRect().left > 700);
    return left && right ? [r(left), r(right)] : null;
  });
  results.push({
    gate: "정렬", route: "/info 만들기(고르기 · 카드 자리)",
    pass: emptyPair !== null && samePlace(emptyPair[0], emptyPair[1]),
    detail: emptyPair ? emptyPair.map((b) => `top ${b.top}·${b.height}px`).join(" / ") : "두 박스를 못 찾음",
  });

  // 사진을 쓸지 먼저 고른다 — 고르기 전에는 '카피 만들기' 가 없다.
  await page.getByRole("button", { name: /사진 없이 만들기/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /카피 만들기/ }).click();
  await page.waitForTimeout(1500);

  // 만들기: 왼쪽(사진) 과 오른쪽(카드) 의 제목줄이 같은 높이에서 시작해야 한다.
  const heads = await page.$$eval("h2", (els) =>
    els.filter((el) => ["사진", "카드"].includes((el.textContent || "").trim()))
      .map((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), height: Math.round(r.height) }; }));
  results.push({
    gate: "정렬", route: "/info 만들기(두 칸 시작 위치)",
    pass: heads.length === 2 && samePlace(heads[0], heads[1]),
    detail: heads.map((h) => `top ${h.top}·${h.height}px`).join(" / ") || "두 칸 제목을 못 찾음",
  });

  // 낮은 화면에서 잰다 — 배율을 박아 둔 결함은 자리가 좁아져야 드러난다(1600×1000 에서는
  // 고정 배율 카드도 들어가 버려 아무것도 못 잡는다).
  await page.setViewportSize({ width: 1440, height: 780 });
  await page.waitForTimeout(400);

  // 카드는 **음영 자리 안에** 들어가야 한다. 1080px 템플릿을 그대로 그리므로 배율을 박아 두면
  // 자리가 좁아져도 안 줄어 밖으로 튀어나온다 — 실제로 223px 넘쳤다(2026-08-04).
  const spill = await page.evaluate(() => {
    const canvas = [...document.querySelectorAll(".bg-canvas")].find((e) => e.getBoundingClientRect().height > 200);
    const card = canvas?.querySelector("[style*='width']");
    if (!canvas || !card) return null;
    const c = canvas.getBoundingClientRect();
    const k = card.getBoundingClientRect();
    return {
      아래: Math.round(k.bottom - c.bottom),
      오른쪽: Math.round(k.right - c.right),
      비율: k.height > 0 ? Number((k.width / k.height).toFixed(3)) : 0,
    };
  });
  results.push({
    gate: "정렬", route: "/info 만들기(카드가 자리 안에)",
    pass: spill !== null && spill.아래 <= 0 && spill.오른쪽 <= 0 && Math.abs(spill.비율 - 0.8) <= 0.01,
    detail: spill ? `아래 ${spill.아래}px · 오른쪽 ${spill.오른쪽}px · 비율 ${spill.비율}` : "카드를 못 찾음",
  });

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: /^내보내기$/ }).click();
  await page.waitForTimeout(1200);

  const infoBoxes = await page.$$eval("[class*='border-hair']", (els) =>
    els.filter((el) => el.getBoundingClientRect().height > 60)
      .map((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), height: Math.round(r.height), text: (el.textContent || "").slice(0, 20) }; }));
  const infoFileBoxes = infoBoxes.filter((b) => b.text.includes("네트워크") || b.text.includes("informationsend/"));

  // 높이만 재면 부족하다 — 오늘은 두 박스의 내용 높이가 우연히 같아, 늘어남을 꺼도 눈금이
  // 안 움직인다. 그래서 **늘어남 자체**(그리드의 align-items)를 함께 본다. `items-start` 를
  // 넣는 순간 "start" 가 되어 여기서 걸린다(docs/ui-standards.md §3).
  const stretches = await page.evaluate(() => {
    // 위 `infoFileBoxes` 와 같은 조건으로 고른다 — 그냥 includes 로 찾으면 사이드바처럼
    // 그 글을 품기만 한 바깥 요소가 먼저 잡힌다.
    const box = [...document.querySelectorAll("[class*='border-hair']")].find((el) =>
      (el.textContent || "").slice(0, 20).includes("네트워크"));
    const grid = box?.closest("div.grid");
    return grid ? getComputedStyle(grid).alignItems : "그리드를 못 찾음";
  });
  results.push({
    gate: "정렬", route: "/info 내보내기(파일로 저장)",
    pass: infoFileBoxes.length === 2 && samePlace(infoFileBoxes[0], infoFileBoxes[1]) && stretches === "normal",
    detail:
      (infoFileBoxes.map((b) => `top ${b.top}·${b.height}px`).join(" / ") || "두 박스를 못 찾음") +
      ` · 늘어남 ${stretches}`,
  });
} catch (e) {
  results.push({ gate: "정렬", route: "-", pass: false, detail: `측정 실패: ${e instanceof Error ? e.message.slice(0, 80) : "알 수 없음"}` });
} finally {
  await alignBrowser.close();
}

for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.gate} ${r.route} — ${r.detail}`);
if (results.length === 0) {
  console.log("\n측정된 항목이 없음 — ROUTES 설정을 확인하세요");
  process.exit(1);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length === 0 ? 0 : 1);

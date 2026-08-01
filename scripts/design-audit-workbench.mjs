/**
 * 만들기 화면(빈 상태 / 사진 있음) 브라우저 감사 — 폭 스위프 + 수동 접근성 점검.
 *
 * 만들기 화면은 위저드 조작(주제 입력 → 다음)을 거쳐야 도달한다. `design-audit.mjs` 는
 * 라우트 초기 렌더만 재므로 이 화면은 잡지 않는다 — 그래서 별도 스크립트로 뗐다.
 *
 * Lighthouse CLI 는 URL 을 새로 열 때마다 감사하므로 조작 후 상태에는 직접 물릴 수 없다
 * (user-flow API 로 가능하지만 이 저장소 도구 체인엔 없다). 대신 이름 없는 버튼·레이블
 * 없는 입력·중복 id·heading 순서를 Playwright 로 직접 조회해 같은 종류의 결함을 잡는다.
 *
 * 사진 투입은 `Dropzone` 의 숨은 파일 입력(`setInputFiles`)이 아니라 **드래그앤드롭을
 * 흉내 낸다.** 그 입력의 `onChange` 는 `e.target.files` 를 async 함수에 넘긴 **바로 다음
 * 줄에서 `e.target.value = ""` 로 같은 입력을 비우는데, 이 Chromium 빌드는 `files` 를
 * 매번 새 객체로 주지 않고 같은 FileList 를 제자리에서 비운다 — 그 결과 `ingest()` 가
 * `await` 뒤에 파일을 읽을 때는 이미 빈 목록이라 "이미지 파일이 없어요" 로 늘 실패한다.
 * `setInputFiles` 로 흉내 낸 결함이 아니라 실제 파일 선택 버튼을 눌러도 재현된다
 * (task-8-report.md 의 "발견한 결함" 참고 — `src/features/photos/**` 는 이 태스크의
 * 수정 범위 밖이라 고치지 않고 보고만 한다). 드롭 경로는 `Array.from(dataTransfer.files)`
 * 로 동기에 배열을 만들어 두므로 이 문제가 없다 — 임시 input 으로 실제 File 을 얻어
 * DataTransfer 에 담고 Dropzone 루트에 `drop` 이벤트로 흘려보낸다.
 *
 * dev 서버가 떠 있어야 한다: npm run dev
 * 실행: node scripts/design-audit-workbench.mjs
 * 스크린샷 위치는 AUDIT_SHOTS_DIR 로 지정할 수 있다. 없으면 OS 임시 폴더 아래 새로 만든다
 * (design-audit.mjs 의 mkdtempSync 관례를 그대로 따른다 — 세션 전용 경로를 하드코딩하지 않는다).
 */
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const BASE = "http://localhost:3500";
const WIDTHS = [390, 768, 1024, 1280, 1440, 1920];
const KEYWORD = "에어컨 전기세";
const SHOTS_DIR = process.env.AUDIT_SHOTS_DIR ?? mkdtempSync(path.join(tmpdir(), "workbench-audit-"));
const PHOTOS_DIR = path.join(process.cwd(), "knowledge/references/cardnews");
const PHOTO_PATHS = ["cardnew1.jpeg", "cardnew2.jpeg", "cardnew3.jpeg", "cardnew4.jpeg", "cardnew5.jpeg"].map((n) =>
  path.join(PHOTOS_DIR, n)
);

mkdirSync(SHOTS_DIR, { recursive: true });
console.log(`스크린샷 저장 위치: ${SHOTS_DIR}`);

/** 임시 input 으로 실제 File 을 얻어 Dropzone 루트에 합성 drop 이벤트로 흘려보낸다. */
async function dropPhotos(page) {
  await page.evaluate(() => {
    const tmp = document.createElement("input");
    tmp.type = "file";
    tmp.multiple = true;
    tmp.id = "__audit_tmp_upload__";
    tmp.style.position = "fixed";
    document.body.appendChild(tmp);
  });
  await page.setInputFiles("#__audit_tmp_upload__", PHOTO_PATHS);
  await page.evaluate(() => {
    const tmp = document.getElementById("__audit_tmp_upload__");
    const dt = new DataTransfer();
    for (const f of tmp.files) dt.items.add(f);
    tmp.remove();

    const dropzone = document.querySelector('input[aria-label="사진 폴더 선택"]').parentElement;
    const dropEvent = new DragEvent("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", { value: dt });
    dropzone.dispatchEvent(dropEvent);
  });
}

/** 이름 없는 버튼 / 레이블 없는 입력 / 중복 id / heading 순서 역전을 DOM 에서 직접 잰다. */
function a11yCheck() {
  const issues = [];

  for (const btn of document.querySelectorAll("button")) {
    const accessible = btn.getAttribute("aria-label") || btn.textContent?.trim();
    if (!accessible) issues.push(`이름 없는 버튼: ${btn.outerHTML.slice(0, 80)}`);
  }

  for (const input of document.querySelectorAll("input, textarea")) {
    const id = input.getAttribute("id");
    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = input.getAttribute("aria-label") || input.getAttribute("aria-labelledby");
    if (!hasLabel && !hasAriaLabel) issues.push(`레이블 없는 입력: ${input.outerHTML.slice(0, 80)}`);
  }

  const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.getAttribute("id"));
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of new Set(dupes)) issues.push(`중복 id: ${id}`);

  const levels = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) =>
    Number(h.tagName[1])
  );
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) issues.push(`heading 순서 역전: h${levels[i - 1]} 다음 h${levels[i]}`);
  }

  return issues;
}

const results = [];
const a11yResults = [];

const browser = await chromium.launch();

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });

  const response = await page.goto(BASE + "/cardnews", { waitUntil: "networkidle" });
  if (!response || !response.ok()) {
    results.push({ width, state: "empty", pass: false, detail: `/cardnews 가 200 을 응답하지 않음` });
    await page.close();
    continue;
  }

  await page.locator("#kw").fill(KEYWORD);
  await page.getByRole("button", { name: "사진 올리러 가기" }).click();
  await page.getByRole("heading", { name: "넘겨 보는 순서" }).waitFor();

  // -- 만들기 화면(빈 상태) --
  let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  let slack = width - scrollWidth;
  results.push({ width, state: "empty", pass: slack >= 0, detail: `scrollWidth ${scrollWidth} (여유 ${slack})` });
  await page.screenshot({ path: path.join(SHOTS_DIR, `workbench-empty-${width}.png`), fullPage: true });
  if (width === 1280) a11yResults.push({ state: "empty", issues: await page.evaluate(a11yCheck) });

  // -- 사진 5장 투입 --
  await dropPhotos(page);
  await page.getByText("5장 · 5~6장으로 만들어요").waitFor();

  scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  slack = width - scrollWidth;
  results.push({ width, state: "photos", pass: slack >= 0, detail: `scrollWidth ${scrollWidth} (여유 ${slack})` });
  await page.screenshot({ path: path.join(SHOTS_DIR, `workbench-photos-${width}.png`), fullPage: true });
  if (width === 1280) a11yResults.push({ state: "photos", issues: await page.evaluate(a11yCheck) });

  await page.close();
}

await browser.close();

for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"} sweep workbench-${r.state} ${r.width}px — ${r.detail}`);
}
for (const a of a11yResults) {
  console.log(
    `${a.issues.length === 0 ? "PASS" : "FAIL"} a11y-manual workbench-${a.state} — ${
      a.issues.length === 0 ? "위반 없음" : a.issues.join(" | ")
    }`
  );
}

const failed = results.filter((r) => !r.pass);
const a11yFailed = a11yResults.filter((a) => a.issues.length > 0);
console.log(`\n${results.length - failed.length}/${results.length} 스위프 통과, ${a11yResults.length - a11yFailed.length}/${a11yResults.length} 수동 접근성 통과`);
process.exit(failed.length === 0 && a11yFailed.length === 0 ? 0 : 1);

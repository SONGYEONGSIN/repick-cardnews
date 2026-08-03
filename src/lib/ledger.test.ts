import { describe, it, expect } from "vitest";
import { appendLedger } from "@/lib/ledger";
import { readFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readRecent } from "@/lib/ledger";

describe("appendLedger", () => {
  it("JSON 한 줄을 파일 끝에 추가한다", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "ledger-"));
    const tmp = path.join(dir, "ledger-test.jsonl");
    const entry = { ts: "2026-07-20T00:00:00Z", type: "cardnews", keyword: "테스트", count: 5, templateIds: ["hook"], model: "claude-opus-4-8", paths: ["cardnews/x/1.png"], perf: null };
    await appendLedger(entry, { file: tmp });
    await appendLedger(entry, { file: tmp });
    const lines = readFileSync(tmp, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).keyword).toBe("테스트");
  });
});

describe("readRecent", () => {
  async function fixture(lines: string[]): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "ledger-"));
    const file = path.join(dir, "ledger.jsonl");
    await writeFile(file, lines.join("\n") + "\n", "utf8");
    return file;
  }

  const entry = (keyword: string) =>
    JSON.stringify({
      ts: "2026-07-31T00:00:00.000Z",
      type: "cardnews",
      keyword,
      count: 5,
      templateIds: [],
      model: "claude-opus-4-8",
      paths: [],
      perf: null,
    });

  it("최신순으로 돌려준다", async () => {
    const file = await fixture([entry("첫째"), entry("둘째"), entry("셋째")]);
    const rows = await readRecent(2, { file });
    expect(rows.map((r) => r.keyword)).toEqual(["셋째", "둘째"]);
  });

  it("파일이 없으면 빈 배열이다", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "ledger-"));
    expect(await readRecent(5, { file: path.join(dir, "없는파일.jsonl") })).toEqual([]);
  });

  it("빈 줄을 건너뛴다", async () => {
    const file = await fixture([entry("하나"), "", entry("둘")]);
    expect(await readRecent(5, { file })).toHaveLength(2);
  });

  it("0건을 요청하면 빈 배열이다", async () => {
    const file = await fixture([entry("하나"), entry("둘")]);
    expect(await readRecent(0, { file })).toEqual([]);
  });

  it("ENOENT 가 아닌 에러는 삼키지 않고 다시 던진다", async () => {
    // 파일 자리에 디렉터리를 두면 readFile 이 EISDIR 로 실패한다 — 빈 상태가 아니라 진짜 고장이다.
    const dir = await mkdtemp(path.join(tmpdir(), "ledger-"));
    await expect(readRecent(5, { file: dir })).rejects.toThrow();
  });
});

import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

export type LedgerEntry = {
  ts: string;
  type: string;
  keyword: string;
  count: number;
  templateIds: string[];
  model: string;
  paths: string[];
  perf: null;
};

const DEFAULT_FILE = path.join(process.cwd(), "knowledge", "ledger.jsonl");

export async function appendLedger(entry: LedgerEntry, opts?: { file?: string }): Promise<void> {
  await appendFile(opts?.file ?? DEFAULT_FILE, JSON.stringify(entry) + "\n", "utf8");
}

/** 원장이 아직 없는 첫 실행은 실패가 아니라 빈 상태다. */
export async function readRecent(limit: number, opts?: { file?: string }): Promise<LedgerEntry[]> {
  // slice(-0) 은 slice(0) 과 같아 전체를 돌려준다 — 0건 요청을 전체 반환으로 뒤집지 않도록 먼저 막는다.
  if (limit <= 0) return [];
  let raw: string;
  try {
    raw = await readFile(opts?.file ?? DEFAULT_FILE, "utf8");
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return [];
    throw e;
  }
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as LedgerEntry)
    .slice(-limit)
    .reverse();
}

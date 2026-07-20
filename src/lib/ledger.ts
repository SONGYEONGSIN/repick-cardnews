import { appendFile } from "node:fs/promises";
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

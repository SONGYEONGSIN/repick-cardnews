import { describe, it, expect, afterEach } from "vitest";
import { appendLedger } from "@/lib/ledger";
import { readFileSync, rmSync, existsSync } from "node:fs";

const tmp = "/private/tmp/claude-501/-Users-yss----build-repick-cardnews/27ee7a84-c75c-4dea-9b6f-84c7d386e339/scratchpad/ledger-test.jsonl";

afterEach(() => { if (existsSync(tmp)) rmSync(tmp); });

describe("appendLedger", () => {
  it("JSON 한 줄을 파일 끝에 추가한다", async () => {
    const entry = { ts: "2026-07-20T00:00:00Z", type: "cardnews", keyword: "테스트", count: 5, templateIds: ["hook"], model: "claude-opus-4-8", paths: ["cardnews/x/1.png"], perf: null };
    await appendLedger(entry, { file: tmp });
    await appendLedger(entry, { file: tmp });
    const lines = readFileSync(tmp, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).keyword).toBe("테스트");
  });
});

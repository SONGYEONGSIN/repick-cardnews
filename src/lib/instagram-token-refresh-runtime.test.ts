import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  performRefresh,
  refreshInstagramTokenNow,
  autoRefreshInstagramTokenOnBoot,
} from "@/lib/instagram-token-refresh-runtime";

/**
 * 이 스위트는 절대 실제 `.env.local`이나 실제 인스타그램 API를 건드리지 않는다 — 매 테스트가
 * 임시 디렉터리에 자기 전용 파일을 만들고(`makeTempEnvFile`), `fetch`는 항상 목(mock)으로
 * 주입한다(`options.fetchImpl`). `performRefresh`·`refreshInstagramTokenNow`·
 * `autoRefreshInstagramTokenOnBoot` 모두 `env` 객체(순수 객체 — `process.env`가 아니다)를
 * 첫 인자로 받으므로 실제 프로세스 환경도 건드리지 않는다.
 */

let tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
  tmpDirs = [];
  vi.restoreAllMocks();
});

function makeTempEnvFile(content: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "ig-refresh-test-"));
  tmpDirs.push(dir);
  const file = path.join(dir, ".env.local");
  writeFileSync(file, content, "utf8");
  return file;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("performRefresh", () => {
  it("토큰이 없으면 fetch를 부르지 않고 config-missing을 돌려준다", async () => {
    const fetchImpl = vi.fn();
    const result = await performRefresh(new Date(), {}, { fetchImpl });

    expect(result).toEqual({ ok: false, reason: "config-missing" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("네트워크 실패면 network를 돌려주고 파일을 건드리지 않는다", async () => {
    const envPath = makeTempEnvFile("INSTAGRAM_ACCESS_TOKEN=old-token\n");
    const before = readFileSync(envPath, "utf8");
    const fetchImpl = vi.fn().mockRejectedValue(new Error("net down"));

    const result = await performRefresh(new Date(), { INSTAGRAM_ACCESS_TOKEN: "old-token" }, { fetchImpl, envPath });

    expect(result).toEqual({ ok: false, reason: "network" });
    expect(readFileSync(envPath, "utf8")).toBe(before);
  });

  it("24시간 미만이라 거절되면 too-soon을 돌려주고 파일을 건드리지 않는다", async () => {
    const envPath = makeTempEnvFile("INSTAGRAM_ACCESS_TOKEN=old-token\n");
    const before = readFileSync(envPath, "utf8");
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(400, { error: { message: "You must wait 24 hours between refreshes.", code: 4 } }),
      );

    const result = await performRefresh(new Date(), { INSTAGRAM_ACCESS_TOKEN: "old-token" }, { fetchImpl, envPath });

    expect(result).toEqual({ ok: false, reason: "too-soon" });
    expect(readFileSync(envPath, "utf8")).toBe(before);
  });

  it("만료·무효 토큰이면 invalid-or-expired를 돌려주고 파일을 건드리지 않는다", async () => {
    const envPath = makeTempEnvFile("INSTAGRAM_ACCESS_TOKEN=old-token\n");
    const before = readFileSync(envPath, "utf8");
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { error: { message: "Session has expired", error_subcode: 463 } }));

    const result = await performRefresh(new Date(), { INSTAGRAM_ACCESS_TOKEN: "old-token" }, { fetchImpl, envPath });

    expect(result).toEqual({ ok: false, reason: "invalid-or-expired" });
    expect(readFileSync(envPath, "utf8")).toBe(before);
  });

  it("토큰 줄이 없는 파일이면 API가 성공해도 token-line-missing을 돌려주고 파일을 건드리지 않는다", async () => {
    const envPath = makeTempEnvFile("FOO=bar\n");
    const before = readFileSync(envPath, "utf8");
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "new-token", expires_in: 5183944 }));

    const result = await performRefresh(new Date(), { INSTAGRAM_ACCESS_TOKEN: "old-token" }, { fetchImpl, envPath });

    expect(result).toEqual({ ok: false, reason: "token-line-missing" });
    expect(readFileSync(envPath, "utf8")).toBe(before);
  });

  it("파일 자체가 없으면 API가 성공해도 config-missing을 돌려준다", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ig-refresh-test-"));
    tmpDirs.push(dir);
    const envPath = path.join(dir, "does-not-exist.env");
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "new-token", expires_in: 5183944 }));

    const result = await performRefresh(new Date(), { INSTAGRAM_ACCESS_TOKEN: "old-token" }, { fetchImpl, envPath });

    expect(result).toEqual({ ok: false, reason: "config-missing" });
  });

  it("성공하면 파일의 토큰·만료일 줄만 바꾸고, env 객체도 같이 갱신한다", async () => {
    const envPath = makeTempEnvFile(
      ["# 주석", "PUBLIC_BASE_URL=https://example.com", "INSTAGRAM_ACCESS_TOKEN=old-token", ""].join("\n"),
    );
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "new-token", expires_in: 5183944 }));
    const now = new Date("2026-08-02T00:00:00.000Z");
    const env: Record<string, string | undefined> = { INSTAGRAM_ACCESS_TOKEN: "old-token" };

    const result = await performRefresh(now, env, { fetchImpl, envPath });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expiresAt.toISOString()).toBe(new Date(now.getTime() + 5183944 * 1000).toISOString());

    const written = readFileSync(envPath, "utf8");
    expect(written).toContain("# 주석");
    expect(written).toContain("PUBLIC_BASE_URL=https://example.com");
    expect(written).toContain("INSTAGRAM_ACCESS_TOKEN=new-token");
    expect(written).not.toContain("old-token");
    expect(written).toContain(`INSTAGRAM_TOKEN_EXPIRES_AT=${result.expiresAt.toISOString()}`);

    expect(env.INSTAGRAM_ACCESS_TOKEN).toBe("new-token");
    expect(env.INSTAGRAM_TOKEN_EXPIRES_AT).toBe(result.expiresAt.toISOString());
  });
});

describe("refreshInstagramTokenNow", () => {
  it("남은 기간과 무관하게 항상 시도한다(성공 경로 위임 확인)", async () => {
    const envPath = makeTempEnvFile("INSTAGRAM_ACCESS_TOKEN=old-token\n");
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "new-token", expires_in: 100 }));

    const result = await refreshInstagramTokenNow(
      { INSTAGRAM_ACCESS_TOKEN: "old-token", INSTAGRAM_TOKEN_EXPIRES_AT: new Date(Date.now() + 1000 * 24 * 60 * 60 * 1000).toISOString() },
      new Date(),
      { fetchImpl, envPath },
    );

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("autoRefreshInstagramTokenOnBoot", () => {
  it("만료일 기록이 없으면 시도한다(fetch가 불린다)", async () => {
    const envPath = makeTempEnvFile("INSTAGRAM_ACCESS_TOKEN=old-token\n");
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "new-token", expires_in: 100 }));

    await autoRefreshInstagramTokenOnBoot({ INSTAGRAM_ACCESS_TOKEN: "old-token" }, new Date(), { fetchImpl, envPath });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("남은 기간이 충분하면 시도하지 않는다(fetch가 안 불린다)", async () => {
    const envPath = makeTempEnvFile("INSTAGRAM_ACCESS_TOKEN=old-token\n");
    const fetchImpl = vi.fn();
    const now = new Date("2026-08-02T00:00:00.000Z");
    const farFuture = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();

    await autoRefreshInstagramTokenOnBoot(
      { INSTAGRAM_ACCESS_TOKEN: "old-token", INSTAGRAM_TOKEN_EXPIRES_AT: farFuture },
      now,
      { fetchImpl, envPath },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("이미 만료됐으면 시도하지 않는다(fetch가 안 불린다)", async () => {
    const envPath = makeTempEnvFile("INSTAGRAM_ACCESS_TOKEN=old-token\n");
    const fetchImpl = vi.fn();
    const now = new Date("2026-08-02T00:00:00.000Z");
    const past = new Date(now.getTime() - 1000).toISOString();

    await autoRefreshInstagramTokenOnBoot(
      { INSTAGRAM_ACCESS_TOKEN: "old-token", INSTAGRAM_TOKEN_EXPIRES_AT: past },
      now,
      { fetchImpl, envPath },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("만료 임박이면 시도하고, 성공 시 토큰 값 없이 만료일만 로그로 남긴다", async () => {
    const envPath = makeTempEnvFile("INSTAGRAM_ACCESS_TOKEN=old-token\n");
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: "brand-new-secret-token", expires_in: 5183944 }));
    const now = new Date("2026-08-02T00:00:00.000Z");
    const soon = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await autoRefreshInstagramTokenOnBoot(
      { INSTAGRAM_ACCESS_TOKEN: "old-token", INSTAGRAM_TOKEN_EXPIRES_AT: soon },
      now,
      { fetchImpl, envPath },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const loggedText = infoSpy.mock.calls[0].join(" ");
    expect(loggedText).not.toContain("brand-new-secret-token");
    expect(loggedText).not.toContain("old-token");
  });

  it("실패해도 예외를 던지지 않는다(서버 기동을 막지 않음)", async () => {
    const envPath = makeTempEnvFile("INSTAGRAM_ACCESS_TOKEN=old-token\n");
    const fetchImpl = vi.fn().mockRejectedValue(new Error("net down"));

    await expect(
      autoRefreshInstagramTokenOnBoot({ INSTAGRAM_ACCESS_TOKEN: "old-token" }, new Date(), { fetchImpl, envPath }),
    ).resolves.toBeUndefined();
  });

  it("토큰 자체가 없어도 예외를 던지지 않는다", async () => {
    const fetchImpl = vi.fn();
    await expect(autoRefreshInstagramTokenOnBoot({}, new Date(), { fetchImpl })).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

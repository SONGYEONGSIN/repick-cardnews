import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readPublicBaseUrl, runScheduledItem } from "./schedule-runner";
import { saveImages, type ScheduleItem } from "./schedule-queue";
import { readPublishProgress, type PublishProgress } from "./publish-progress-store";

let root: string;
let envPath: string;
const OLD_ENV = { ...process.env };

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "repick-run-"));
  envPath = path.join(root, ".env.local");
  process.env.PUBLIC_BASE_URL = "https://from-process-env.example";
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "acc-1";
  process.env.INSTAGRAM_ACCESS_TOKEN = "super-secret-token";
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  process.env = { ...OLD_ENV };
  vi.restoreAllMocks();
});

function item(over: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "a1",
    scheduledAt: 1_800_000_000_000,
    caption: "캡션 #살림",
    imageCount: 2,
    keyword: "수원 갈비",
    status: "pending",
    createdAt: 1_700_000_000_000,
    ...over,
  };
}

function okFetch() {
  return vi.fn(async () => ({ ok: true, status: 200 }) as unknown as Response);
}

describe("readPublicBaseUrl — .env.local 에서 다시 읽는다", () => {
  it("파일의 값을 읽는다", () => {
    writeFileSync(envPath, 'PUBLIC_BASE_URL=https://tunnel.example\n', "utf8");

    expect(readPublicBaseUrl(envPath)).toBe("https://tunnel.example");
  });

  it("따옴표와 공백을 벗긴다", () => {
    writeFileSync(envPath, 'PUBLIC_BASE_URL = "https://tunnel.example"  \n', "utf8");

    expect(readPublicBaseUrl(envPath)).toBe("https://tunnel.example");
  });

  it("주석 줄은 무시한다", () => {
    writeFileSync(envPath, '# PUBLIC_BASE_URL=https://주석.example\nPUBLIC_BASE_URL=https://진짜.example\n', "utf8");

    expect(readPublicBaseUrl(envPath)).toBe("https://진짜.example");
  });

  it("파일이 없으면 null 이다 — process.env 로 떨어진다", () => {
    expect(readPublicBaseUrl(path.join(root, "없음"))).toBeNull();
  });
});

describe("runScheduledItem", () => {
  it("이미지가 없으면 게시하지 않고 한국어로 실패한다", async () => {
    saveImages("a1", [], root);
    const publish = vi.fn();

    const res = await runScheduledItem(item(), { now: 1, root, envPath, fetchImpl: okFetch(), publish });

    expect(res.ok).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    expect(res.ok === false && /[가-힣]/.test(res.message)).toBe(true);
  });

  // 정보전달은 **한 장**이다. 손으로 올릴 땐 되는데 예약하면 실패하는 일이 없도록,
  // 예약 실행기도 `/api/publish` 와 같은 갈림(`publishKindFor`)을 탄다.
  it("한 장이면 단일 게시 경로로 부른다 — 캐러셀로 보내지 않는다", async () => {
    saveImages("a1", [Buffer.from("one")], root);
    const publish = vi.fn();
    const publishSingle = vi.fn(async (args: { imageUrl: string }) => {
      expect(args.imageUrl).toContain("/1.png");
      return "media-single";
    });

    const res = await runScheduledItem(item({ imageCount: 1 }), {
      now: 1,
      root,
      envPath,
      fetchImpl: okFetch(),
      publish,
      publishSingle,
    });

    expect(res).toEqual({ ok: true, mediaId: "media-single" });
    expect(publish).not.toHaveBeenCalled();
    expect(publishSingle).toHaveBeenCalledOnce();
  });

  it("상한을 넘으면 게시하지 않는다", async () => {
    saveImages("a1", Array.from({ length: 11 }, (_, i) => Buffer.from(String(i))), root);
    const publish = vi.fn();
    const publishSingle = vi.fn();

    const res = await runScheduledItem(item({ imageCount: 11 }), {
      now: 1,
      root,
      envPath,
      fetchImpl: okFetch(),
      publish,
      publishSingle,
    });

    expect(res.ok).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    expect(publishSingle).not.toHaveBeenCalled();
  });

  it("설정이 없으면 무엇이 없는지 한국어로 말한다", async () => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const publish = vi.fn();

    const res = await runScheduledItem(item(), { now: 1, root, envPath, fetchImpl: okFetch(), publish });

    expect(res.ok).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    expect(res.ok === false && /[가-힣]/.test(res.message)).toBe(true);
  });

  it("터널에 닿지 않으면 게시하지 않는다 — 인스타에 깨진 요청을 보내지 않는다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const publish = vi.fn();
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 502 }) as unknown as Response);

    const res = await runScheduledItem(item(), { now: 1, root, envPath, fetchImpl, publish });

    expect(res.ok).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    expect(res.ok === false && res.message).toContain("주소");
  });

  it("정상 경로에서 publishCarousel 을 부르고 mediaId 를 돌려준다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const publish = vi.fn(async () => "media-1");

    const res = await runScheduledItem(item(), { now: 1, root, envPath, fetchImpl: okFetch(), publish });

    expect(res).toEqual({ ok: true, mediaId: "media-1" });
    expect(publish).toHaveBeenCalledOnce();
  });

  it("예약할 때 만든 캡션을 그대로 올린다 — 게시 시점에 다시 조합하지 않는다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    let seenCaption = "";
    const publish = vi.fn(async (args: { caption: string }) => {
      seenCaption = args.caption;
      return "media-1";
    });

    await runScheduledItem(item(), { now: 1, root, envPath, fetchImpl: okFetch(), publish });

    expect(seenCaption).toBe("캡션 #살림");
  });

  it(".env.local 의 PUBLIC_BASE_URL 이 process.env 보다 우선한다 — 터널을 새로 켜면 주소가 바뀐다", async () => {
    writeFileSync(envPath, "PUBLIC_BASE_URL=https://새터널.example\n", "utf8");
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    let seenUrls: string[] = [];
    const publish = vi.fn(async (args: { imageUrls: string[] }) => {
      seenUrls = args.imageUrls;
      return "media-1";
    });

    await runScheduledItem(item(), { now: 1, root, envPath, fetchImpl: okFetch(), publish });

    expect(seenUrls[0]).toContain("https://새터널.example");
    expect(seenUrls[0]).not.toContain("from-process-env");
  });

  it("게시가 실패하면 한국어 사유를 돌려주고 토큰을 노출하지 않는다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const publish = vi.fn(async () => {
      throw new Error("Invalid OAuth access token: super-secret-token");
    });

    const res = await runScheduledItem(item(), { now: 1, root, envPath, fetchImpl: okFetch(), publish });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).not.toContain("super-secret-token");
    expect(res.message).not.toContain("OAuth");
    expect(/[가-힣]/.test(res.message)).toBe(true);
  });

  it("터널 확인 중 네트워크가 끊겨도 던지지 않고 한국어로 실패한다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const publish = vi.fn();
    const fetchImpl = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });

    const res = await runScheduledItem(item(), { now: 1, root, envPath, fetchImpl, publish });

    expect(res.ok).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    expect(res.ok === false && res.message).not.toContain("fetch");
  });
});

/**
 * 예약이 도는 동안 화면은 '대기 중' 만 보여 줬다 — 손으로 올릴 때는 단계가 보이는데.
 * 실행기가 진행을 **항목 id 로** 기록해 두면 목록이 그걸 읽어 보여 준다.
 */
describe("runScheduledItem 진행 기록", () => {
  it("게시가 도는 동안 항목 id 로 진행을 남긴다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const seen: (PublishProgress | null)[] = [];
    const publish = vi.fn(
      async (
        _args: unknown,
        _sleep?: (ms: number) => Promise<void>,
        onProgress?: (p: { stage: "preparing"; index: number; total: number } | { stage: "publishing" }) => void,
      ) => {
        onProgress?.({ stage: "preparing", index: 1, total: 2 });
        seen.push(readPublishProgress("a1", 1));
        onProgress?.({ stage: "publishing" });
        seen.push(readPublishProgress("a1", 1));
        return "media-1";
      },
    );

    const res = await runScheduledItem(item(), { now: 1, root, envPath, fetchImpl: okFetch(), publish });

    expect(res).toEqual({ ok: true, mediaId: "media-1" });
    expect(seen).toEqual([{ stage: "preparing", index: 1, total: 2 }, { stage: "publishing" }]);
  });

  it("끝나면 기록을 지운다 — 남겨 두면 끝난 예약이 도는 것처럼 보인다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const publish = vi.fn(async () => "media-1");

    await runScheduledItem(item(), { now: 1, root, envPath, fetchImpl: okFetch(), publish });

    expect(readPublishProgress("a1", 1)).toBeNull();
  });

  it("실패해도 기록을 지운다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const publish = vi.fn(async () => {
      throw new Error("boom");
    });

    const res = await runScheduledItem(item(), { now: 1, root, envPath, fetchImpl: okFetch(), publish });

    expect(res.ok).toBe(false);
    expect(readPublishProgress("a1", 1)).toBeNull();
  });
});

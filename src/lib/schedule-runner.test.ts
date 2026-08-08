import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runScheduledItem } from "./schedule-runner";
import { saveImages, type ScheduleItem } from "./schedule-queue";
import { readPublishProgress, type PublishProgress } from "./publish-progress-store";

// Blob 은 네트워크다. 이 저장소의 테스트는 `environment: "node"` 에서 돌고 바깥을 타면
// 안 되므로, 실행기가 **주소를 어떻게 쓰는지**만 보도록 흉내만 낸다. share-blob 자신의
// 판단(경로·정렬·만료)은 `share-blob.test.ts` 가 따로 덮는다.
vi.mock("./share-blob", () => ({
  saveShare: vi.fn(async (token: string, images: Buffer[]) =>
    images.map((_, i) => `https://blob.example/share/${token}/${i + 1}.png`),
  ),
}));

let root: string;
const OLD_ENV = { ...process.env };

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "repick-run-"));
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

describe("runScheduledItem", () => {
  it("이미지가 없으면 게시하지 않고 한국어로 실패한다", async () => {
    saveImages("a1", [], root);
    const publish = vi.fn();

    const res = await runScheduledItem(item(), { now: 1, root, publish });

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

    const res = await runScheduledItem(item(), { now: 1, root, publish });

    expect(res.ok).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    expect(res.ok === false && /[가-힣]/.test(res.message)).toBe(true);
  });

  it("정상 경로에서 publishCarousel 을 부르고 mediaId 를 돌려준다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const publish = vi.fn(async () => "media-1");

    const res = await runScheduledItem(item(), { now: 1, root, publish });

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

    await runScheduledItem(item(), { now: 1, root, publish });

    expect(seenCaption).toBe("캡션 #살림");
  });

  it("게시가 실패하면 한국어 사유를 돌려주고 토큰을 노출하지 않는다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const publish = vi.fn(async () => {
      throw new Error("Invalid OAuth access token: super-secret-token");
    });

    const res = await runScheduledItem(item(), { now: 1, root, publish });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).not.toContain("super-secret-token");
    expect(res.message).not.toContain("OAuth");
    expect(/[가-힣]/.test(res.message)).toBe(true);
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

    const res = await runScheduledItem(item(), { now: 1, root, publish });

    expect(res).toEqual({ ok: true, mediaId: "media-1" });
    expect(seen).toEqual([{ stage: "preparing", index: 1, total: 2 }, { stage: "publishing" }]);
  });

  it("끝나면 기록을 지운다 — 남겨 두면 끝난 예약이 도는 것처럼 보인다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const publish = vi.fn(async () => "media-1");

    await runScheduledItem(item(), { now: 1, root, publish });

    expect(readPublishProgress("a1", 1)).toBeNull();
  });

  it("실패해도 기록을 지운다", async () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);
    const publish = vi.fn(async () => {
      throw new Error("boom");
    });

    const res = await runScheduledItem(item(), { now: 1, root, publish });

    expect(res.ok).toBe(false);
    expect(readPublishProgress("a1", 1)).toBeNull();
  });
});

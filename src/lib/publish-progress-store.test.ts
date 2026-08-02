import { describe, it, expect } from "vitest";
import {
  recordPublishProgress,
  readPublishProgress,
  clearPublishProgress,
  PUBLISH_PROGRESS_TTL_MS,
} from "@/lib/publish-progress-store";

describe("publish-progress-store", () => {
  it("기록한 진행 상황을 그대로 읽어온다", () => {
    const token = "tok-record-read";
    recordPublishProgress(token, { stage: "preparing", index: 2, total: 5 }, 1_000);

    expect(readPublishProgress(token, 1_100)).toEqual({ stage: "preparing", index: 2, total: 5 });
  });

  it("기록이 없는 토큰은 null이다", () => {
    expect(readPublishProgress("tok-never-recorded", 1_000)).toBeNull();
  });

  it("묶는 중·올리는 중·끝남(성공/실패) 단계도 구분해서 기록한다", () => {
    const token = "tok-stages";

    recordPublishProgress(token, { stage: "bundling" }, 1_000);
    expect(readPublishProgress(token, 1_010)).toEqual({ stage: "bundling" });

    recordPublishProgress(token, { stage: "publishing" }, 1_020);
    expect(readPublishProgress(token, 1_030)).toEqual({ stage: "publishing" });

    recordPublishProgress(token, { stage: "done", result: "success" }, 1_040);
    expect(readPublishProgress(token, 1_050)).toEqual({ stage: "done", result: "success" });

    recordPublishProgress(token, { stage: "done", result: "failure" }, 1_060);
    expect(readPublishProgress(token, 1_070)).toEqual({ stage: "done", result: "failure" });
  });

  it("다시 기록하면 이전 값을 덮어쓴다", () => {
    const token = "tok-overwrite";
    recordPublishProgress(token, { stage: "preparing", index: 1, total: 3 }, 1_000);
    recordPublishProgress(token, { stage: "preparing", index: 2, total: 3 }, 1_010);

    expect(readPublishProgress(token, 1_020)).toEqual({ stage: "preparing", index: 2, total: 3 });
  });

  it("TTL이 지나면 만료로 보고 null을 돌려준다(경계값 포함)", () => {
    const token = "tok-expire";
    recordPublishProgress(token, { stage: "publishing" }, 1_000);

    expect(readPublishProgress(token, 1_000 + PUBLISH_PROGRESS_TTL_MS - 1)).not.toBeNull();
    expect(readPublishProgress(token, 1_000 + PUBLISH_PROGRESS_TTL_MS)).toBeNull();
  });

  it("만료된 항목을 정리해도 다른 토큰의 진행 상황은 건드리지 않는다", () => {
    const staleToken = "tok-stale";
    const freshToken = "tok-fresh";
    recordPublishProgress(staleToken, { stage: "publishing" }, 1_000);
    recordPublishProgress(freshToken, { stage: "bundling" }, 5_000);

    // staleToken 조회가 만료 정리를 트리거해도 freshToken은 그대로 남아 있어야 한다.
    expect(readPublishProgress(staleToken, 1_000 + PUBLISH_PROGRESS_TTL_MS)).toBeNull();
    expect(readPublishProgress(freshToken, 1_000 + PUBLISH_PROGRESS_TTL_MS)).toEqual({ stage: "bundling" });
  });

  it("clearPublishProgress로 지우면 이후 조회는 null이다", () => {
    const token = "tok-clear";
    recordPublishProgress(token, { stage: "publishing" }, 1_000);
    clearPublishProgress(token);

    expect(readPublishProgress(token, 1_010)).toBeNull();
  });

  it("존재하지 않는 토큰을 지워도 오류가 나지 않는다", () => {
    expect(() => clearPublishProgress("tok-does-not-exist")).not.toThrow();
  });
});

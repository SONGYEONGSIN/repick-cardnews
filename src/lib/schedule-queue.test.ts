import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appendFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  appendItem,
  loadImages,
  readQueue,
  removeImages,
  saveImages,
  updateStatus,
  type ScheduleItem,
} from "./schedule-queue";

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "repick-sched-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function item(over: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "a1",
    scheduledAt: 1_800_000_000_000,
    caption: "캡션",
    imageCount: 5,
    keyword: "수원 갈비",
    status: "pending",
    createdAt: 1_700_000_000_000,
    ...over,
  };
}

describe("큐 파일", () => {
  it("아직 파일이 없으면 빈 목록이다 — 처음 쓰는 사람에게 오류를 던지지 않는다", () => {
    expect(readQueue(root)).toEqual([]);
  });

  it("넣은 항목을 그대로 읽는다", () => {
    appendItem(item(), root);

    expect(readQueue(root)).toEqual([item()]);
  });

  it("같은 id 가 여러 줄이면 마지막 줄이 이긴다 — append-only 로 상태를 바꾼다", () => {
    appendItem(item(), root);
    updateStatus("a1", "published", undefined, root);

    const queue = readQueue(root);
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe("published");
  });

  it("여러 항목의 순서를 넣은 순서대로 지킨다", () => {
    appendItem(item(), root);
    appendItem(item({ id: "b2" }), root);
    updateStatus("a1", "canceled", undefined, root);

    expect(readQueue(root).map((i) => i.id)).toEqual(["a1", "b2"]);
  });

  it("실패 사유를 함께 남긴다", () => {
    appendItem(item(), root);
    updateStatus("a1", "failed", "터널에 닿지 못했어요.", root);

    expect(readQueue(root)[0].message).toBe("터널에 닿지 못했어요.");
  });

  it("없는 id 를 바꾸려 해도 큐가 깨지지 않는다", () => {
    appendItem(item(), root);
    updateStatus("없음", "published", undefined, root);

    expect(readQueue(root)).toEqual([item()]);
  });

  it("깨진 줄은 건너뛰고 나머지를 읽는다 — 한 줄 때문에 전체를 잃지 않는다", () => {
    appendItem(item(), root);
    appendItem(item({ id: "b2" }), root);
    // 쓰는 중에 죽어 반쯤 남은 줄을 흉내 낸다
    appendFileSync(path.join(root, "queue.jsonl"), '{"id":"c3","scheduled\n', "utf8");

    expect(readQueue(root).map((i) => i.id)).toEqual(["a1", "b2"]);
  });

  it("형태가 어긋난 줄도 건너뛴다 — JSON 이지만 우리 항목이 아닌 것", () => {
    appendItem(item(), root);
    appendFileSync(path.join(root, "queue.jsonl"), '{"hello":"world"}\n', "utf8");

    expect(readQueue(root).map((i) => i.id)).toEqual(["a1"]);
  });

  it("이미지를 저장하고 그대로 읽는다", () => {
    saveImages("a1", [Buffer.from("one"), Buffer.from("two")], root);

    expect(loadImages("a1", root).map((b) => b.toString())).toEqual(["one", "two"]);
  });

  it("이미지가 없으면 빈 배열이다", () => {
    expect(loadImages("없음", root)).toEqual([]);
  });

  it("이미지를 지우면 폴더가 사라진다", () => {
    saveImages("a1", [Buffer.from("one")], root);
    removeImages("a1", root);

    expect(existsSync(path.join(root, "a1"))).toBe(false);
    expect(loadImages("a1", root)).toEqual([]);
  });

  it("없는 이미지를 지워도 던지지 않는다 — 성공·실패 어느 쪽에서든 부른다", () => {
    expect(() => removeImages("없음", root)).not.toThrow();
  });
});

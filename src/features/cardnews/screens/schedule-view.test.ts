import { describe, it, expect } from "vitest";
import { STATUS_LABELS, hasPendingFrom, isPending, toLocalInputValue, toScheduleView } from "./schedule-view";

function row(over: Record<string, unknown> = {}) {
  return {
    id: "a1",
    scheduledAt: 1_800_000_000_000,
    caption: "캡션",
    imageCount: 5,
    keyword: "수원 갈비",
    status: "pending",
    createdAt: 1_700_000_000_000,
    describe: "3시간 뒤에 올라가요",
    ...over,
  };
}

describe("STATUS_LABELS — 다섯 상태 전부 한국어", () => {
  it("빠진 상태가 없고 영문이 없다", () => {
    for (const status of ["pending", "published", "failed", "missed", "canceled"] as const) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_LABELS[status]).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe("toScheduleView", () => {
  it("정상 목록을 그대로 읽는다", () => {
    const items = toScheduleView(200, { items: [row()] });

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("a1");
    expect(items[0].describe).toBe("3시간 뒤에 올라가요");
  });

  it("실패 사유를 들고 온다 — 왜 안 올라갔는지 감추지 않는다", () => {
    const items = toScheduleView(200, { items: [row({ status: "failed", message: "터널에 닿지 못했어요." })] });

    expect(items[0].message).toBe("터널에 닿지 못했어요.");
  });

  it("200 이 아니면 빈 목록이다 — 화면이 오류로 막히지 않는다", () => {
    expect(toScheduleView(403, { error: "안 됩니다" })).toEqual([]);
  });

  it("형태가 어긋난 응답도 빈 목록으로 접는다", () => {
    for (const bad of [null, {}, { items: "nope" }, "<html>"]) {
      expect(toScheduleView(200, bad)).toEqual([]);
    }
  });

  it("모르는 상태가 섞인 줄은 건너뛴다 — 라벨이 없는 것을 그리지 않는다", () => {
    const items = toScheduleView(200, { items: [row(), row({ id: "b2", status: "무엇" })] });

    expect(items.map((i) => i.id)).toEqual(["a1"]);
  });
});

describe("isPending — 취소할 수 있는 것만", () => {
  it("대기 중만 참이다", () => {
    expect(isPending(toScheduleView(200, { items: [row()] })[0])).toBe(true);
    expect(isPending(toScheduleView(200, { items: [row({ status: "published" })] })[0])).toBe(false);
  });
});

describe("toLocalInputValue — datetime-local 이 읽는 형식", () => {
  it("초를 뺀 로컬 시각 문자열을 만든다", () => {
    const value = toLocalInputValue(new Date(2026, 7, 4, 9, 5).getTime());

    expect(value).toBe("2026-08-04T09:05");
  });

  it("UTC 가 아니라 로컬 기준이다 — 사용자가 보는 시계와 같아야 한다", () => {
    const t = new Date(2026, 0, 1, 0, 30).getTime();

    expect(toLocalInputValue(t)).toBe("2026-01-01T00:30");
  });
});

// 예약해 놓고 "인스타에 올리기"를 또 누르면 같은 카드가 두 번 올라간다.
// 이 세션에서 건 예약이 아직 대기 중인지로 판단한다 — 남이 옛날에 건 예약까지 막으면 안 된다.
describe("hasPendingFrom — 이 세션이 건 예약이 아직 남았나", () => {
  const items = toScheduleView(200, {
    items: [row({ id: "mine", status: "pending" }), row({ id: "other", status: "pending" })],
  });

  it("이 세션이 건 것이 대기 중이면 참이다", () => {
    expect(hasPendingFrom(items, ["mine"])).toBe(true);
  });

  it("이 세션이 건 게 없으면 거짓이다 — 다른 예약이 대기 중이어도 막지 않는다", () => {
    expect(hasPendingFrom(items, [])).toBe(false);
    expect(hasPendingFrom(items, ["없는id"])).toBe(false);
  });

  it("이 세션이 건 것이 끝났으면 거짓이다 — 다시 올릴 수 있어야 한다", () => {
    const done = toScheduleView(200, { items: [row({ id: "mine", status: "published" })] });
    expect(hasPendingFrom(done, ["mine"])).toBe(false);

    const canceled = toScheduleView(200, { items: [row({ id: "mine", status: "canceled" })] });
    expect(hasPendingFrom(canceled, ["mine"])).toBe(false);
  });

  it("여러 번 걸었으면 하나라도 남으면 참이다", () => {
    const mixed = toScheduleView(200, {
      items: [row({ id: "a", status: "published" }), row({ id: "b", status: "pending" })],
    });
    expect(hasPendingFrom(mixed, ["a", "b"])).toBe(true);
  });
});

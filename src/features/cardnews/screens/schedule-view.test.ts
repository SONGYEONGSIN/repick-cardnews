import { describe, it, expect } from "vitest";
import {
  STATUS_LABELS,
  canRemoveRecord,
  recordWhen,
  hasPendingFrom,
  isPending,
  progressLine,
  schedulerWarning,
  toPublishBase64,
  toLocalInputValue,
  toScheduleView,
} from "./schedule-view";

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

describe("STATUS_LABELS — 여섯 상태 전부 한국어", () => {
  it("빠진 상태가 없고 영문이 없다", () => {
    for (const status of ["pending", "publishing", "published", "failed", "missed", "canceled"] as const) {
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

/**
 * 예약이 도는 동안 목록은 '대기 중 · N분 지났어요' 만 보여 줬다 — 실제로 어디까지 갔는지는
 * 알 수 없었다(손으로 올릴 때는 보이는데). 서버가 함께 내려주는 진행 상황을 읽는다.
 */
describe("진행 상황 읽기", () => {
  function body(progress: unknown) {
    return {
      items: [
        { id: "a1", status: "pending", keyword: "수원 갈비", imageCount: 5, describe: "대기 중", progress },
      ],
    };
  }

  it("진행이 없으면 undefined 다 — 아직 시작 전이다", () => {
    expect(toScheduleView(200, body(undefined))[0].progress).toBeUndefined();
  });

  it("준비 중이면 몇 장 중 몇 장인지 읽는다", () => {
    expect(toScheduleView(200, body({ stage: "preparing", index: 2, total: 5 }))[0].progress).toEqual({
      stage: "preparing",
      index: 2,
      total: 5,
    });
  });

  it("올리는 중도 읽는다", () => {
    expect(toScheduleView(200, body({ stage: "publishing" }))[0].progress).toEqual({ stage: "publishing" });
  });

  it("모르는 모양은 버린다 — 화면이 깨지느니 안 보여 준다", () => {
    expect(toScheduleView(200, body({ stage: "이상한값" }))[0].progress).toBeUndefined();
    expect(toScheduleView(200, body("문자열"))[0].progress).toBeUndefined();
  });
});

describe("progressLine — 사람이 읽는 한 줄", () => {
  it("준비 중은 장수를 말한다", () => {
    expect(progressLine({ stage: "preparing", index: 2, total: 5 })).toBe("5장 중 2장 준비 중");
  });

  it("한 장짜리는 장수를 세지 않는다 — '1장 중 1장'은 군더더기다", () => {
    expect(progressLine({ stage: "preparing", index: 1, total: 1 })).toBe("사진 준비 중");
  });

  it("묶는 중·올리는 중", () => {
    expect(progressLine({ stage: "bundling" })).toBe("한 세트로 묶는 중");
    expect(progressLine({ stage: "publishing" })).toBe("인스타그램에 올리는 중");
  });

  it("없으면 null 이다 — 부를 쪽이 안 그리면 된다", () => {
    expect(progressLine(undefined)).toBeNull();
  });
});

/**
 * 시계가 멈추면 예약은 영영 안 올라간다 — 화면이 그 사실을 말해야 한다. 실제로 44분이
 * 지나도 '대기 중'만 보였다(2026-08-05).
 */
describe("schedulerWarning — 시계가 멈췄다고 말할 때", () => {
  it("멈췄고 기다리는 예약이 있으면 알린다", () => {
    expect(schedulerWarning("stale", true)).not.toBeNull();
  });

  it("멈췄어도 기다리는 예약이 없으면 조용하다 — 겁줄 일이 아니다", () => {
    expect(schedulerWarning("stale", false)).toBeNull();
  });

  it("돌고 있으면 조용하다", () => {
    expect(schedulerWarning("alive", true)).toBeNull();
  });

  it("모르면 조용하다 — 옛 서버는 이 값을 안 준다", () => {
    expect(schedulerWarning(undefined, true)).toBeNull();
  });

  it("무엇을 해야 하는지까지 말한다", () => {
    expect(schedulerWarning("stale", true)).toContain("다시");
  });
});

/**
 * `captureImages` 는 **순수 base64**(`btoa` 결과)를 돌려준다 — `data:` 접두사가 없다. 그런데
 * 예약 패널이 data URL 인 줄 알고 콤마로 잘라, 매번 **빈 문자열**을 보냈다. 그래서 예약이
 * 저장한 이미지가 0바이트였고 인스타그램은 그것을 받아 `HTTP 500 · code 1` 로 거절했다
 * (2026-08-05, 디스크 파일을 직접 열어 확인). 예약 발행은 처음부터 한 번도 되지 않았다.
 */
describe("toPublishBase64 — 캡처 결과를 보낼 형태로", () => {
  it("순수 base64 는 그대로 보낸다", () => {
    expect(toPublishBase64("iVBORw0KGgoAAAANSUhEUg==")).toBe("iVBORw0KGgoAAAANSUhEUg==");
  });

  it("data URL 로 와도 앞머리를 떼고 보낸다 — 어느 쪽이 와도 깨지지 않는다", () => {
    expect(toPublishBase64("data:image/png;base64,iVBORw0KGgo=")).toBe("iVBORw0KGgo=");
  });

  it("빈 값은 빈 값이다 — 조용히 0바이트를 만들지 않게 부르는 쪽이 막는다", () => {
    expect(toPublishBase64("")).toBe("");
  });

  it("base64 안의 '+' 나 '/' 를 자르지 않는다", () => {
    expect(toPublishBase64("ab+/cd==")).toBe("ab+/cd==");
  });
});

/**
 * 목록이 예약 전용이 아니게 됐다 — 지금 바로 올린 것도 함께 쌓인다. 그래서 상태 문구도
 * 예약 말투("올렸어요")가 아니라 **결과**를 말해야 하고, 언제 올렸는지도 보여야 하며,
 * 끝난 기록은 지울 수 있어야 한다(2026-08-05).
 */
describe("STATUS_LABELS — 결과를 명시한다", () => {
  it("성공·실패·취소가 그대로 읽힌다", () => {
    expect(STATUS_LABELS.published).toContain("성공");
    expect(STATUS_LABELS.failed).toContain("실패");
    expect(STATUS_LABELS.canceled).toContain("취소");
  });

  it("아직 안 끝난 것과 놓친 것도 구분된다", () => {
    expect(STATUS_LABELS.pending).not.toContain("성공");
    expect(STATUS_LABELS.missed).not.toContain("성공");
  });
});

describe("canRemoveRecord — 지울 수 있는 기록", () => {
  it("실패·취소·놓침은 지운다", () => {
    expect(canRemoveRecord("failed")).toBe(true);
    expect(canRemoveRecord("canceled")).toBe(true);
    expect(canRemoveRecord("missed")).toBe(true);
  });

  // 지금 인스타로 올라가는 중이다. 여기서 기록을 지우면 무엇이 올라갔는지 알 길이 없어진다.
  it("올리는 중은 못 지운다", () => {
    expect(canRemoveRecord("publishing")).toBe(false);
  });

  it("대기 중은 못 지운다 — 취소가 먼저다", () => {
    expect(canRemoveRecord("pending")).toBe(false);
  });

  // 올라간 기록을 지우면 무엇을 올렸는지 알 길이 없어진다. 인스타에는 남아 있는데 여기만 사라진다.
  it("성공한 것은 못 지운다", () => {
    expect(canRemoveRecord("published")).toBe(false);
  });
});

describe("recordWhen — 언제 올렸나", () => {
  const at = new Date("2026-08-05T14:30:00+09:00").getTime();

  it("월·일·시각을 읽기 좋게 준다", () => {
    const line = recordWhen(at);
    expect(line).toContain("8월 5일");
    expect(line).toMatch(/\d{1,2}:\d{2}/);
  });

  it("없으면 빈 문자열이다 — 옛 기록에는 시각이 없다", () => {
    expect(recordWhen(undefined)).toBe("");
  });
});

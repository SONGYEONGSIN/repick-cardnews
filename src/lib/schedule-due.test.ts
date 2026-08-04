import { describe, it, expect } from "vitest";
import { GRACE_MS, describeSchedule, dueVerdict } from "./schedule-due";

const T = new Date("2026-08-04T09:00:00+09:00").getTime();

describe("dueVerdict — 유예 1시간", () => {
  it("아직 시각 전이면 기다린다", () => {
    expect(dueVerdict(T, T - 1)).toBe("wait");
  });

  it("시각이 되면 올린다", () => {
    expect(dueVerdict(T, T)).toBe("due");
  });

  it("유예 안이면 늦게라도 올린다 — 잠시 껐던 경우를 구제한다", () => {
    expect(dueVerdict(T, T + GRACE_MS - 1)).toBe("due");
  });

  it("유예를 넘기면 놓친 것으로 둔다 — 새벽에 어제 예약이 올라가면 안 된다", () => {
    expect(dueVerdict(T, T + GRACE_MS)).toBe("missed");
    expect(dueVerdict(T, T + GRACE_MS * 5)).toBe("missed");
  });

  it("유예는 1시간이다(사용자가 정한 값)", () => {
    expect(GRACE_MS).toBe(60 * 60 * 1000);
  });
});

describe("describeSchedule — 한국어 한 줄", () => {
  it("남은 시간을 말한다", () => {
    const line = describeSchedule(T, T - 90 * 60 * 1000);

    expect(line).toContain("뒤");
    expect(line).not.toMatch(/[A-Za-z]/);
  });

  it("한 시간이 넘으면 시간과 분을 함께 말한다", () => {
    expect(describeSchedule(T, T - 90 * 60 * 1000)).toContain("1시간 30분");
  });

  it("딱 떨어지면 분을 붙이지 않는다", () => {
    expect(describeSchedule(T, T - 120 * 60 * 1000)).toContain("2시간 뒤");
  });

  it("한 시간 미만이면 분만 말한다", () => {
    expect(describeSchedule(T, T - 25 * 60 * 1000)).toContain("25분 뒤");
  });

  it("지난 예약은 지났다고 말한다", () => {
    const line = describeSchedule(T, T + 5 * 60 * 1000);

    expect(line).toContain("지났");
    expect(line).not.toMatch(/[A-Za-z]/);
  });
});

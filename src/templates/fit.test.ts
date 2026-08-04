import { describe, it, expect } from "vitest";
import { DEFAULT_FIT, FIT_RANGE, clampFit, sizeWith, type Fit } from "./fit";

/**
 * 카드 안 여백·크기 손잡이. 값은 **배수**다 — 자동 규칙(항목 5개 이상이면 타이포가 줄어드는
 * `compact`)은 그대로 두고 그 위에 곱한다. 1 이면 지금까지와 똑같다.
 *
 * 배수로 둔 이유: 절대 px 로 저장하면 `compact` 가 켜지고 꺼질 때 사용자가 맞춰 둔 값이
 * 엉뚱해진다. 배수는 어느 쪽에서도 "조금 크게/작게"라는 뜻을 유지한다.
 */
describe("clampFit — 범위를 넘지 않는다", () => {
  it("기본값은 전부 1 이다 — 손대기 전에는 지금까지와 같다", () => {
    expect(DEFAULT_FIT).toEqual({ text: 1, gap: 1, pad: 1 });
  });

  it("범위를 벗어나면 끝값으로 자른다", () => {
    const over: Fit = { text: 99, gap: -5, pad: 0 };
    const fit = clampFit(over);
    expect(fit.text).toBe(FIT_RANGE.text.max);
    expect(fit.gap).toBe(FIT_RANGE.gap.min);
    expect(fit.pad).toBe(FIT_RANGE.pad.min);
  });

  it("범위 안 값은 그대로 둔다", () => {
    expect(clampFit({ text: 0.9, gap: 1.4, pad: 1.1 })).toEqual({ text: 0.9, gap: 1.4, pad: 1.1 });
  });

  it("숫자가 아니면 기본값으로 되돌린다 — 저장된 값이 깨져도 카드가 안 깨진다", () => {
    expect(clampFit({ text: Number.NaN, gap: 1, pad: 1 }).text).toBe(1);
  });
});

describe("sizeWith — 배수를 실제 px 로", () => {
  it("1 이면 기준값 그대로다", () => {
    expect(sizeWith(66, 1)).toBe(66);
  });

  it("정수 px 로 떨어뜨린다 — 소수 px 는 글꼴을 흐리게 만든다", () => {
    expect(sizeWith(66, 0.85)).toBe(56);
    expect(Number.isInteger(sizeWith(22, 1.37))).toBe(true);
  });

  it("0 으로 줄지 않는다 — 간격이 0 이 되면 글이 붙어 버린다", () => {
    expect(sizeWith(4, 0.01)).toBeGreaterThanOrEqual(1);
  });
});

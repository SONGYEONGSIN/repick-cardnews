import { describe, it, expect } from "vitest";
import {
  objectPosition,
  scrimGradient,
  scrimStops,
  textYSpacers,
  isBlankText,
  DEFAULT_FOCAL,
  DEFAULT_SCRIM,
  DEFAULT_BAND_CARDNEWS,
  DEFAULT_BAND_INFO,
} from "@/templates/layout-utils";

describe("objectPosition", () => {
  it("0~1 좌표를 퍼센트로 바꾼다", () => {
    expect(objectPosition({ x: 0.5, y: 0.3 })).toBe("50% 30%");
  });
  it("반올림해 정수 퍼센트로 만든다", () => {
    expect(objectPosition({ x: 0.333, y: 0.666 })).toBe("33% 67%");
  });
  it("범위를 벗어나면 0~100으로 자른다", () => {
    expect(objectPosition({ x: -1, y: 2 })).toBe("0% 100%");
  });
  it("기본 초점은 정중앙이다", () => {
    expect(objectPosition(DEFAULT_FOCAL)).toBe("50% 50%");
  });
});

// scrimStops: scrimGradient가 문자열을 만들기 전 정지점을 구조화된 값(position/alpha)으로 낸다.
// 문자열을 정규식으로 뜯는 테스트는 부서지기 쉬우므로 이 값 자체를 검증 대상으로 삼는다.
describe("scrimStops", () => {
  it("textY=1 일 때 정지점이 지금(카드 아래가 가장 어두운) 그라데이션과 같다", () => {
    // p = 1*100 = 100. 규칙표: p-68=32(0), p-34=66(mid), p=100(a), p+34=134(mid, 카드 밖),
    // p+68=168(0, 카드 밖). 보이는 세 정지점(32/66/100)이 기존 to-top 그라데이션(0%/34%/68%)을
    // 뒤집은 것과 정확히 같다 — 이게 이 기능이 기존 카드 모양을 안 바꾼다는 증거다.
    expect(scrimStops(0.8, 1)).toEqual([
      { position: 32, alpha: 0 },
      { position: 66, alpha: 0.6 },
      { position: 100, alpha: 0.8 },
      { position: 134, alpha: 0.6 },
      { position: 168, alpha: 0 },
    ]);
  });

  it("textY=0 일 때 위아래가 뒤집힌다 — 어두운 마루가 맨 위(0%)로 온다", () => {
    const top = scrimStops(0.8, 0).find((s) => s.alpha === 0.8);
    const bottom = scrimStops(0.8, 1).find((s) => s.alpha === 0.8);
    expect(top?.position).toBe(0);
    expect(bottom?.position).toBe(100);
  });

  it("textY=0.5 일 때 마루가 가운데(50%)에 온다", () => {
    const peak = scrimStops(0.8, 0.5).find((s) => s.alpha === 0.8);
    expect(peak?.position).toBe(50);
  });

  it("strength 와 textY 범위 밖 값이 0~1로 가둬진다", () => {
    expect(scrimStops(2, 2)).toEqual(scrimStops(1, 1));
    expect(scrimStops(-1, -1)).toEqual(scrimStops(0, 0));
  });
});

describe("scrimGradient", () => {
  it("textY=1 일 때 기존(아래에서 위로 옅어지는) 그라데이션과 시각적으로 같다", () => {
    expect(scrimGradient(0.8, 1)).toBe(
      "linear-gradient(to bottom, rgba(0,0,0,0) 32%, rgba(0,0,0,0.6) 66%, rgba(0,0,0,0.8) 100%, rgba(0,0,0,0.6) 134%, rgba(0,0,0,0) 168%)",
    );
  });
  it("강도를 0~1로 자른다", () => {
    expect(scrimGradient(2, 1)).toContain("rgba(0,0,0,1)");
    expect(scrimGradient(-1, 1)).toContain("rgba(0,0,0,0) 100%");
  });
  it("소수 둘째 자리로 반올림해 결정론을 지킨다", () => {
    expect(scrimGradient(0.333, 1)).toContain("rgba(0,0,0,0.33)");
  });
});

// textYSpacers: 글 덩어리 위/아래에 두는 신축 여백의 flex-grow 비율. flex-basis 0 인 두 스페이서에
// 이 값을 그대로 꽂으면, textY=1 일 때 위 스페이서만 자라 flex-end 와 같아지고
// textY=0 일 때 아래 스페이서만 자라 flex-start 와 같아진다 — 좌표를 높이로 잘라내지 않는다.
describe("textYSpacers", () => {
  it("textY=1 이면 위 여백만 자란다(지금의 flex-end 와 동일)", () => {
    expect(textYSpacers(1)).toEqual({ top: 1, bottom: 0 });
  });

  it("textY=0 이면 아래 여백만 자란다(flex-start 와 동일)", () => {
    expect(textYSpacers(0)).toEqual({ top: 0, bottom: 1 });
  });

  it("textY=0.5 이면 위아래 여백이 같다(지금의 justify-content:center 와 동일)", () => {
    expect(textYSpacers(0.5)).toEqual({ top: 0.5, bottom: 0.5 });
  });

  it("두 여백의 합은 항상 1이다", () => {
    const { top, bottom } = textYSpacers(0.333);
    expect(round2Sum(top, bottom)).toBe(1);
  });

  it("범위를 벗어난 값은 0~1로 가둔다", () => {
    expect(textYSpacers(2)).toEqual(textYSpacers(1));
    expect(textYSpacers(-1)).toEqual(textYSpacers(0));
  });
});

function round2Sum(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

// isBlankText: 헤드라인·본문을 지웠는지 판정한다. 공백만 남은 글도 "비었다"로 본다 —
// 사용자가 스페이스바만 눌러도 지운 것과 같은 결과여야 한다(CardnewsBody·CardCanvas 공용).
describe("isBlankText", () => {
  it("빈 문자열은 비었다", () => {
    expect(isBlankText("")).toBe(true);
  });
  it("공백만 있으면 비었다", () => {
    expect(isBlankText("   ")).toBe(true);
  });
  it("줄바꿈만 있으면 비었다", () => {
    expect(isBlankText("\n\n")).toBe(true);
  });
  it("정상 글은 비지 않았다", () => {
    expect(isBlankText("수원 갈비")).toBe(false);
  });
  it("앞뒤 공백이 있는 정상 글도 비지 않았다", () => {
    expect(isBlankText("  수원 갈비  ")).toBe(false);
  });
});

describe("기본값", () => {
  it("스크림 기본값은 대비를 확보하는 0.72다", () => {
    expect(DEFAULT_SCRIM).toBe(0.72);
  });
  it("밴드 기본값은 카드뉴스 0.45 · 정보전달 0.35다", () => {
    expect(DEFAULT_BAND_CARDNEWS).toBe(0.45);
    expect(DEFAULT_BAND_INFO).toBe(0.35);
  });
});

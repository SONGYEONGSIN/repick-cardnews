import { describe, it, expect } from "vitest";
import { photoStage, canGenerate, dropzoneOpen, dropExit, type StartChoice } from "./workbench-view";

/**
 * 만들기 화면은 **사진을 쓸지 말지 먼저 묻는다.** 예전엔 드롭존과 '카피 만들기' 버튼이 나란히
 * 있어 "사진을 올려야 하는 건가?"가 모호했다(사진은 선택인데도 필수처럼 보였다).
 *
 * 순수 함수다 — 이 저장소 vitest 는 `environment: "node"` 라 화면을 못 그린다.
 */
describe("photoStage — 지금 무엇을 보여 줄 차례인가", () => {
  it("아직 안 골랐으면 고르는 차례다", () => {
    expect(photoStage("unset", 0, false)).toBe("choose");
  });

  it("사진으로 만들기를 골랐는데 아직 없으면 올리는 차례다", () => {
    expect(photoStage("with-photo", 0, false)).toBe("upload");
  });

  it("사진을 올렸으면 만들 차례다", () => {
    expect(photoStage("with-photo", 1, false)).toBe("ready");
  });

  it("사진 없이 만들기를 골랐으면 바로 만들 차례다", () => {
    expect(photoStage("without-photo", 0, false)).toBe("ready");
  });

  // 되돌아왔을 때 이미 만든 카드가 있으면 처음 질문을 다시 묻지 않는다 — 고치러 온 것이다.
  it("이미 카피가 있으면 고르는 차례로 되돌아가지 않는다", () => {
    const choices: StartChoice[] = ["unset", "with-photo", "without-photo"];
    for (const choice of choices) {
      expect(photoStage(choice, 0, true)).toBe("ready");
    }
  });
});

describe("canGenerate — '카피 만들기'를 누를 수 있는가", () => {
  it("만들 차례에서만 누를 수 있다", () => {
    expect(canGenerate("ready")).toBe(true);
    expect(canGenerate("choose")).toBe(false);
    expect(canGenerate("upload")).toBe(false);
  });
});

/**
 * 드롭존을 여는 길이 **둘**이다: 처음에 '사진 올리고 만들기'를 고른 경우(`upload`)와, 이미
 * 만들 준비가 된 상태에서 '사진 올리기'를 다시 누른 경우(`ready` + `adding`). 나가는 문을
 * 한쪽에만 달았다가 두 번째 경로에서 다시 막혔다(2026-08-04) — 그래서 판단을 여기 모은다.
 */
describe("dropzoneOpen — 드롭존을 언제 여는가", () => {
  it("사진으로 만들기를 골랐으면 연다", () => {
    expect(dropzoneOpen("upload", false, false)).toBe(true);
  });

  it("준비된 상태에서 '사진 올리기'를 누르면 연다", () => {
    expect(dropzoneOpen("ready", true, false)).toBe(true);
  });

  it("준비된 상태에서 안 눌렀으면 안 연다", () => {
    expect(dropzoneOpen("ready", false, false)).toBe(false);
  });

  it("고르는 차례에는 안 연다", () => {
    expect(dropzoneOpen("choose", true, false)).toBe(false);
  });

  it("카피를 쓰는 중에는 안 연다 — 그 위에 파일을 떨구게 두지 않는다", () => {
    expect(dropzoneOpen("upload", false, true)).toBe(false);
    expect(dropzoneOpen("ready", true, true)).toBe(false);
  });
});

describe("dropExit — 드롭존에서 나가는 문", () => {
  it("사진이 없으면 '사진 없이 만들기'다", () => {
    expect(dropExit(0)).toBe("without-photo");
  });

  // 이미 올린 사진이 있는데 '사진 없이'로 보내면 그 사진이 그대로 카드에 남아 말과 달라진다.
  it("사진이 있으면 '취소'다", () => {
    expect(dropExit(1)).toBe("cancel");
  });
});

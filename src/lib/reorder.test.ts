import { describe, it, expect } from "vitest";
import { move } from "@/lib/reorder";

describe("move", () => {
  it("앞에서 뒤로 옮긴다", () => {
    expect(move(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });
  it("뒤에서 앞으로 옮긴다", () => {
    expect(move(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });
  it("같은 자리면 그대로다", () => {
    expect(move(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });
  it("원본을 바꾸지 않는다", () => {
    const src = ["a", "b", "c"];
    move(src, 0, 2);
    expect(src).toEqual(["a", "b", "c"]);
  });
  it("범위 밖 인덱스면 복사본을 그대로 돌려준다", () => {
    expect(move(["a", "b"], -1, 1)).toEqual(["a", "b"]);
    expect(move(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});

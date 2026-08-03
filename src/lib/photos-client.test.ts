import { describe, it, expect } from "vitest";
import { readAllEntries } from "@/lib/photos-client";

/**
 * FileSystemDirectoryReader 계약을 흉내 낸다 —
 * 한 번 호출에 한 배치씩 주고, 더 없으면 빈 배열을 준다.
 */
function fakeReader(batches: string[][]) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    readEntries(onBatch: (entries: string[]) => void) {
      const batch = batches[calls] ?? [];
      calls += 1;
      onBatch(batch);
    },
  };
}

describe("readAllEntries", () => {
  it("배치가 나뉘어 와도 빈 배열이 올 때까지 전부 모은다", async () => {
    const reader = fakeReader([["a", "b"], ["c"]]);
    expect(await readAllEntries(reader)).toEqual(["a", "b", "c"]);
  });

  it("빈 배열을 받을 때까지 반복 호출한다", async () => {
    const reader = fakeReader([["a"], ["b"]]);
    await readAllEntries(reader);
    expect(reader.calls).toBe(3);
  });

  it("첫 배치가 비어 있으면 빈 목록이다", async () => {
    expect(await readAllEntries(fakeReader([]))).toEqual([]);
  });

  it("읽기에 실패하면 거부한다", async () => {
    const reader = {
      readEntries(_onBatch: (entries: string[]) => void, onError: (err: DOMException) => void) {
        onError(new DOMException("폴더를 읽지 못함"));
      },
    };
    await expect(readAllEntries(reader)).rejects.toThrow("폴더를 읽지 못함");
  });
});

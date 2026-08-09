import { describe, expect, it } from "vitest";
import { imagePath, itemPath, parseItem } from "./schedule-store";

describe("경로", () => {
  it("항목과 이미지가 같은 폴더를 쓴다", () => {
    expect(itemPath("a1")).toBe("scheduled/a1/item.json");
    expect(imagePath("a1", 0)).toBe("scheduled/a1/1.png");
    expect(imagePath("a1", 9)).toBe("scheduled/a1/10.png");
  });
});

describe("parseItem", () => {
  const ok = {
    id: "a1",
    scheduledAt: 1800000000000,
    caption: "캡션",
    keyword: "수원 갈비",
    imageUrls: ["https://blob.example/scheduled/a1/1.png"],
    status: "pending",
    createdAt: 1700000000000,
  };

  it("모양이 맞으면 값을 돌려준다", () => {
    expect(parseItem(ok)?.id).toBe("a1");
  });

  // 저장소가 깨졌을 때 목록 전체가 터지면 안 된다 — 그 항목만 빠진다.
  it("모양이 아니면 null", () => {
    expect(parseItem(null)).toBeNull();
    expect(parseItem("문자열")).toBeNull();
    expect(parseItem({ ...ok, status: "몰라" })).toBeNull();
    expect(parseItem({ ...ok, imageUrls: "하나" })).toBeNull();
    expect(parseItem({ ...ok, scheduledAt: "언젠가" })).toBeNull();
  });

  it("publishing 과 claimedAt 을 받는다", () => {
    const item = parseItem({ ...ok, status: "publishing", claimedAt: 123 });
    expect(item?.status).toBe("publishing");
    expect(item?.claimedAt).toBe(123);
  });

  it("옛 기록처럼 updatedAt·message 가 없어도 받는다", () => {
    expect(parseItem(ok)?.updatedAt).toBeUndefined();
  });
});

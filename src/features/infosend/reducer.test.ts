import { describe, it, expect } from "vitest";
import {
  infoReducer,
  initialInfoState,
  selectedPhoto,
  canLeavePhoto,
  bandForItems,
  ITEMS_MIN,
  ITEMS_MAX,
  type InfoState,
} from "@/features/infosend/reducer";
import type { Photo } from "@/lib/photos";

function photo(id: string): Photo {
  return { id, name: `${id}.jpg`, dataUrl: "data:image/jpeg;base64,AAA", thumbUrl: "data:image/jpeg;base64,AAA", width: 1080, height: 1350, bytes: 1000 };
}

function withPhotos(count: number): InfoState {
  const photos = Array.from({ length: count }, (_, i) => photo(`p${i + 1}`));
  return infoReducer(initialInfoState, { type: "ADD_PHOTOS", photos });
}

const spec = {
  type: "informationsend" as const,
  title: "에어컨 전기세",
  items: [
    { keyword: "온도", desc: "24~26도" },
    { keyword: "필터", desc: "2주마다" },
    { keyword: "선풍기", desc: "함께 켜기" },
  ],
};

describe("ADD_PHOTOS", () => {
  it("첫 사진을 대표로 자동 선택한다", () => {
    expect(withPhotos(3).selectedPhotoId).toBe("p1");
  });
  it("이미 고른 게 있으면 유지한다", () => {
    const s = infoReducer(withPhotos(2), { type: "ADD_PHOTOS", photos: [photo("p9")] });
    expect(s.selectedPhotoId).toBe("p1");
  });
});

describe("SELECT_PHOTO", () => {
  it("대표를 바꾼다", () => {
    const s = infoReducer(withPhotos(3), { type: "SELECT_PHOTO", photoId: "p3" });
    expect(selectedPhoto(s)?.id).toBe("p3");
  });
});

describe("canLeavePhoto", () => {
  it("사진이 없으면 못 넘어간다", () => {
    expect(canLeavePhoto(initialInfoState)).toBe(false);
  });
  it("대표를 골랐으면 넘어간다", () => {
    expect(canLeavePhoto(withPhotos(1))).toBe(true);
  });
});

describe("items 편집", () => {
  const base = infoReducer(withPhotos(1), { type: "SET_SPEC", spec });

  it("항목 순서를 바꾼다", () => {
    const s = infoReducer(base, { type: "REORDER_ITEM", from: 0, to: 2 });
    expect(s.spec?.items.map((i) => i.keyword)).toEqual(["필터", "선풍기", "온도"]);
  });

  it("항목을 추가한다", () => {
    const s = infoReducer(base, { type: "ADD_ITEM" });
    expect(s.spec?.items).toHaveLength(4);
  });

  it("최대치를 넘겨 추가하지 않는다", () => {
    let s = base;
    for (let i = 0; i < 10; i++) s = infoReducer(s, { type: "ADD_ITEM" });
    expect(s.spec?.items).toHaveLength(ITEMS_MAX);
  });

  it("항목을 지운다", () => {
    const s = infoReducer(infoReducer(base, { type: "ADD_ITEM" }), { type: "REMOVE_ITEM", index: 0 });
    expect(s.spec?.items).toHaveLength(3);
  });

  it("최소치 아래로는 지우지 않는다", () => {
    const s = infoReducer(base, { type: "REMOVE_ITEM", index: 0 });
    expect(s.spec?.items).toHaveLength(ITEMS_MIN);
  });

  it("항목 내용을 고친다", () => {
    const s = infoReducer(base, { type: "UPDATE_ITEM", index: 0, patch: { desc: "25도" } });
    expect(s.spec?.items[0].desc).toBe("25도");
    expect(s.spec?.items[0].keyword).toBe("온도");
  });
});

describe("bandForItems", () => {
  it("항목 3개(최소)는 0.25", () => {
    expect(bandForItems(3)).toBe(0.25);
  });
  it("항목 4개는 하한 0.15", () => {
    expect(bandForItems(4)).toBe(0.15);
  });
  it("항목 5개는 하한 0.15", () => {
    expect(bandForItems(5)).toBe(0.15);
  });
  it("항목 6개(최대)는 하한 0.15", () => {
    expect(bandForItems(6)).toBe(0.15);
  });
});

describe("밴드 자동 갱신", () => {
  it("SET_SPEC이 항목 수에 맞춰 밴드를 갱신한다", () => {
    const s = infoReducer(withPhotos(1), { type: "SET_SPEC", spec });
    expect(s.band).toBe(bandForItems(3));
  });

  it("ADD_ITEM이 늘어난 항목 수에 맞춰 밴드를 다시 계산한다", () => {
    const base = infoReducer(withPhotos(1), { type: "SET_SPEC", spec });
    const s = infoReducer(base, { type: "ADD_ITEM" });
    expect(s.band).toBe(bandForItems(4));
  });

  it("REMOVE_ITEM이 줄어든 항목 수에 맞춰 밴드를 다시 계산한다", () => {
    const base = infoReducer(withPhotos(1), { type: "SET_SPEC", spec });
    const withFour = infoReducer(base, { type: "ADD_ITEM" });
    const s = infoReducer(withFour, { type: "REMOVE_ITEM", index: 0 });
    expect(s.band).toBe(bandForItems(3));
  });

  it("SET_BAND으로 직접 조정한 뒤에는 ADD_ITEM이 밴드를 덮어쓰지 않는다", () => {
    const base = infoReducer(withPhotos(1), { type: "SET_SPEC", spec });
    const touched = infoReducer(base, { type: "SET_BAND", band: 0.2 });
    const s = infoReducer(touched, { type: "ADD_ITEM" });
    expect(s.band).toBe(0.2);
  });

  it("SET_BAND으로 직접 조정한 뒤에는 REMOVE_ITEM도 밴드를 덮어쓰지 않는다", () => {
    const base = infoReducer(withPhotos(1), { type: "SET_SPEC", spec });
    const withFour = infoReducer(base, { type: "ADD_ITEM" });
    const touched = infoReducer(withFour, { type: "SET_BAND", band: 0.3 });
    const s = infoReducer(touched, { type: "REMOVE_ITEM", index: 0 });
    expect(s.band).toBe(0.3);
  });
});

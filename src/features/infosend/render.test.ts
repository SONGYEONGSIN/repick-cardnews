import { describe, it, expect } from "vitest";
import { toRenderCard } from "@/features/infosend/render";
import type { InfoState } from "@/features/infosend/reducer";
import type { Photo } from "@/lib/photos";
import { DEFAULT_FIT } from "@/templates/fit";

function photo(id: string, dataUrl = `data:image/jpeg;base64,${id}`): Photo {
  return { id, name: `${id}.jpg`, dataUrl, thumbUrl: dataUrl, width: 1080, height: 1350, bytes: 1000 };
}

const spec = {
  type: "informationsend" as const,
  title: "에어컨 전기세",
  subtitle: "여름철 절약 팁",
  items: [
    { keyword: "온도", desc: "24~26도" },
    { keyword: "필터", desc: "2주마다" },
    { keyword: "선풍기", desc: "함께 켜기" },
  ],
  tip: "취침 전 예약을 걸어 두세요",
};

function state(overrides: Partial<InfoState> = {}): InfoState {
  return {
    step: 3,
    photos: [photo("p1")],
    selectedPhotoId: "p1",
    keyword: "에어컨 전기세",
    themeId: "mint-clean",
    handle: "",
    band: 0.35,
    bandTouched: false,
    focal: { x: 0.5, y: 0.5 },
    fit: DEFAULT_FIT,
    spec,
    error: null,
    busy: false,
    ...overrides,
  };
}

describe("toRenderCard", () => {
  it("spec이 null이면 null을 돌려준다", () => {
    const s = state({ spec: null });
    expect(toRenderCard(s)).toBeNull();
  });

  it("대표 사진이 없으면 photoUrl은 null이 된다", () => {
    const s = state({ selectedPhotoId: null });
    const card = toRenderCard(s);
    expect(card?.photoUrl).toBeNull();
  });

  it("대표 사진이 있으면 해당 사진의 dataUrl을 그대로 가져온다", () => {
    const s = state({
      photos: [photo("p1", "data:image/jpeg;base64,AAA"), photo("p2", "data:image/jpeg;base64,BBB")],
      selectedPhotoId: "p2",
    });
    const card = toRenderCard(s);
    expect(card?.photoUrl).toBe("data:image/jpeg;base64,BBB");
  });

  it("layout은 항상 split, badge는 빈 문자열이다", () => {
    const card = toRenderCard(state());
    expect(card?.layout).toBe("split");
    expect(card?.badge).toBe("");
  });

  it("band·focal·copy는 상태에서 그대로 옮겨진다", () => {
    const focal = { x: 0.2, y: 0.8 };
    const s = state({ band: 0.25, focal });
    const card = toRenderCard(s);
    expect(card?.band).toBe(0.25);
    expect(card?.focal).toEqual(focal);
    expect(card?.copy).toEqual(spec);
  });

  it("scrim은 항상 0이다 — 정보전달 카드는 사진 위에 스크림을 얹지 않는다", () => {
    const card = toRenderCard(state());
    expect(card?.scrim).toBe(0);
  });
});

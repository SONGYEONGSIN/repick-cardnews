import { describe, it, expect } from "vitest";
import {
  infoReducer,
  initialInfoState,
  selectedPhoto,
  canLeaveInfoTopic,
  captionSourceLines,
  canLeaveInfoWorkbench,
  bandForItems,
  ITEMS_MIN,
  ITEMS_MAX,
  type InfoState,
} from "@/features/infosend/reducer";
import type { Photo } from "@/lib/photos";
import { InfographicSpec, itemTexts } from "@/lib/schema";
import { infoChecks } from "./checks";
import { DEFAULT_BAND_INFO } from "@/templates/layout-utils";

function photo(id: string): Photo {
  return { id, name: `${id}.jpg`, dataUrl: "data:image/jpeg;base64,AAA", thumbUrl: "data:image/jpeg;base64,AAA", width: 1080, height: 1350, bytes: 1000 };
}

function withPhotos(count: number): InfoState {
  const photos = Array.from({ length: count }, (_, i) => photo(`p${i + 1}`));
  return infoReducer(initialInfoState, { type: "ADD_PHOTOS", photos });
}

const spec = {
  type: "informationsend" as const,
  format: "list" as const,
  title: "에어컨 전기세",
  items: [
    { keyword: "온도", desc: "24~26도" },
    { keyword: "필터", desc: "2주마다" },
    { keyword: "선풍기", desc: "함께 켜기" },
  ],
};

// bandForItems(3)이 DEFAULT_BAND_INFO와 우연히 같아 3개짜리 spec으로는 SET_SPEC의 밴드 갱신을
// 검증하지 못한다(...nextBand(...)를 통째로 지워도 초기값이 그대로 상속돼 테스트가 통과함).
// 항목 5개(bandForItems(5)=0.25, 초기값 0.35와 다름)로 실제 갱신 여부를 구분한다.
const spec5 = {
  type: "informationsend" as const,
  format: "list" as const,
  title: "에어컨 전기세",
  items: [
    { keyword: "온도", desc: "24~26도" },
    { keyword: "필터", desc: "2주마다" },
    { keyword: "선풍기", desc: "함께 켜기" },
    { keyword: "커튼", desc: "낮에 치기" },
    { keyword: "타이머", desc: "취침 예약" },
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

describe("items 편집", () => {
  const base = infoReducer(withPhotos(1), { type: "SET_SPEC", spec });

  it("항목 순서를 바꾼다", () => {
    const s = infoReducer(base, { type: "REORDER_ITEM", from: 0, to: 2 });
    expect(s.spec?.items.map((i) => itemTexts(i)[0])).toEqual(["필터", "선풍기", "온도"]);
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
    expect(itemTexts(s.spec!.items[0])).toEqual(["온도", "25도"]);
  });
});

describe("bandForItems", () => {
  it("항목 3개(최소)는 기본 밴드 그대로", () => {
    expect(bandForItems(3)).toBe(DEFAULT_BAND_INFO);
  });
  it("항목 4개는 0.25로 줄인다", () => {
    expect(bandForItems(4)).toBe(0.25);
  });
  it("항목 5개는 compact 타이포 덕에 0.25로 들어간다", () => {
    expect(bandForItems(5)).toBe(0.25);
  });
  it("항목 6개(최대)는 하한 0.15", () => {
    expect(bandForItems(6)).toBe(0.15);
  });
});

describe("밴드 자동 갱신", () => {
  it("SET_SPEC이 항목 수에 맞춰 밴드를 갱신한다", () => {
    const s = infoReducer(withPhotos(1), { type: "SET_SPEC", spec: spec5 });
    expect(s.band).toBe(bandForItems(5));
  });

  it("SET_BAND으로 직접 조정한 뒤에는 SET_SPEC도 밴드를 덮어쓰지 않는다", () => {
    const touched = infoReducer(withPhotos(1), { type: "SET_BAND", band: 0.2 });
    const s = infoReducer(touched, { type: "SET_SPEC", spec: spec5 });
    expect(s.band).toBe(0.2);
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

describe("카피 생성 전(spec === null)", () => {
  it("항목 편집 액션들이 크래시 없이 무동작이다", () => {
    const base = initialInfoState;
    expect(infoReducer(base, { type: "ADD_ITEM" })).toBe(base);
    expect(infoReducer(base, { type: "REMOVE_ITEM", index: 0 })).toBe(base);
    expect(infoReducer(base, { type: "REORDER_ITEM", from: 0, to: 1 })).toBe(base);
    expect(infoReducer(base, { type: "UPDATE_ITEM", index: 0, patch: { desc: "x" } })).toBe(base);
    expect(infoReducer(base, { type: "UPDATE_SPEC", patch: { title: "x" } })).toBe(base);
  });
});

// 3화면(주제 → 만들기 → 내보내기)으로 바뀌면서 스텝이 0부터 시작한다 — 카드뉴스와 같다.
describe("3화면 IA", () => {
  it("주제에서 시작한다", () => {
    expect(initialInfoState.step).toBe(0);
  });

  it("주제가 비면 만들기로 못 간다", () => {
    expect(canLeaveInfoTopic(initialInfoState)).toBe(false);
    expect(canLeaveInfoTopic({ ...initialInfoState, keyword: "   " })).toBe(false);
  });

  it("주제가 있으면 넘어간다", () => {
    expect(canLeaveInfoTopic({ ...initialInfoState, keyword: "여름 전기세" })).toBe(true);
  });

  it("카피가 없으면 내보내기로 못 간다", () => {
    expect(canLeaveInfoWorkbench(initialInfoState)).toBe(false);
  });

  it("카피가 있으면 내보내기로 간다", () => {
    const s = infoReducer({ ...initialInfoState, keyword: "여름 전기세" }, { type: "SET_SPEC", spec });
    expect(canLeaveInfoWorkbench(s)).toBe(true);
  });
});

/**
 * 정보전달에는 '헤드라인'이 없다 — 제목과 항목 키워드가 그 자리다. `defaultCaption` 은
 * 줄 목록만 받으므로, 그 목록을 만드는 것이 이 함수다. **없는 말을 지어내지 않는다** —
 * 카드에 이미 있는 글만 쓴다.
 */
describe("captionSourceLines", () => {
  const withSpec = infoReducer(initialInfoState, { type: "SET_SPEC", spec });

  it("제목을 첫 줄로, 항목 키워드를 뒤에 놓는다", () => {
    expect(captionSourceLines(withSpec)).toEqual(["에어컨 전기세", "온도", "필터", "선풍기"]);
  });

  it("카피가 없으면 빈 목록이다 — 주제만으로 캡션이 만들어진다", () => {
    expect(captionSourceLines(initialInfoState)).toEqual([]);
  });

  it("빈 제목·빈 키워드는 넣지 않는다", () => {
    const blanked = infoReducer(withSpec, { type: "UPDATE_SPEC", patch: { title: "  " } });
    const lines = captionSourceLines(infoReducer(blanked, { type: "UPDATE_ITEM", index: 0, patch: { keyword: "" } }));
    expect(lines).toEqual(["필터", "선풍기"]);
  });
});

/**
 * 오류가 났다는 사실과 일이 도는 중이라는 사실은 **별개**다. 함께 풀면 두 가지가 깨진다:
 * 생성을 시작하며 `SET_ERROR(null)` 로 옛 오류를 지우는 순간 바쁨 표시가 꺼지고(실제로
 * 그랬다 — '카피 쓰는 중'이 한 번도 안 보였다), 생성 대기 중 Dropzone 오류 한 번에 버튼이
 * 되살아나 CLI 호출이 둘 동시에 돈다. 카드뉴스 reducer 는 같은 이유로 이미 이렇게 돼 있다.
 */
describe("SET_ERROR 와 busy", () => {
  const busy = infoReducer(initialInfoState, { type: "SET_BUSY", busy: true });

  it("오류를 지워도 하던 일은 계속 돈다", () => {
    expect(infoReducer(busy, { type: "SET_ERROR", error: null }).busy).toBe(true);
  });

  it("오류가 나도 busy 를 마음대로 끄지 않는다 — 끝내는 건 SET_BUSY 몫이다", () => {
    expect(infoReducer(busy, { type: "SET_ERROR", error: "실패했어요" }).busy).toBe(true);
  });

  it("오류 문구는 그대로 담는다", () => {
    expect(infoReducer(busy, { type: "SET_ERROR", error: "실패했어요" }).error).toBe("실패했어요");
  });
});

/**
 * `withItems` 는 항목 배열을 갈아 끼울 때 타입을 한 번 좁힌다 — "더하거나 빼거나 옮길 뿐
 * 모양은 안 바꾼다" 는 불변식을 타입 시스템이 못 보기 때문이다. **그 불변식을 여기서 잠근다.**
 * 깨지면 스키마 검증에서 걸리므로, 다섯 형식 모두 다시 검증해 확인한다.
 */
describe("항목을 고쳐도 형식이 섞이지 않는다", () => {
  const specs = {
    list: { type: "informationsend" as const, format: "list" as const, title: "제목",
      items: [{ keyword: "가", desc: "나" }, { keyword: "다", desc: "라" }, { keyword: "마", desc: "바" }] },
    compare: { type: "informationsend" as const, format: "compare" as const, title: "제목",
      columns: { left: "A", right: "B" },
      items: [{ label: "기준", left: "왼", right: "오" }, { label: "기준2", left: "왼", right: "오" }, { label: "기준3", left: "왼", right: "오" }] },
    stat: { type: "informationsend" as const, format: "stat" as const, title: "제목",
      items: [{ value: "7%", label: "설명" }, { value: "2주", label: "설명" }] },
    check: { type: "informationsend" as const, format: "check" as const, title: "제목",
      items: [{ text: "하나" }, { text: "둘" }, { text: "셋" }, { text: "넷" }] },
  };

  for (const [name, spec] of Object.entries(specs)) {
    it(`${name}: 순서를 바꿔도 스키마를 통과한다`, () => {
      const seeded = infoReducer(initialInfoState, { type: "SET_SPEC", spec });
      const moved = infoReducer(seeded, { type: "REORDER_ITEM", from: 0, to: 1 });
      expect(InfographicSpec.safeParse(moved.spec).success).toBe(true);
    });
  }
});

/**
 * 형식은 **카피를 만들기 전에** 고른다. 고른 값은 생성 요청에 실려 가고, 카피가 이미 있으면
 * 형식을 바꿀 때 그 항목들을 그 형식의 빈 항목으로 갈아 끼운다 — 칸이 달라 그대로 못 옮긴다.
 */
describe("SET_FORMAT", () => {
  it("처음에는 목록형이다", () => {
    expect(initialInfoState.format).toBe("list");
  });

  it("카피가 없으면 형식만 바뀐다", () => {
    const s = infoReducer(initialInfoState, { type: "SET_FORMAT", format: "stat" });
    expect(s.format).toBe("stat");
    expect(s.spec).toBeNull();
  });

  // **빈 항목은 스키마를 통과하지 않는다**(각 칸이 min(1)). 그게 맞다 — 스키마는 생성
  // 결과를 재는 자다. 형식을 바꾼 직후는 "아직 안 채운 상태" 이고, 점검 목록이 그걸 짚는다.
  it("카피가 있으면 그 형식의 빈 항목으로 갈아 끼운다", () => {
    const seeded = infoReducer(initialInfoState, { type: "SET_SPEC", spec });
    const changed = infoReducer(seeded, { type: "SET_FORMAT", format: "check" });

    expect(changed.format).toBe("check");
    expect(changed.spec?.format).toBe("check");
    expect(changed.spec?.items).toEqual([{ text: "" }, { text: "" }, { text: "" }, { text: "" }]);
  });

  it("바꾼 직후에는 점검이 빈 항목을 짚는다 — 채우거나 다시 만들라는 뜻이다", () => {
    const seeded = infoReducer(initialInfoState, { type: "SET_SPEC", spec });
    const changed = infoReducer(seeded, { type: "SET_FORMAT", format: "check" });
    expect(infoChecks(changed).some((c) => c.text.includes("빈 항목"))).toBe(true);
  });

  it("제목·부제·팁은 남긴다 — 형식이 달라도 그 글은 그대로 쓸 수 있다", () => {
    const seeded = infoReducer(initialInfoState, { type: "SET_SPEC", spec });
    const changed = infoReducer(seeded, { type: "SET_FORMAT", format: "compare" });
    expect(changed.spec?.title).toBe(spec.title);
  });

  it("같은 형식을 다시 고르면 항목을 건드리지 않는다", () => {
    const seeded = infoReducer(initialInfoState, { type: "SET_SPEC", spec });
    const same = infoReducer(seeded, { type: "SET_FORMAT", format: "list" });
    expect(same.spec?.items).toEqual(seeded.spec?.items);
  });
});

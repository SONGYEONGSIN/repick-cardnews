import { itemTexts, type InfoItem, type InfographicSpec } from "@/lib/schema";
import type { Photo } from "@/lib/photos";
import { move } from "@/lib/reorder";
import { DEFAULT_BAND_INFO, DEFAULT_FOCAL, type Focal } from "@/templates/layout-utils";
import type { ThemeId } from "@/templates/themes";
import { DEFAULT_FIT, clampFit, type Fit } from "@/templates/fit";

export const ITEMS_MIN = 3;
export const ITEMS_MAX = 6;

type Item = InfographicSpec["items"][number];

export type InfoState = {
  step: number;
  photos: Photo[];
  selectedPhotoId: string | null;
  keyword: string;
  themeId: ThemeId;
  handle: string;
  band: number;
  /** 사용자가 SET_BAND로 직접 조정했는지. true면 항목 수가 바뀌어도 자동 재계산하지 않는다. */
  bandTouched: boolean;
  focal: Focal;
  /** 카드 안 글자 크기·간격·여백 배수(`@/templates/fit`). */
  fit: Fit;
  spec: InfographicSpec | null;
  error: string | null;
  busy: boolean;
};

export type InfoAction =
  | { type: "ADD_PHOTOS"; photos: Photo[] }
  | { type: "SELECT_PHOTO"; photoId: string }
  | { type: "SET_KEYWORD"; keyword: string }
  | { type: "SET_THEME"; themeId: ThemeId }
  | { type: "SET_HANDLE"; handle: string }
  | { type: "SET_BAND"; band: number }
  | { type: "SET_FOCAL"; focal: Focal }
  | { type: "SET_FIT"; patch: Partial<Fit> }
  | { type: "SET_SPEC"; spec: InfographicSpec }
  | { type: "UPDATE_SPEC"; patch: Partial<Pick<InfographicSpec, "title" | "subtitle" | "tip">> }
  | { type: "UPDATE_ITEM"; index: number; patch: Partial<Item> }
  | { type: "ADD_ITEM" }
  | { type: "REMOVE_ITEM"; index: number }
  | { type: "REORDER_ITEM"; from: number; to: number }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_BUSY"; busy: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

export const initialInfoState: InfoState = {
  step: 0,
  photos: [],
  selectedPhotoId: null,
  keyword: "",
  themeId: "mint-clean",
  handle: "",
  band: DEFAULT_BAND_INFO,
  bandTouched: false,
  focal: DEFAULT_FOCAL,
  fit: DEFAULT_FIT,
  spec: null,
  error: null,
  busy: false,
};

export function selectedPhoto(state: InfoState): Photo | null {
  return state.photos.find((p) => p.id === state.selectedPhotoId) ?? null;
}

/**
 * 3화면(주제 → 만들기 → 내보내기)의 문지기. 카드뉴스의 `canLeaveTopic`·`canLeaveWorkbench` 와
 * 같은 자리다 — 두 형식이 같은 흐름을 쓰므로 판정도 같은 모양으로 둔다.
 */
export function canLeaveInfoTopic(state: InfoState): boolean {
  return state.keyword.trim().length > 0;
}

/**
 * 캡션 초안의 재료 — 제목과 항목 키워드를 순서대로 준다. 카드뉴스는 헤드라인 목록을 그대로
 * 쓰지만(`defaultCaption(keyword, headings)`) 정보전달엔 헤드라인이 없어 이 자리를 만든다.
 *
 * **카드에 있는 글만 쓴다** — 빈 값은 빼고, 없는 말은 지어내지 않는다.
 */
export function captionSourceLines(state: InfoState): string[] {
  if (!state.spec) return [];
  return [state.spec.title, ...state.spec.items.map((item) => itemTexts(item)[0])]
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** 카피가 있어야 내보낼 게 생긴다. 사진은 선택이라 여기서 보지 않는다. */
export function canLeaveInfoWorkbench(state: InfoState): boolean {
  return state.spec !== null;
}

/**
 * 항목 수에 맞춰 사진 밴드를 정한다. InfographicBody가 항목 5개부터 compact 타이포(CardRenderer가
 * `items.length >= 5`로 켠다)로 줄어드는 것까지 반영한 재계산이다(task-17-report.md 수정 보고 참조).
 * 판정 기준은 하드 클리핑(프레임 밖 잘림) 유무 — SplitPhotoCard의 justifyContent:center가 콘텐츠를
 * 패딩(72+96=168px) 쪽으로 먼저 밀어내므로, 텍스트 영역 전체 높이 `1350*(1-band)`(패딩 포함)까지가
 * 실질 여유다. 그 값을 넘겨야 비로소 CardFrame의 overflow:hidden에 실제로 잘린다.
 * 항목당(키워드 1줄+설명 2줄) + 고정 오버헤드(제목 2줄+부제 1줄+팁 1줄)로 계산하면:
 * 3개 789px(밴드 0.35=기본값의 878px 안에 여유 89px로 들어감, 별도 축소 불필요) /
 * 4개(기본 타이포) 944px(밴드 0.25의 1013px 안에 여유 69px) /
 * 5개(compact 타이포) 916px(밴드 0.25의 1013px 안에 여유 96px) /
 * 6개(compact 타이포) 1047px(밴드 하한 0.15의 1148px 안에 여유 101px).
 * 사진이 의미 있게 보이는 하한은 0.15로 잡는다 — 그 아래면 사진이 아니라 띠 수준이라 넣는 의미가 없다.
 */
export function bandForItems(count: number): number {
  if (count <= ITEMS_MIN) return DEFAULT_BAND_INFO;
  if (count <= 5) return 0.25;
  return 0.15;
}

/**
 * 항목 배열을 갈아 끼운다. 형식마다 항목 모양이 다르지만 **배열 이름이 `items` 로 같아서**
 * 이 한 함수로 다섯 형식을 다 다룬다(`@/lib/schema` 설계 주석 참고).
 *
 * 스펙 자체의 items 타입을 그대로 쓰므로 형식이 섞이지 않는다 — 목록형 스펙에 비교형 항목을
 * 넣는 일은 타입이 막는다.
 */
function withItems(state: InfoState, next: InfoItem[]): InfoState {
  if (!state.spec) return state;
  // 항목을 **더하거나 빼거나 옮길 뿐** 모양은 바꾸지 않는다 — 그래서 배열 원소는 언제나 이
  // 스펙 형식의 항목이다. 타입 시스템은 그 불변식을 못 보므로 여기 한 곳에서만 좁힌다.
  // 불변식 자체는 `reducer.test.ts` 의 "형식이 섞이지 않는다" 가 다섯 형식으로 잠근다.
  return { ...state, spec: { ...state.spec, items: next } as InfographicSpec };
}

/** bandTouched가 아니면 항목 수에 맞춰 밴드를 다시 계산하고, 아니면 기존 값을 유지한다. */
function nextBand(state: InfoState, itemCount: number): Pick<InfoState, "band" | "bandTouched"> {
  if (state.bandTouched) return { band: state.band, bandTouched: state.bandTouched };
  return { band: bandForItems(itemCount), bandTouched: false };
}

export function infoReducer(state: InfoState, action: InfoAction): InfoState {
  switch (action.type) {
    case "ADD_PHOTOS": {
      const known = new Set(state.photos.map((p) => p.id));
      const added = action.photos.filter((p) => !known.has(p.id));
      const photos = [...state.photos, ...added];
      return {
        ...state,
        photos,
        selectedPhotoId: state.selectedPhotoId ?? photos[0]?.id ?? null,
        error: null,
      };
    }
    case "SELECT_PHOTO":
      return { ...state, selectedPhotoId: action.photoId };
    case "SET_KEYWORD":
      return { ...state, keyword: action.keyword };
    case "SET_THEME":
      return { ...state, themeId: action.themeId };
    case "SET_HANDLE":
      return { ...state, handle: action.handle };
    case "SET_BAND":
      return { ...state, band: action.band, bandTouched: true };
    case "SET_FOCAL":
      return { ...state, focal: action.focal };
    case "SET_SPEC":
      return { ...state, spec: action.spec, ...nextBand(state, action.spec.items.length), error: null };
    case "UPDATE_SPEC":
      return state.spec ? { ...state, spec: { ...state.spec, ...action.patch } } : state;
    case "UPDATE_ITEM":
      return state.spec
        ? withItems(
            state,
            state.spec.items.map((it, i) => (i === action.index ? { ...it, ...action.patch } : it)),
          )
        : state;
    case "ADD_ITEM": {
      if (!state.spec || state.spec.items.length >= ITEMS_MAX) return state;
      const items = [...state.spec.items, { keyword: "새 항목", desc: "설명을 적어 주세요" }];
      return { ...withItems(state, items), ...nextBand(state, items.length) };
    }
    case "REMOVE_ITEM": {
      if (!state.spec || state.spec.items.length <= ITEMS_MIN) return state;
      const items = state.spec.items.filter((_, i) => i !== action.index);
      return { ...withItems(state, items), ...nextBand(state, items.length) };
    }
    case "REORDER_ITEM":
      // `move` 는 제네릭이라 형식별 배열을 그대로 받는다 — union 으로 넓힌 뒤 넘긴다.
      return state.spec ? withItems(state, move<InfoItem>(state.spec.items, action.from, action.to)) : state;
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_FIT":
      // 범위 밖 값은 잘라서 넣는다 — 손잡이가 아닌 곳에서 들어와도 카드가 안 깨진다.
      return { ...state, fit: clampFit({ ...state.fit, ...action.patch }) };
    case "SET_BUSY":
      return { ...state, busy: action.busy };
    case "SET_ERROR":
      // busy 는 건드리지 않는다. 오류가 났다는 사실과 일이 도는 중이라는 사실은 별개다 —
      // 함께 풀면 생성 시작 때 옛 오류를 지우는 SET_ERROR(null) 이 바쁨 표시를 즉시 꺼버리고
      // ('카피 쓰는 중'이 한 번도 안 보였다), 대기 중 Dropzone 오류 한 번에 버튼이 되살아난다.
      return { ...state, error: action.error };
    case "RESET":
      return initialInfoState;
  }
}

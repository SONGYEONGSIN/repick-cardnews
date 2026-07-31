import type { InfographicSpec } from "@/lib/schema";
import type { Photo } from "@/lib/photos";
import { move } from "@/lib/reorder";
import { DEFAULT_BAND_INFO, DEFAULT_FOCAL, type Focal } from "@/templates/layout-utils";
import type { ThemeId } from "@/templates/themes";

export const ITEMS_MIN = 3;
export const ITEMS_MAX = 6;

type Item = InfographicSpec["items"][number];

export type InfoState = {
  step: number;
  maxReached: number;
  photos: Photo[];
  selectedPhotoId: string | null;
  keyword: string;
  themeId: ThemeId;
  handle: string;
  band: number;
  /** 사용자가 SET_BAND로 직접 조정했는지. true면 항목 수가 바뀌어도 자동 재계산하지 않는다. */
  bandTouched: boolean;
  focal: Focal;
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
  step: 1,
  maxReached: 1,
  photos: [],
  selectedPhotoId: null,
  keyword: "",
  themeId: "mint-clean",
  handle: "",
  band: DEFAULT_BAND_INFO,
  bandTouched: false,
  focal: DEFAULT_FOCAL,
  spec: null,
  error: null,
  busy: false,
};

export function selectedPhoto(state: InfoState): Photo | null {
  return state.photos.find((p) => p.id === state.selectedPhotoId) ?? null;
}

export function canLeavePhoto(state: InfoState): boolean {
  return selectedPhoto(state) !== null;
}

/**
 * 항목 수에 맞춰 사진 밴드를 정한다. InfographicBody 실측값(제목 66px·부제 32px·키워드 34px·
 * 설명 27px/줄간격1.45·팁 27px, SplitPhotoCard 세로 패딩 72+96=168px)으로 계산한 "현실적 보수치"
 * 기준: 고정 오버헤드(제목 2줄+부제 1줄+팁 1줄 ≈ 317px) + 항목당(키워드 1줄+설명 2줄 ≈ 133px)일 때
 * 3개 789px(밴드 0.25의 가용 844px 안에 들어감) / 4개 944px(밴드 0.15의 가용 979px에 근소하게
 * 들어감) / 5개 1099px·6개 1254px 는 밴드를 하한(0.15)까지 낮춰도 모자란다 — 그 이상은 밴드만으로
 * 못 고치고 타이포 축소가 별도로 필요하다(task-17-report.md 참조). 사진이 의미 있게 보이는 하한은
 * 0.15로 잡는다 — 그 아래면 사진이 아니라 띠 수준이라 넣는 의미가 없다.
 */
export function bandForItems(count: number): number {
  return count <= ITEMS_MIN ? 0.25 : 0.15;
}

function withItems(state: InfoState, next: Item[]): InfoState {
  if (!state.spec) return state;
  return { ...state, spec: { ...state.spec, items: next } };
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
      return state.spec ? withItems(state, move(state.spec.items, action.from, action.to)) : state;
    case "SET_STEP":
      return { ...state, step: action.step, maxReached: Math.max(state.maxReached, action.step) };
    case "SET_BUSY":
      return { ...state, busy: action.busy };
    case "SET_ERROR":
      return { ...state, error: action.error, busy: false };
    case "RESET":
      return initialInfoState;
  }
}

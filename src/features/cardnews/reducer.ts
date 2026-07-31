import type { CardnewsCard, CardnewsSpec } from "@/lib/schema";
import type { Photo } from "@/lib/photos";
import { move } from "@/lib/reorder";
import { assignLayouts, type CardLayout } from "@/lib/layout-assign";
import { DEFAULT_BAND_CARDNEWS, DEFAULT_FOCAL, DEFAULT_SCRIM, type Focal } from "@/templates/layout-utils";
import type { ThemeId } from "@/templates/themes";

export const CARDNEWS_MIN = 5;
export const CARDNEWS_MAX = 6;

export type CardDraft = {
  id: string;
  photoId: string;
  layout: CardLayout;
  focal: Focal;
  scrim: number;
  band: number;
  copy: CardnewsCard;
};

export type CardnewsState = {
  step: number;
  maxReached: number;
  photos: Photo[];
  /** 슬롯에 든 photoId — 순서 그 자체 */
  order: string[];
  keyword: string;
  themeId: ThemeId;
  handle: string;
  cards: CardDraft[];
  error: string | null;
  busy: boolean;
};

export type CardnewsAction =
  | { type: "ADD_PHOTOS"; photos: Photo[] }
  | { type: "REMOVE_PHOTO"; photoId: string }
  | { type: "REORDER"; from: number; to: number }
  | { type: "SWAP_IN"; slotIndex: number; photoId: string }
  | { type: "SET_KEYWORD"; keyword: string }
  | { type: "SET_THEME"; themeId: ThemeId }
  | { type: "SET_HANDLE"; handle: string }
  | { type: "SET_SPEC"; spec: CardnewsSpec }
  | { type: "UPDATE_CARD"; index: number; patch: Partial<Omit<CardDraft, "id">> }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_BUSY"; busy: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

export const initialCardnewsState: CardnewsState = {
  step: 1,
  maxReached: 1,
  photos: [],
  order: [],
  keyword: "",
  themeId: "mint-clean",
  handle: "",
  cards: [],
  error: null,
  busy: false,
};

export function slotPhotos(state: CardnewsState): Photo[] {
  return state.order
    .map((id) => state.photos.find((p) => p.id === id))
    .filter((p): p is Photo => p !== undefined);
}

export function trayPhotos(state: CardnewsState): Photo[] {
  return state.photos.filter((p) => !state.order.includes(p.id));
}

export function canLeaveOrder(state: CardnewsState): boolean {
  return state.order.length >= CARDNEWS_MIN && state.order.length <= CARDNEWS_MAX;
}

/**
 * 단계가 많은 solution 카드는 글이 길어 기본 밴드(0.45)로도 글 영역이 모자란다.
 * 스키마 상한(헤드라인 40자·본문 120자·단계 5개)에 word-break:keep-all 이 겹치면 784px 이 필요한데
 * 0.45 의 가용 높이는 574px 이라 잘린다. 사진을 줄여 자리를 만든다 — 0.3 이면 가용 777px.
 */
export function bandFor(copy: CardnewsCard): number {
  const steps = "steps" in copy ? (copy.steps?.length ?? 0) : 0;
  return steps >= 4 ? 0.3 : DEFAULT_BAND_CARDNEWS;
}

export function cardnewsReducer(state: CardnewsState, action: CardnewsAction): CardnewsState {
  switch (action.type) {
    case "ADD_PHOTOS": {
      const known = new Set(state.photos.map((p) => p.id));
      const added = action.photos.filter((p) => !known.has(p.id));
      const photos = [...state.photos, ...added];
      const room = CARDNEWS_MAX - state.order.length;
      const order = [...state.order, ...added.slice(0, Math.max(0, room)).map((p) => p.id)];
      return { ...state, photos, order, error: null };
    }
    case "REMOVE_PHOTO":
      return {
        ...state,
        photos: state.photos.filter((p) => p.id !== action.photoId),
        order: state.order.filter((id) => id !== action.photoId),
      };
    case "REORDER":
      return { ...state, order: move(state.order, action.from, action.to) };
    case "SWAP_IN": {
      if (state.order.includes(action.photoId)) return state;
      if (action.slotIndex < 0 || action.slotIndex >= state.order.length) return state;
      const order = [...state.order];
      order[action.slotIndex] = action.photoId;
      return { ...state, order };
    }
    case "SET_KEYWORD":
      return { ...state, keyword: action.keyword };
    case "SET_THEME":
      return { ...state, themeId: action.themeId };
    case "SET_HANDLE":
      return { ...state, handle: action.handle };
    case "SET_SPEC": {
      const layouts = assignLayouts(action.spec.cards.length);
      const cards: CardDraft[] = action.spec.cards.map((copy, i) => ({
        id: `card-${i + 1}`,
        // 사진보다 카드가 많으면(사진 5장 + 카드 6장은 스키마상 가능) 남는 카드는 사진 없이 둔다.
        // 마지막 사진을 재사용하면 같은 사진이 두 카드에 나온다 — 마지막 카드는 어차피 text-only 다.
        photoId: state.order[i] ?? "",
        layout: layouts[i],
        focal: DEFAULT_FOCAL,
        scrim: DEFAULT_SCRIM,
        band: bandFor(copy),
        copy,
      }));
      return { ...state, cards, error: null };
    }
    case "UPDATE_CARD":
      return {
        ...state,
        cards: state.cards.map((c, i) => (i === action.index ? { ...c, ...action.patch } : c)),
      };
    case "SET_STEP":
      return { ...state, step: action.step, maxReached: Math.max(state.maxReached, action.step) };
    case "SET_BUSY":
      return { ...state, busy: action.busy };
    case "SET_ERROR":
      return { ...state, error: action.error, busy: false };
    case "RESET":
      return initialCardnewsState;
  }
}

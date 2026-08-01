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
  step: 0,
  maxReached: 0,
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

/** 주제 화면 → 만들기 화면. 키워드 없이는 카피를 만들 수 없다. */
export function canLeaveTopic(state: CardnewsState): boolean {
  return state.keyword.trim().length > 0;
}

/**
 * 만들기 화면 → 내보내기 화면.
 *
 * 사진 장수와 카피 생성 여부를 **둘 다** 본다. 예전에는 두 단계로 나뉘어 각각 걸렸지만
 * 한 화면으로 합쳐졌으므로 한 곳에서 판정한다.
 */
export function canLeaveWorkbench(state: CardnewsState): boolean {
  return canLeaveOrder(state) && state.cards.length > 0;
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

/**
 * 카드의 사진 연결을 `order` 에 다시 맞춘다 — 불변식은 `cards[i].photoId === (order[i] ?? "")` 다.
 *
 * `SET_SPEC` 이 이 식으로 연결을 세우고, 캔버스도 출력(`toRenderCards`)도 `card.photoId` 로 사진을
 * 찾는다. 그래서 `order` 를 건드리는 액션은 전부 이 함수를 통과해야 한다 — 안 그러면 순서 레일은
 * 새 사진을, 카드와 저장 결과는 옛 사진을 가리킨다. 액션마다 화면에서 보정하면 같은 땜질이 세 군데
 * 생기므로 여기서 한 번만 한다.
 *
 * 사진보다 카드가 많으면 남는 카드는 `""` 로 남는다 — `SET_SPEC` 과 같은 규칙(사진 없는 카드)이다.
 * 카피 생성 전에는 `cards` 가 비어 있어 아무 일도 하지 않는다.
 */
function relinkPhotos(state: CardnewsState): CardnewsState {
  if (state.cards.length === 0) return state;
  return {
    ...state,
    cards: state.cards.map((card, i) => {
      const photoId = state.order[i] ?? "";
      // 안 바뀐 카드는 같은 객체로 둔다 — 사진 하나 옮겼다고 다섯 장이 전부 다시 그려지지 않게
      return card.photoId === photoId ? card : { ...card, photoId };
    }),
  };
}

export function cardnewsReducer(state: CardnewsState, action: CardnewsAction): CardnewsState {
  switch (action.type) {
    case "ADD_PHOTOS": {
      const known = new Set(state.photos.map((p) => p.id));
      const added = action.photos.filter((p) => !known.has(p.id));
      const photos = [...state.photos, ...added];
      const room = CARDNEWS_MAX - state.order.length;
      const order = [...state.order, ...added.slice(0, Math.max(0, room)).map((p) => p.id)];
      return relinkPhotos({ ...state, photos, order, error: null });
    }
    case "REMOVE_PHOTO": {
      const photos = state.photos.filter((p) => p.id !== action.photoId);
      const kept = state.order.filter((id) => id !== action.photoId);
      // 슬롯에서 뺀 자리는 트레이의 첫 사진으로 메운다.
      // 사용자는 이 사진을 빼 달라고 했을 뿐 최소 장수에 못 미쳐 갇히겠다고 한 게 아니다 —
      // order 는 이 액션 말고는 줄어들 길이 없고(SWAP_IN 은 1:1, ADD_PHOTOS 는 기존 id 를 건너뜀),
      // 트레이는 바로 이런 보충을 위해 존재한다.
      const backfill = kept.length < state.order.length ? photos.find((p) => !kept.includes(p.id)) : undefined;
      return relinkPhotos({ ...state, photos, order: backfill ? [...kept, backfill.id] : kept });
    }
    case "REORDER":
      return relinkPhotos({ ...state, order: move(state.order, action.from, action.to) });
    case "SWAP_IN": {
      if (state.order.includes(action.photoId)) return state;
      if (action.slotIndex < 0 || action.slotIndex >= state.order.length) return state;
      const order = [...state.order];
      order[action.slotIndex] = action.photoId;
      return relinkPhotos({ ...state, order });
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

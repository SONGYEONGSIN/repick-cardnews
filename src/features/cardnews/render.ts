import type { RenderCard } from "@/templates/CardRenderer";
import type { CardnewsState } from "./reducer";

/** 편집기 상태를 CardRenderer가 그릴 수 있는 카드 목록으로 변환한다. DOM을 만지지 않는 순수 함수. */
export function toRenderCards(state: CardnewsState): RenderCard[] {
  return state.cards.map((card, i) => ({
    layout: card.layout,
    photoUrl: state.photos.find((p) => p.id === card.photoId)?.dataUrl ?? null,
    focal: card.focal,
    scrim: card.scrim,
    band: card.band,
    textY: card.textY,
    textScale: card.textScale,
    textAlign: card.textAlign,
    badge: `${i + 1} / ${state.cards.length}`,
    copy: card.copy,
  }));
}

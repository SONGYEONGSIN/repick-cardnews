import type { RenderCard } from "@/templates/CardRenderer";
import { DEFAULT_TEXT_ALIGN, DEFAULT_TEXT_SCALE } from "@/templates/layout-utils";
import { selectedPhoto, type InfoState } from "./reducer";

/** 편집기 상태를 CardRenderer가 그릴 수 있는 카드로 변환한다. DOM을 만지지 않는 순수 함수. */
export function toRenderCard(state: InfoState): RenderCard | null {
  if (!state.spec) return null;
  return {
    layout: "split",
    photoUrl: selectedPhoto(state)?.dataUrl ?? null,
    focal: state.focal,
    scrim: 0,
    band: state.band,
    // split 레이아웃(SplitPhotoCard)의 현재 justifyContent:center 와 같은 값 — RenderCard.textY 를
    // 필수 필드로 좁히는 대가로 채운 한 줄이며 동작은 바뀌지 않는다.
    textY: 0.5,
    // textScale·textAlign 은 CardnewsBody 전용이라 이 InfographicBody 경로에서는 안 쓰이지만,
    // RenderCard 필수 필드라 채운다 — 위 textY 주석과 같은 이유, 동작은 바뀌지 않는다.
    textScale: DEFAULT_TEXT_SCALE,
    textAlign: DEFAULT_TEXT_ALIGN,
    badge: "",
    copy: state.spec,
  };
}

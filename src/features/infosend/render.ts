import type { RenderCard } from "@/templates/CardRenderer";
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
    badge: "",
    copy: state.spec,
  };
}

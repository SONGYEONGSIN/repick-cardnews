"use client";

import { Plus } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import type { Photo } from "@/lib/photos";
import type { CardnewsCard } from "@/lib/schema";
import type { CardDraft } from "../reducer";

/**
 * 순서 레일 — 슬롯 / 구분선 / 안 쓴 사진 / 사진 추가.
 *
 * 왼쪽은 `state.order` 가 정한 차례고(= `slotPhotos`), 구분선 오른쪽은 아직 안 쓴 사진이다.
 * 안 쓴 사진을 누르면 지금 고른 자리에 갈아 끼운다(`SWAP_IN`).
 *
 * 자리 바꾸기(드래그)는 여기 **없다**. 이 화면이 받는 동작은 고르기와 갈아 끼우기뿐이라
 * 시안의 손잡이 아이콘도 함께 뺐다 — 안 되는 동작을 그려 두지 않는다.
 */

/** 카드 역할의 한국어 이름. 레일 칩과 편집 섹션 제목이 같은 말을 써야 해서 여기서 함께 export 한다. */
export const ROLE_LABELS: Record<CardnewsCard["role"], string> = {
  hook: "후크",
  problem: "문제",
  evidence: "근거",
  solution: "해법",
  cta: "행동",
};

/** 레일의 한 칸. 카피 생성 전에는 카드가 없으므로 역할 대신 파일 이름을 보여 준다. */
function SlotChip({
  photo,
  index,
  card,
  on,
  onPick,
}: {
  photo: Photo;
  index: number;
  card: CardDraft | undefined;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      className={`flex w-[152px] flex-none flex-col gap-2.5 rounded-xl border-2 p-2.5 text-left transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
        on ? "border-ink" : "border-transparent hover:border-hair"
      }`}
    >
      <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-hair-soft">
        {/* 로컬 dataURL 프리뷰 — next/image 는 이 URL 을 최적화할 수 없다. 버튼에 글이 있어 alt 는 빈다 */}
        <img src={photo.thumbUrl} alt="" className="h-full w-full object-cover" />
        <span className="absolute left-2 top-2 rounded bg-surface px-2 py-0.5 text-[13px] font-bold tabular-nums">
          {index + 1}
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[14px] font-bold">{card ? ROLE_LABELS[card.copy.role] : "사진"}</span>
        <span className="truncate text-[13px] text-ink-2">{card ? card.copy.heading : photo.name}</span>
      </span>
    </button>
  );
}

export function WorkbenchRail({
  slots,
  tray,
  cards,
  active,
  dropOpen,
  onPick,
  onSwapIn,
  onToggleDrop,
}: {
  slots: Photo[];
  tray: Photo[];
  cards: CardDraft[];
  active: number;
  dropOpen: boolean;
  onPick: (index: number) => void;
  onSwapIn: (photoId: string) => void;
  onToggleDrop: () => void;
}) {
  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2">
      {slots.map((photo, i) => (
        <SlotChip
          key={photo.id}
          photo={photo}
          index={i}
          // `.at()` 은 `CardDraft | undefined` — 카피 생성 전에는 반드시 undefined 다
          card={cards.at(i)}
          on={i === active}
          onPick={() => onPick(i)}
        />
      ))}

      {slots.length > 0 && <span className="mx-3 h-[232px] w-px flex-none bg-hair" aria-hidden="true" />}

      {tray.map((photo) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onSwapIn(photo.id)}
          aria-label={`${photo.name} 을 ${active + 1}번 자리에 넣기`}
          className={`flex w-[120px] flex-none flex-col gap-2 rounded-lg p-2.5 text-left transition-colors duration-200 hover:bg-hair-soft ${FOCUS_RING} motion-reduce:transition-none`}
        >
          <span className="block aspect-[4/5] w-full overflow-hidden rounded-lg bg-hair-soft">
            {/* 로컬 dataURL 프리뷰 — 버튼의 aria-label 이 이름을 읽으므로 alt 는 빈다 */}
            <img src={photo.thumbUrl} alt="" className="h-full w-full object-cover" />
          </span>
          <span className="truncate text-[13px] text-ink-2">{photo.name}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={onToggleDrop}
        aria-expanded={dropOpen}
        className={`m-2.5 flex aspect-[4/5] w-[120px] flex-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-hair text-ink-2 transition-colors duration-200 hover:border-ink hover:text-ink ${FOCUS_RING} motion-reduce:transition-none`}
      >
        <Plus size={20} aria-hidden="true" />
        <span className="text-[13px] font-bold">사진 추가</span>
      </button>
    </div>
  );
}

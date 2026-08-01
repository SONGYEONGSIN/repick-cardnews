"use client";

import { ChevronLeft, ChevronRight, ImageOff, Plus, Trash2 } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import type { Photo } from "@/lib/photos";
import type { CardnewsCard } from "@/lib/schema";
import type { CardDraft } from "../reducer";

/**
 * 순서 레일 — 슬롯 / 구분선 / 안 쓴 사진 / 사진 추가.
 *
 * 칩의 기준이 두 가지다. **카피 생성 전에는 사진 슬롯**(`order`), **생성 후에는 카드**다.
 * 카드가 사진보다 많을 수 있어서(스키마상 5~6장이고 `SET_SPEC` 이 남는 카드를 `photoId: ""`
 * 로 둔다) 사진 기준으로만 그리면 마지막 카드에 닿을 방법이 없다 — 칩 하나 = 카드 하나여야
 * 모든 카드의 글을 고칠 수 있다.
 *
 * 순서 바꾸기는 드래그가 아니라 **버튼**이다. 칩이 5~6개뿐이라 버튼으로 충분하고 드래그
 * 전용은 키보드 사용자를 막는다. 화살표는 사진 차례(`REORDER`)만 바꾼다 — 카피는 자리에
 * 남고, reducer 가 `cards[i].photoId` 를 새 `order` 에 다시 맞춘다.
 */

/** 칩 하나가 가리키는 것. 카피 생성 전에는 카드가 없고, 사진이 모자란 카드에는 사진이 없다. */
export type RailItem = { key: string; photo: Photo | undefined; card: CardDraft | undefined };

/** 카드 역할의 한국어 이름. 레일 칩과 편집 섹션 제목이 같은 말을 써야 해서 여기서 함께 export 한다. */
export const ROLE_LABELS: Record<CardnewsCard["role"], string> = {
  hook: "후크",
  problem: "문제",
  evidence: "근거",
  solution: "해법",
  cta: "행동",
};

/** 고른 칩 아래 줄에 붙는 조작 버튼. 폭이 152px 이라 아이콘만 두고 이름은 aria-label 로 준다. */
function ChipAction({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-hair text-ink-2 transition-colors duration-200 hover:border-ink hover:text-ink disabled:text-ink-disabled disabled:hover:border-hair ${FOCUS_RING} motion-reduce:transition-none`}
    >
      {children}
    </button>
  );
}

/**
 * 레일의 한 칸. 조작 버튼은 **고른 칩에만** 붙는다 — 여섯 칸에 버튼을 늘 띄우면 지금 무엇을
 * 고쳤는지가 안 보인다. 버튼은 선택 버튼의 형제다(버튼 안에 버튼을 넣을 수 없다).
 */
function SlotChip({
  item,
  index,
  on,
  canBack,
  canForward,
  onPick,
  onMove,
  onRemove,
}: {
  item: RailItem;
  index: number;
  on: boolean;
  canBack: boolean;
  canForward: boolean;
  onPick: () => void;
  onMove: (to: number) => void;
  onRemove: (photoId: string) => void;
}) {
  // 지역 const 로 받아야 아래 클로저 안에서도 좁힌 타입이 유지된다(프로퍼티 접근은 유지되지 않는다)
  const photo = item.photo;
  const card = item.card;

  return (
    <div className="flex w-[152px] flex-none flex-col gap-2">
      <button
        type="button"
        onClick={onPick}
        aria-pressed={on}
        className={`flex flex-col gap-2.5 rounded-xl border-2 p-2.5 text-left transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
          on ? "border-ink" : "border-transparent hover:border-hair"
        }`}
      >
        <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-hair-soft">
          {photo ? (
            // 로컬 dataURL 프리뷰 — next/image 는 이 URL 을 최적화할 수 없다. 버튼에 글이 있어 alt 는 빈다
            <img src={photo.thumbUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-2">
              <ImageOff size={18} aria-hidden="true" />
              <span className="text-[13px]">사진 없음</span>
            </span>
          )}
          <span className="absolute left-2 top-2 rounded bg-surface px-2 py-0.5 text-[13px] font-bold tabular-nums">
            {index + 1}
          </span>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[14px] font-bold">{card ? ROLE_LABELS[card.copy.role] : "사진"}</span>
          <span className="truncate text-[13px] text-ink-2">{card ? card.copy.heading : (photo?.name ?? "")}</span>
        </span>
      </button>

      {on && (
        <div className="flex items-center gap-1.5 px-2.5">
          <ChipAction label={`${index + 1}번 사진을 앞으로`} disabled={!canBack} onClick={() => onMove(index - 1)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </ChipAction>
          <ChipAction label={`${index + 1}번 사진을 뒤로`} disabled={!canForward} onClick={() => onMove(index + 1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </ChipAction>
          {photo && (
            <ChipAction label={`${photo.name} 빼기`} onClick={() => onRemove(photo.id)}>
              <Trash2 size={15} aria-hidden="true" />
            </ChipAction>
          )}
        </div>
      )}
    </div>
  );
}

/** 안 쓴 사진. 넣기(`SWAP_IN`)와 빼기(`REMOVE_PHOTO`)를 둘 다 여기서 한다. */
function TrayItem({
  photo,
  slotLabel,
  canSwap,
  onSwapIn,
  onRemove,
}: {
  photo: Photo;
  slotLabel: string;
  canSwap: boolean;
  onSwapIn: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex w-[120px] flex-none flex-col gap-2 p-2.5">
      <button
        type="button"
        onClick={onSwapIn}
        disabled={!canSwap}
        aria-label={`${photo.name} 을 ${slotLabel} 자리에 넣기`}
        className={`flex flex-col gap-2 rounded-lg text-left transition-opacity duration-200 hover:opacity-80 disabled:opacity-50 ${FOCUS_RING} motion-reduce:transition-none`}
      >
        <span className="block aspect-[4/5] w-full overflow-hidden rounded-lg bg-hair-soft">
          {/* 로컬 dataURL 프리뷰 — 버튼의 aria-label 이 이름을 읽으므로 alt 는 빈다 */}
          <img src={photo.thumbUrl} alt="" className="h-full w-full object-cover" />
        </span>
        <span className="truncate text-[13px] text-ink-2">{photo.name}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${photo.name} 빼기`}
        className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border border-hair text-[13px] font-bold text-ink-2 transition-colors duration-200 hover:border-ink hover:text-ink ${FOCUS_RING} motion-reduce:transition-none`}
      >
        <Trash2 size={14} aria-hidden="true" />
        빼기
      </button>
    </div>
  );
}

export function WorkbenchRail({
  items,
  tray,
  active,
  orderCount,
  dropOpen,
  onPick,
  onMove,
  onRemove,
  onSwapIn,
  onToggleDrop,
}: {
  items: RailItem[];
  tray: Photo[];
  active: number;
  /** 사진이 든 자리 수(`state.order.length`) — 그 밖의 칩(사진 없는 카드)은 옮길 자리가 없다 */
  orderCount: number;
  dropOpen: boolean;
  onPick: (index: number) => void;
  onMove: (to: number) => void;
  onRemove: (photoId: string) => void;
  onSwapIn: (photoId: string) => void;
  onToggleDrop: () => void;
}) {
  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2">
      {items.map((item, i) => (
        <SlotChip
          key={item.key}
          item={item}
          index={i}
          on={i === active}
          canBack={i > 0 && i < orderCount}
          canForward={i + 1 < orderCount}
          onPick={() => onPick(i)}
          onMove={onMove}
          onRemove={onRemove}
        />
      ))}

      {items.length > 0 && <span className="mx-3 h-[232px] w-px flex-none bg-hair" aria-hidden="true" />}

      {tray.map((photo) => (
        <TrayItem
          key={photo.id}
          photo={photo}
          slotLabel={`${active + 1}번`}
          canSwap={active < orderCount}
          onSwapIn={() => onSwapIn(photo.id)}
          onRemove={() => onRemove(photo.id)}
        />
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

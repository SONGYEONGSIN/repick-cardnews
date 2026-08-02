"use client";

import { ChevronDown, ChevronUp, ImageOff, Plus, Trash2 } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import type { Photo } from "@/lib/photos";
import type { CardnewsCard } from "@/lib/schema";
import type { CardDraft } from "../reducer";

/**
 * 순서 레일 — **세로 목록**이다. 슬롯(카드/사진) → 안 쓴 사진 → 사진 추가가 한 축으로 이어진다.
 *
 * 가로 칩 레일이던 것을 세로로 세웠다. 이유는 폭이다 — 가로 축을 고집하면 레일이 넓어야 하고,
 * 그만큼 오른쪽 카드가 좁아진다(`WorkbenchScreen` 의 그리드 주석 참고). 세로 목록은 폭이 좁아도
 * 되고, 왼쪽 칸 아래에 비던 세로 공간을 그대로 채운다.
 *
 * 칩의 기준이 두 가지다. **카피 생성 전에는 사진 슬롯**(`order`), **생성 후에는 카드**다.
 * 카드가 사진보다 많을 수 있어서(스키마상 5~6장이고 `SET_SPEC` 이 남는 카드를 `photoId: ""`
 * 로 둔다) 사진 기준으로만 그리면 마지막 카드에 닿을 방법이 없다 — 행 하나 = 카드 하나여야
 * 모든 카드의 글을 고칠 수 있다.
 *
 * 순서 바꾸기는 드래그가 아니라 **버튼**이다. 세로 목록이 되며 방향도 위/아래로 바뀐다 — 화면에
 * 보이는 방향과 "앞 카드 / 뒤 카드" 가 이제 같은 축을 가리킨다. 뜻은 그대로다: 위 화살표는 앞
 * 카드로, 아래 화살표는 뒤 카드로 사진을 옮긴다(`REORDER`). 카피는 자리에 남고, reducer 가
 * `cards[i].photoId` 를 새 `order` 에 다시 맞춘다.
 *
 * 슬롯 목록은 `<ol>` 이다 — 순서 자체가 뜻(넘겨 보는 차례)이다. 안 쓴 사진은 자리가 서로
 * 바뀌어도 뜻이 안 변하는 묶음이라 `<ul>` 로 나눈다. "사진 추가" 는 목록 항목이 아니라 목록 다음에
 * 오는 동작 버튼이다 — 셋을 가르던 세로 구분선(옛 가로 레일의 `h-px` 막대)은 없앴다.
 */

/** 칩 하나가 가리키는 것. 카피 생성 전에는 카드가 없고, 사진이 모자란 카드에는 사진이 없다. */
export type RailItem = { key: string; photo: Photo | undefined; card: CardDraft | undefined };

/** 카드 역할의 한국어 이름. 레일 행과 편집 섹션 제목이 같은 말을 써야 해서 여기서 함께 export 한다. */
export const ROLE_LABELS: Record<CardnewsCard["role"], string> = {
  hook: "후크",
  problem: "문제",
  evidence: "근거",
  solution: "해법",
  cta: "행동",
};

/** 고른 행 아래 줄에 붙는 조작 버튼. 이름은 aria-label 로 준다. */
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
 * 사진 빼기. 되돌리기가 없으므로(조각 2) **위/아래 화살표와 같은 줄에 두지 않는다** — 화살표는
 * 자주 누르고 빼기는 되돌릴 수 없어, 옆에 있으면 오폭이 실제로 난다. 아이콘만 두지 않고
 * "빼기"라고 쓴다.
 */
function RemoveButton({
  name,
  disabled = false,
  onClick,
}: {
  name: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${name} 빼기`}
      className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border border-hair px-3 text-[13px] font-bold text-ink-2 transition-colors duration-200 hover:border-ink hover:text-ink disabled:text-ink-disabled disabled:hover:border-hair ${FOCUS_RING} motion-reduce:transition-none`}
    >
      <Trash2 size={14} aria-hidden="true" />
      빼기
    </button>
  );
}

/** 목록 행 공통 썸네일 — 4:5, 폭 56px로 고정한다(가로 칩 120~152px보다 훨씬 좁다). */
function Thumb({ photo, index }: { photo: Photo | undefined; index?: number }) {
  return (
    <span className="relative block aspect-[4/5] w-14 flex-none overflow-hidden rounded-lg bg-hair-soft">
      {photo ? (
        // 로컬 dataURL 프리뷰 — next/image 는 이 URL 을 최적화할 수 없다. alt 는 옆 글이 대신한다
        <img src={photo.thumbUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-ink-2">
          <ImageOff size={14} aria-hidden="true" />
        </span>
      )}
      {index !== undefined && (
        <span className="absolute left-1 top-1 rounded bg-surface px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
          {index + 1}
        </span>
      )}
    </span>
  );
}

/**
 * 목록의 한 행 — 슬롯(카드/사진). 조작 버튼은 **고른 행에만** 붙는다 — 여섯 줄에 버튼을 늘 띄우면
 * 지금 무엇을 고쳤는지가 안 보인다.
 */
function SlotRow({
  item,
  index,
  on,
  canBack,
  canForward,
  locked,
  onPick,
  onMove,
  onRemove,
}: {
  item: RailItem;
  index: number;
  on: boolean;
  canBack: boolean;
  canForward: boolean;
  /** 카피 생성 중 — 사진을 바꾸면 응답이 다른 사진에 붙는다 */
  locked: boolean;
  onPick: () => void;
  onMove: (to: number) => void;
  onRemove: (photoId: string) => void;
}) {
  // 지역 const 로 받아야 아래 클로저 안에서도 좁힌 타입이 유지된다(프로퍼티 접근은 유지되지 않는다)
  const photo = item.photo;
  const card = item.card;

  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={on}
        className={`flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
          on ? "border-ink" : "border-transparent hover:border-hair"
        }`}
      >
        <Thumb photo={photo} index={index} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] font-bold">{card ? ROLE_LABELS[card.copy.role] : "사진"}</span>
          <span className="truncate text-[13px] text-ink-2">{card ? card.copy.heading : (photo?.name ?? "")}</span>
        </span>
      </button>

      {on && (
        <div className="flex flex-col gap-2 px-2.5 py-2">
          {/* 옮기는 것은 사진이지 카드가 아니다 — 이름에 그걸 담는다. 카피가 나오기 전에는
              카드가 없으므로 "카드" 대신 "자리"로 말한다. 화살표는 위/아래로 바뀌었지만
              뜻(앞 카드로/뒤 카드로 옮기기)은 그대로다. */}
          <div className="flex items-center gap-1.5">
            <ChipAction
              label={`${index + 1}번 사진을 ${card ? "앞 카드로" : "앞 자리로"} 옮기기`}
              disabled={locked || !canBack}
              onClick={() => onMove(index - 1)}
            >
              <ChevronUp size={16} aria-hidden="true" />
            </ChipAction>
            <ChipAction
              label={`${index + 1}번 사진을 ${card ? "뒤 카드로" : "뒤 자리로"} 옮기기`}
              disabled={locked || !canForward}
              onClick={() => onMove(index + 1)}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </ChipAction>
          </div>
          {/* 삭제는 화살표와 같은 줄에 두지 않는다 — 되돌릴 수 없는 동작이라 오폭이 곧 손실이다 */}
          {photo && <RemoveButton name={photo.name} disabled={locked} onClick={() => onRemove(photo.id)} />}
        </div>
      )}
    </li>
  );
}

/** 안 쓴 사진. 넣기(`SWAP_IN`)와 빼기(`REMOVE_PHOTO`)를 둘 다 여기서 한다. */
function TrayRow({
  photo,
  slotLabel,
  canSwap,
  locked,
  onSwapIn,
  onRemove,
}: {
  photo: Photo;
  slotLabel: string;
  canSwap: boolean;
  locked: boolean;
  onSwapIn: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 p-2.5">
      <button
        type="button"
        onClick={onSwapIn}
        disabled={locked || !canSwap}
        aria-label={`${photo.name} 을 ${slotLabel} 자리에 넣기`}
        className={`flex items-center gap-3 rounded-lg text-left transition-opacity duration-200 hover:opacity-80 disabled:opacity-50 ${FOCUS_RING} motion-reduce:transition-none`}
      >
        <Thumb photo={photo} />
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{photo.name}</span>
      </button>
      <RemoveButton name={photo.name} disabled={locked} onClick={onRemove} />
    </li>
  );
}

export function WorkbenchRail({
  items,
  tray,
  active,
  orderCount,
  dropOpen,
  locked,
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
  /**
   * 카피 생성 중에는 사진을 바꾸는 길을 전부 막는다. 20~50초 뒤 도착한 `SET_SPEC` 은 **그때의**
   * `order` 로 다시 묶기 때문에, 기다리는 동안 사진을 옮기면 옛 사진을 보고 쓴 카피가 다른
   * 사진에 붙는다. 고르기(`onPick`)는 사진을 건드리지 않으므로 잠그지 않는다.
   */
  locked: boolean;
  onPick: (index: number) => void;
  onMove: (to: number) => void;
  onRemove: (photoId: string) => void;
  onSwapIn: (photoId: string) => void;
  onToggleDrop: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* 순서 자체가 뜻이다 — 목록 시맨틱을 그대로 쓴다 */}
      <ol aria-label="카드 순서" className="flex flex-col gap-1">
        {items.map((item, i) => (
          <SlotRow
            key={item.key}
            item={item}
            index={i}
            on={i === active}
            canBack={i > 0 && i < orderCount}
            canForward={i + 1 < orderCount}
            locked={locked}
            onPick={() => onPick(i)}
            onMove={onMove}
            onRemove={onRemove}
          />
        ))}
      </ol>

      {/* 안 쓴 사진은 순서가 뜻을 갖지 않는 묶음이다 — 별도 목록으로 나누되 구분선은 두지 않는다 */}
      {tray.length > 0 && (
        <ul aria-label="안 쓴 사진" className="flex flex-col gap-1">
          {tray.map((photo) => (
            <TrayRow
              key={photo.id}
              photo={photo}
              slotLabel={`${active + 1}번`}
              canSwap={active < orderCount}
              locked={locked}
              onSwapIn={() => onSwapIn(photo.id)}
              onRemove={() => onRemove(photo.id)}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onToggleDrop}
        disabled={locked}
        aria-expanded={dropOpen}
        // 비활성 색은 텍스트만 바꾸면 점선 테두리가 살아 있는 것처럼 보인다 — 테두리도 함께 죽인다
        className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-hair p-3 text-ink-2 transition-colors duration-200 hover:border-ink hover:text-ink disabled:text-ink-disabled disabled:hover:border-hair disabled:hover:text-ink-disabled ${FOCUS_RING} motion-reduce:transition-none`}
      >
        <Plus size={18} aria-hidden="true" />
        <span className="text-[13px] font-bold">사진 추가</span>
      </button>
    </div>
  );
}

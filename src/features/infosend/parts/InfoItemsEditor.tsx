"use client";

import type { Dispatch } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DRAG_HANDLE_TOUCH, useSortableSensors } from "@/features/studio/useSortableSensors";
import { FOCUS_RING } from "@/components/ui";
import { ITEM_INPUT, SortableItem } from "./SortableItem";
import { ItemFields } from "./ItemFields";
import { itemRangeOf } from "@/lib/schema";
import type { InfoAction, InfoState } from "../reducer";

/**
 * 항목 편집 — 다섯 형식 **모두** 여기서 고친다.
 *
 * 형식마다 다른 것은 줄 안의 **칸**뿐이라(`ItemFields`), 줄 껍데기·개수 세기·추가·정렬은
 * 한 벌로 돈다. 형식마다 편집기를 따로 만들면 그 네 가지가 다섯 벌이 된다.
 *
 * 예전엔 툴바 탭 하나였는데, 항목마다 제목·설명 두 칸이라 목록이 세로로 길다. 카드 옆의
 * 얕은 툴바에 넣으면 그 안에서만 스크롤이 생겨 읽기 어려웠다. 짧은 조작(테마·글·맞춤)은
 * 카드 옆에 남기고, 긴 목록은 세로가 넉넉한 왼쪽으로 뗐다.
 */
export function InfoItemsEditor({ state, dispatch }: { state: InfoState; dispatch: Dispatch<InfoAction> }) {
  const sensors = useSortableSensors();
  const spec = state.spec;
  if (!spec) return null;

  const itemIds = spec.items.map((_, i) => `item-${i}`);

  function onDragEnd(event: DragEndEvent) {
    const { active: from, over } = event;
    if (!over || from.id === over.id) return;
    dispatch({ type: "REORDER_ITEM", from: itemIds.indexOf(String(from.id)), to: itemIds.indexOf(String(over.id)) });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 세는 값은 왼쪽, 더하는 동작은 오른쪽 끝 — 머리줄의 두 성격을 갈라 둔다. */}
      <span className="flex w-full items-center justify-between gap-2.5">
        <span className="text-[14px] text-ink-2">
          항목 <span className="font-bold tabular-nums text-ink">{spec.items.length}</span>/{itemRangeOf(spec.format).max} · 끌어서 순서를
          바꿔요
        </span>
        <button
          type="button"
          disabled={spec.items.length >= itemRangeOf(spec.format).max}
          onClick={() => dispatch({ type: "ADD_ITEM" })}
          className={`flex h-9 items-center gap-2 rounded-lg border border-hair px-3.5 text-[14px] font-bold text-ink-2 transition-colors duration-200 hover:border-ink hover:bg-hair-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hair disabled:hover:bg-transparent disabled:hover:text-ink-2 ${FOCUS_RING} motion-reduce:transition-none`}
        >
          항목 추가
        </button>
      </span>
      {/* 비교형은 **양쪽 이름**도 고쳐야 한다 — 항목 안에 없으므로 목록 위에 둔다. */}
      {spec.format === "compare" && (
        <div className="flex gap-1.5">
          {(["left", "right"] as const).map((side) => (
            <input
              key={side}
              value={spec.columns[side]}
              aria-label={side === "left" ? "왼쪽 이름" : "오른쪽 이름"}
              maxLength={16}
              placeholder={side === "left" ? "왼쪽" : "오른쪽"}
              onChange={(e) =>
                dispatch({ type: "UPDATE_COLUMNS", patch: { [side]: e.target.value } })
              }
              className={`${ITEM_INPUT} font-bold`}
            />
          ))}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {spec.items.map((item, i) => (
              <SortableItem
                key={itemIds[i]}
                id={itemIds[i]}
                index={i}
                canRemove={spec.items.length > itemRangeOf(spec.format).min}
                onRemove={() => dispatch({ type: "REMOVE_ITEM", index: i })}
              >
                <ItemFields
                  format={spec.format}
                  item={item}
                  index={i}
                  columns={spec.format === "compare" ? spec.columns : undefined}
                  onPatch={(patch) => dispatch({ type: "UPDATE_ITEM", index: i, patch })}
                />
              </SortableItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

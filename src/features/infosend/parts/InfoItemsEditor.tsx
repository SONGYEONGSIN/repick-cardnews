"use client";

import type { Dispatch } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FOCUS_RING } from "@/components/ui";
import { SortableItem } from "./SortableItem";
import { isListLike, itemRangeOf } from "@/lib/schema";
import type { InfoAction, InfoState } from "../reducer";

/**
 * 항목 편집 — **왼쪽 칸에 홀로 선다.**
 *
 * 예전엔 툴바 탭 하나였는데, 항목마다 제목·설명 두 칸이라 목록이 세로로 길다. 카드 옆의
 * 얕은 툴바에 넣으면 그 안에서만 스크롤이 생겨 읽기 어려웠다. 짧은 조작(테마·글·맞춤)은
 * 카드 옆에 남기고, 긴 목록은 세로가 넉넉한 왼쪽으로 뗐다.
 */
export function InfoItemsEditor({ state, dispatch }: { state: InfoState; dispatch: Dispatch<InfoAction> }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const spec = state.spec;
  // 목록·순서형 전용이다 — 항목이 `{keyword, desc}` 인 두 형식. 다른 형식은 각자의 편집기를 쓴다.
  if (!spec || !isListLike(spec)) return null;

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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {spec.items.map((item, i) => (
              <SortableItem
                key={itemIds[i]}
                id={itemIds[i]}
                index={i}
                keyword={item.keyword}
                desc={item.desc}
                canRemove={spec.items.length > itemRangeOf(spec.format).min}
                onPatch={(patch) => dispatch({ type: "UPDATE_ITEM", index: i, patch })}
                onRemove={() => dispatch({ type: "REMOVE_ITEM", index: i })}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

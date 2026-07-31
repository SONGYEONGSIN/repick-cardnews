"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Panel } from "@/components/ui";
import { SortableSlot } from "../parts/SortableSlot";
import { slotPhotos, trayPhotos, type CardnewsAction, type CardnewsState } from "../reducer";

export function OrderStep({
  state,
  dispatch,
}: {
  state: CardnewsState;
  dispatch: React.Dispatch<CardnewsAction>;
}) {
  const slots = slotPhotos(state);
  const tray = trayPhotos(state);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = state.order.indexOf(String(active.id));
    const to = state.order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    dispatch({ type: "REORDER", from, to });
  }

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">카드 순서</h2>
          <p className="text-xs text-ink-3">손잡이를 끌거나, 포커스 후 Space → 화살표로 옮겨요</p>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          {/* 슬롯은 flex-wrap 으로 접히므로(6장이면 960px > 900px) 단일 행 전략이 아니라 rect 전략이다 */}
          <SortableContext items={state.order} strategy={rectSortingStrategy}>
            <ul className="flex flex-wrap gap-3">
              {slots.map((photo, i) => (
                <SortableSlot key={photo.id} photo={photo} index={i} total={slots.length} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </section>

      {tray.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            안 쓰는 사진 <span className="tabular-nums text-ink-3">{tray.length}장</span>
          </h2>
          <Panel className="p-3">
            <ul className="flex flex-wrap gap-2">
              {tray.map((photo) => (
                <li key={photo.id} className="w-[104px]">
                  <div className="overflow-hidden rounded-lg border border-hair bg-hair-soft">
                    <span className="block aspect-[4/5] w-full">
                      {/* 로컬 dataURL 프리뷰 — next/image는 dataURL을 최적화할 수 없다 */}
                      <img src={photo.thumbUrl} alt={photo.name} className="h-full w-full object-cover" />
                    </span>
                  </div>
                  <label className="mt-1.5 flex flex-col gap-1 text-[11px] text-ink-3">
                    <span className="truncate">{photo.name}</span>
                    <select
                      aria-label={`${photo.name} 을 넣을 자리`}
                      value=""
                      onChange={(e) => {
                        if (e.target.value === "") return;
                        dispatch({ type: "SWAP_IN", slotIndex: Number(e.target.value), photoId: photo.id });
                      }}
                      className="h-7 rounded border border-hair bg-surface px-1 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-plum"
                    >
                      <option value="">자리 바꾸기</option>
                      {slots.map((_, i) => (
                        <option key={i} value={i}>
                          {i + 1}번과 교체
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      )}
    </div>
  );
}

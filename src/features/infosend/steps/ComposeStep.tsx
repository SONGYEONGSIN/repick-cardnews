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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button, Field, Panel } from "@/components/ui";
import { CardRenderer } from "@/templates/CardRenderer";
import { SortableItem } from "../parts/SortableItem";
import { toRenderCard } from "../render";
import { ITEMS_MAX, ITEMS_MIN, type InfoAction, type InfoState } from "../reducer";

const INPUT =
  "w-full rounded-lg border border-hair bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

export function ComposeStep({
  state,
  dispatch,
}: {
  state: InfoState;
  dispatch: React.Dispatch<InfoAction>;
}) {
  const card = toRenderCard(state);
  const spec = state.spec;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!card || !spec) return <p className="text-sm text-ink-3">먼저 카피를 생성해 주세요.</p>;

  const itemIds = spec.items.map((_, i) => `item-${i}`);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    dispatch({
      type: "REORDER_ITEM",
      from: itemIds.indexOf(String(active.id)),
      to: itemIds.indexOf(String(over.id)),
    });
  }

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_360px] gap-5">
      <div className="flex min-w-0 items-start justify-center overflow-y-auto">
        {/* 1080×1350 스테이지를 432×540 박스에 담기 위한 고정 픽셀 크기 — Tailwind 토큰으로 표현 불가 */}
        <div className="overflow-hidden rounded-xl border border-hair shadow-sm" style={{ width: 432, height: 540 }}>
          <div className="origin-top-left scale-40">
            <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
          </div>
        </div>
      </div>

      <Panel className="flex min-w-0 flex-col gap-5 overflow-y-auto p-4">
        <Field label="제목" htmlFor="title">
          <input
            id="title"
            value={spec.title}
            maxLength={40}
            onChange={(e) => dispatch({ type: "UPDATE_SPEC", patch: { title: e.target.value } })}
            className={INPUT}
          />
        </Field>

        <Field label="부제" htmlFor="subtitle">
          <input
            id="subtitle"
            value={spec.subtitle ?? ""}
            maxLength={60}
            onChange={(e) => dispatch({ type: "UPDATE_SPEC", patch: { subtitle: e.target.value } })}
            className={INPUT}
          />
        </Field>

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink-2">항목</h2>
            <span className="tabular-nums text-[11px] text-ink-3">
              {spec.items.length}/{ITEMS_MAX}
            </span>
          </div>
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
                    canRemove={spec.items.length > ITEMS_MIN}
                    onPatch={(patch) => dispatch({ type: "UPDATE_ITEM", index: i, patch })}
                    onRemove={() => dispatch({ type: "REMOVE_ITEM", index: i })}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <Button
            variant="secondary"
            size="sm"
            disabled={spec.items.length >= ITEMS_MAX}
            onClick={() => dispatch({ type: "ADD_ITEM" })}
          >
            <Plus size={14} aria-hidden="true" />
            항목 추가
          </Button>
        </section>

        <Field label="팁" htmlFor="tip">
          <textarea
            id="tip"
            rows={2}
            value={spec.tip ?? ""}
            maxLength={120}
            onChange={(e) => dispatch({ type: "UPDATE_SPEC", patch: { tip: e.target.value } })}
            className={INPUT}
          />
        </Field>

        <Field label="사진 높이" htmlFor="band">
          <input
            id="band"
            type="range"
            min={20}
            max={50}
            value={Math.round(state.band * 100)}
            onChange={(e) => dispatch({ type: "SET_BAND", band: Number(e.target.value) / 100 })}
            className="w-full accent-plum"
          />
        </Field>

        <Field label="사진 초점" htmlFor="focal-x" hint="사진이 4:5가 아닐 때 어디를 남길지 정해요.">
          <div className="flex flex-col gap-2">
            <input
              id="focal-x"
              type="range"
              min={0}
              max={100}
              value={Math.round(state.focal.x * 100)}
              aria-label="가로 초점"
              onChange={(e) =>
                dispatch({ type: "SET_FOCAL", focal: { ...state.focal, x: Number(e.target.value) / 100 } })
              }
              className="w-full accent-plum"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(state.focal.y * 100)}
              aria-label="세로 초점"
              onChange={(e) =>
                dispatch({ type: "SET_FOCAL", focal: { ...state.focal, y: Number(e.target.value) / 100 } })
              }
              className="w-full accent-plum"
            />
          </div>
        </Field>
      </Panel>
    </div>
  );
}

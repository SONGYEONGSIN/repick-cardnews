"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";

/** 항목 칸의 공통 모양 — 형식별 칸이 서로 달라 보이지 않게 한 곳에서 정한다. */
export const ITEM_INPUT =
  "w-full rounded-lg border border-hair bg-surface px-2.5 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

/**
 * 항목 한 줄의 **껍데기** — 끌기 손잡이·번호·지우기. 안에 들어가는 칸은 형식마다 다르므로
 * 부르는 쪽이 넣는다(`children`).
 *
 * 형식마다 줄을 통째로 복제하면 손잡이·번호·지우기가 다섯 벌이 되고, 한 곳을 고칠 때 다섯
 * 곳을 고쳐야 한다.
 */
export function SortableItem({
  id,
  index,
  canRemove,
  onRemove,
  children,
}: {
  id: string;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      // @dnd-kit이 드래그 중 실시간으로 계산하는 값 — Tailwind 클래스로 표현 불가능해 인라인 style 예외로 둔다
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-hair bg-surface p-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${index + 1}번 항목 순서 바꾸기`}
          className="flex h-6 w-6 flex-none cursor-grab items-center justify-center rounded text-ink-3 hover:bg-hair-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum active:cursor-grabbing"
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
        <span className="flex-1 tabular-nums text-[11px] font-semibold text-plum">{index + 1}</span>
        <button
          type="button"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label={`${index + 1}번 항목 지우기`}
          className="flex h-6 w-6 flex-none items-center justify-center rounded text-ink-3 hover:bg-hair-soft hover:text-danger disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </li>
  );
}

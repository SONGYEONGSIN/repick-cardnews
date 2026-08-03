"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";

const INPUT =
  "w-full rounded-lg border border-hair bg-surface px-2.5 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

export function SortableItem({
  id,
  index,
  keyword,
  desc,
  canRemove,
  onPatch,
  onRemove,
}: {
  id: string;
  index: number;
  keyword: string;
  desc: string;
  canRemove: boolean;
  onPatch: (patch: { keyword?: string; desc?: string }) => void;
  onRemove: () => void;
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
      <div className="flex flex-col gap-1.5">
        <input
          value={keyword}
          aria-label={`${index + 1}번 항목 키워드`}
          maxLength={30}
          onChange={(e) => onPatch({ keyword: e.target.value })}
          className={INPUT}
        />
        <textarea
          value={desc}
          aria-label={`${index + 1}번 항목 설명`}
          rows={2}
          maxLength={120}
          onChange={(e) => onPatch({ desc: e.target.value })}
          className={INPUT}
        />
      </div>
    </li>
  );
}

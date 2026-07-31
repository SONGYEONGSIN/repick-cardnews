"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Photo } from "@/lib/photos";

const ROLE_HINTS = ["표지", "본문", "본문", "본문", "본문", "마무리"];

export function SortableSlot({ photo, index, total }: { photo: Photo; index: number; total: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  });

  const hint = index === total - 1 ? "마무리" : (ROLE_HINTS[index] ?? "본문");

  return (
    <li
      ref={setNodeRef}
      // @dnd-kit이 드래그 중 실시간으로 계산하는 값 — Tailwind 클래스로 표현 불가능해 인라인 style 예외로 둔다
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`w-[150px] flex-none ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="overflow-hidden rounded-lg border-2 border-hair bg-hair-soft">
        <span className="block aspect-[4/5] w-full">
          {/* 로컬 dataURL 프리뷰 — next/image는 dataURL을 최적화할 수 없다 */}
          <img src={photo.thumbUrl} alt={photo.name} className="h-full w-full object-cover" />
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${index + 1}번 사진 순서 바꾸기`}
          className="flex h-6 w-6 flex-none cursor-grab items-center justify-center rounded text-ink-3 hover:bg-hair-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum active:cursor-grabbing"
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
        <span className="flex-none tabular-nums text-[11px] font-semibold text-plum">{index + 1}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-3">{hint}</span>
      </div>
    </li>
  );
}

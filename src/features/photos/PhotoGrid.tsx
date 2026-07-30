"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui";
import { isFourFive, type Photo } from "@/lib/photos";

function sizeLabel(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function PhotoGrid({
  photos,
  selectedIds,
  onToggle,
}: {
  photos: readonly Photo[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {photos.map((photo) => {
        const on = selectedIds.includes(photo.id);
        const ratioOk = isFourFive(photo.width, photo.height);
        return (
          <li key={photo.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(photo.id)}
              className={`group relative block w-full overflow-hidden rounded-lg border-2 bg-hair-soft transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
                on ? "border-plum" : "border-transparent hover:border-hair"
              }`}
            >
              <span className="block aspect-[4/5] w-full">
                {/* 로컬 dataURL 프리뷰 — next/image는 dataURL을 최적화할 수 없다 */}
                <img src={photo.thumbUrl} alt={photo.name} className="h-full w-full object-cover" />
              </span>
              {on && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-plum text-white">
                  <Check size={13} strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </button>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-2">{photo.name}</span>
              <span className="flex-none tabular-nums text-[11px] text-ink-3">{sizeLabel(photo.bytes)}</span>
            </div>
            {!ratioOk && (
              <div className="mt-1">
                <Badge tone="warn">4:5 아님 · 잘려요</Badge>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

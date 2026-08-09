"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { Dropzone } from "@/features/photos/Dropzone";
import type { Photo } from "@/lib/photos";

/**
 * 카피를 쓰기 전에 **참고할 이미지**를 붙이는 자리 — 카드뉴스·정보전달이 같은 것을 쓴다.
 *
 * 참고 이미지는 **카드에 실리지 않는다.** 잘 나온 남의 게시물처럼 "이런 말투·이런 구성으로"
 * 를 보여 주는 용도다. 그래서 카드 사진과 따로 두고, 모델에게도 따로 설명한다
 * (`@/lib/prompt` 의 `buildUserContent`).
 *
 * **처음엔 두 갈래만 보인다.** 붙일 게 없는 날이 대부분인데 드롭존을 늘 펼쳐 두면 화면만
 * 길어지고 "여기 꼭 넣어야 하나" 로 읽힌다.
 */
export function ReferencePicker({
  references,
  disabled,
  onAdd,
  onRemove,
  onClear,
}: {
  references: readonly Photo[];
  disabled: boolean;
  onAdd: (photos: Photo[]) => void;
  onRemove: (photoId: string) => void;
  onClear: () => void;
}) {
  // 이미 붙인 게 있으면 접지 않는다 — 접으면 무엇을 붙였는지 안 보인다.
  const [open, setOpen] = useState(false);
  const showPanel = open || references.length > 0;

  if (!showPanel) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>
          참고 내용 적용하기
        </Button>
        <p className="text-[14px] text-ink-2">참고할 게 없으면 그냥 아래에서 카피를 만드세요.</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hair p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] font-bold">참고 내용</span>
        <span className="text-[13px] text-ink-2">말투와 구성만 참고해요 · 카드에는 안 실려요</span>
      </div>

      {references.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {references.map((p) => (
            <li key={p.id} className="relative">
              {/* 참고 이미지는 내용을 봐야 하므로 썸네일을 잘라내지 않는다(object-contain). */}
              <img
                src={p.thumbUrl}
                alt={`참고 이미지 ${p.name}`}
                className="h-20 w-20 rounded-lg border border-hair bg-canvas object-contain"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(p.id)}
                aria-label={`참고 이미지 ${p.name} 빼기`}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-hair bg-surface text-ink-2 hover:border-danger hover:bg-danger hover:text-surface"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dropzone
        onPhotos={onAdd}
        onError={() => undefined}
        hint="잘 나온 게시물이나 참고할 카드를 올려 주세요. 여러 장도 됩니다."
      />

      <div className="flex justify-end">
        <Button
          variant="ghost"
          disabled={disabled}
          onClick={() => {
            onClear();
            setOpen(false);
          }}
        >
          참고 내용 없이 진행
        </Button>
      </div>
    </section>
  );
}

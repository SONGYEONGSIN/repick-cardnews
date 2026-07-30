"use client";

import { useRef, useState } from "react";
import { FolderOpen, ImageUp } from "lucide-react";
import { Button } from "@/components/ui";
import { filesToPhotos } from "@/lib/photos-client";
import type { Photo } from "@/lib/photos";

export function Dropzone({
  onPhotos,
  onError,
  hint,
}: {
  onPhotos: (photos: Photo[]) => void;
  onError: (message: string) => void;
  hint: string;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ingest(files: FileList | File[]) {
    setBusy(true);
    try {
      const photos = await filesToPhotos(files);
      if (photos.length === 0) {
        onError("이미지 파일(jpg·png·webp)이 없어요.");
        return;
      }
      onPhotos(photos);
    } catch (e) {
      onError(e instanceof Error ? e.message : "사진을 읽지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void ingest(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-14 transition-colors duration-200 motion-reduce:transition-none ${
        over ? "border-plum bg-plum-soft" : "border-hair bg-surface"
      }`}
    >
      <span className="text-ink-3">
        <ImageUp size={30} aria-hidden="true" />
      </span>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[15px] font-semibold">{busy ? "사진을 읽는 중이에요…" : "사진 폴더를 여기에 끌어다 놓으세요"}</p>
        <p className="text-sm text-ink-2">{hint}</p>
      </div>
      <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
        <FolderOpen size={15} aria-hidden="true" />
        폴더 선택
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        // 폴더 통째 선택 — React 타입에 없는 비표준 속성이라 문자열로 넘긴다
        {...{ webkitdirectory: "" }}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) void ingest(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

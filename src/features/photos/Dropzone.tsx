"use client";

import { useRef, useState } from "react";
import { FolderOpen, ImageUp } from "lucide-react";
import { Button } from "@/components/ui";
import { entriesToFiles, filesToPhotos } from "@/lib/photos-client";
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

  async function ingest(source: FileList | File[] | Promise<File[]>) {
    setBusy(true);
    try {
      const photos = await filesToPhotos(await source);
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
        // DataTransfer 는 핸들러가 반환되면 무효화된다 — 폴더 순회와 파일 목록 확보를 여기서 동기적으로 시작한다.
        const walked = entriesToFiles(e.dataTransfer.items);
        const dropped = Array.from(e.dataTransfer.files);
        // 폴더까지 펼친 목록을 쓰고, entry API 를 못 쓰는 브라우저면 드롭된 파일 목록으로 되돌아간다.
        void ingest(walked.then((files) => (files.length > 0 ? files : dropped)));
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
        aria-label="사진 폴더 선택"
        // 폴더 통째 선택 — React 타입에 없는 비표준 속성이라 문자열로 넘긴다
        {...{ webkitdirectory: "" }}
        // sr-only 라 포커스 링을 보여 줄 수 없으므로 탭 순서에서 뺀다.
        // 같은 동작은 위의 "폴더 선택" 버튼이 접근 가능하게 제공한다.
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) void ingest(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

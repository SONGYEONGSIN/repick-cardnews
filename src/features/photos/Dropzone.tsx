"use client";

import { useRef, useState } from "react";
import { FolderOpen, ImageUp } from "lucide-react";
import { Button, PLACEHOLDER_BOX } from "@/components/ui";
import { entriesToFiles, filesToPhotos } from "@/lib/photos-client";
import { skippedNotice } from "@/lib/photo-intake";
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
      const { photos, skipped } = await filesToPhotos(await source);

      // **넣은 것부터 넣는다.** 한 장이 안 읽힌다고 나머지를 버리면, 사용자는 왜 아무것도
      // 안 들어갔는지 알 수 없다.
      if (photos.length > 0) onPhotos(photos);

      // 빠진 게 있으면 반드시 말한다 — 조용히 버리는 것이 이 화면의 오래된 결함이었다.
      const notice = skippedNotice(photos.length, skipped);
      if (notice) onError(notice);
      else if (photos.length === 0) onError("이미지 파일이 없어요.");
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
      className={`${PLACEHOLDER_BOX} transition-colors duration-200 motion-reduce:transition-none ${
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
          // FileList 를 그대로 넘기면 안 된다 — ingest 의 첫 await 뒤에서야 목록을 읽는데,
          // 그 사이 아래 줄이 같은 입력의 value 를 비워 FileList 도 함께 비운다. 배열로
          // 동기 복사한 뒤에 비워야 재선택도 가능하고 방금 고른 파일도 안전하다.
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void ingest(files);
        }}
      />
    </div>
  );
}

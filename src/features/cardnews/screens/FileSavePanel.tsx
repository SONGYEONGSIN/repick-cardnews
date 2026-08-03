"use client";

import { Check, Download, FolderDown } from "lucide-react";
import { LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";

/**
 * "파일로 저장" — 내보내는 세 갈래 중 첫째. 사진이 이 컴퓨터를 벗어나지 않는다는 점에서
 * "폰으로 보내기"(`SharePanel`)와 같은 묶음이지만, 저 쪽은 같은 와이파이의 다른 기기로
 * 나가고 이 쪽은 파일시스템에만 남는다는 차이를 안내 문구로 구분한다.
 *
 * 두 버튼(`내려받기`·`저장`)은 예전에 `ExportScreen` 헤더에 있었다 — 동작(각각
 * `useExport.download`/`saveToFolder` 호출)은 그대로 옮겨만 왔다. `내려받기`는 브라우저
 * 다운로드 폴더에 한 장씩, `저장`은 이 프로젝트의 날짜 폴더에 세트로 남긴다.
 */
export function FileSavePanel({
  busy,
  dir,
  saved,
  onDownload,
  onSave,
}: {
  busy: boolean;
  /** 저장될 폴더 경로 — 버튼을 누르기 전에도 미리 보여준다. */
  dir: string;
  saved: { dir: string; count: number } | null;
  onDownload: () => void;
  onSave: () => void;
}) {
  return (
    // 표준: 제목/구분선(SectionHead) 밖, 내용 안 — docs/ui-standards.md §1
    <section className="flex flex-col gap-4">
      <SectionHead title="파일로 저장" aside="이 컴퓨터 안에만 남아요" />
      <p className="max-w-[62ch] text-[14px] leading-relaxed text-ink-2">
        네트워크 밖으로 나가지 않아요. <span className="font-mono text-[13px]">{dir}/</span> 에 장수만큼
        PNG 로 남거나, 브라우저 다운로드 폴더에 한 장씩 내려받아요.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <LineButton disabled={busy} onClick={onDownload}>
          <Download size={15} aria-hidden="true" />
          내려받기
        </LineButton>
        <SolidButton disabled={busy} onClick={onSave}>
          <FolderDown size={16} aria-hidden="true" />
          폴더에 저장
        </SolidButton>
      </div>
      {saved && (
        <p role="status" className="flex items-center gap-2.5 rounded-lg bg-canvas px-4 py-3 text-[14px]">
          <Check size={16} aria-hidden="true" className="flex-none" />
          <span>
            <span className="font-bold">{saved.count}장</span> 저장했어요 —{" "}
            <code className="rounded bg-hair-soft px-1.5 py-0.5 font-mono text-[13px]">{saved.dir}</code>
          </span>
        </p>
      )}
    </section>
  );
}

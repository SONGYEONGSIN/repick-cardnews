import { useCallback, useRef } from "react";
import { blobToBase64, downloadBlob, exportNodeToPng } from "@/lib/export";
import { slugify } from "@/lib/paths";
import { mmdd } from "./useGenerate";

/** 캡처 스테이지 노드를 PNG로 캡처해 다운로드하거나 서버 폴더에 저장하는 훅. */
export function useExport() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  const registerRef = useCallback((index: number, node: HTMLDivElement | null) => {
    refs.current[index] = node;
  }, []);

  const capture = useCallback(async (count: number): Promise<Blob[]> => {
    const blobs: Blob[] = [];
    for (let i = 0; i < count; i++) {
      const node = refs.current[i];
      // 노드가 없으면 조용히 건너뛰지 않고 던진다 — 장수가 모자란 채 저장되면
      // 사용자가 나중에야 알게 된다.
      if (!node) throw new Error(`${i + 1}번 카드를 캡처하지 못했어요. 다시 시도해 주세요.`);
      blobs.push(await exportNodeToPng(node));
    }
    return blobs;
  }, []);

  const download = useCallback(
    async (count: number, keyword: string) => {
      const blobs = await capture(count);
      const slug = slugify(keyword) || "card";
      blobs.forEach((b, i) => downloadBlob(b, `${slug}-${i + 1}.png`));
    },
    [capture],
  );

  const saveToFolder = useCallback(
    async (args: {
      count: number;
      keyword: string;
      type: "cardnews" | "informationsend";
      templateIds: string[];
    }): Promise<{ dir: string; paths: string[] }> => {
      const blobs = await capture(args.count);
      const images = await Promise.all(blobs.map(blobToBase64));
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: args.type,
          keyword: args.keyword,
          mmdd: mmdd(),
          images,
          templateIds: args.templateIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "저장에 실패했어요");
      return data;
    },
    [capture],
  );

  return { registerRef, download, saveToFolder };
}

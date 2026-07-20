"use client";

import { useRef, useState } from "react";
import type { ContentSpec } from "@/lib/schema";
import { CardRenderer } from "@/templates/CardRenderer";
import { THEMES, THEME_IDS, type ThemeId } from "@/templates/themes";
import { exportNodeToPng, downloadBlob, blobToBase64 } from "@/lib/export";
import { slugify } from "@/lib/paths";

type GenType = "informationsend" | "cardnews";

export function Studio() {
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<GenType>("informationsend");
  const [themeId, setThemeId] = useState<ThemeId>("mint-clean");
  const [spec, setSpec] = useState<ContentSpec | null>(null);
  const [genKeyword, setGenKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 화면용 축소 미리보기 노드 (표시 전용, 캡처에는 사용하지 않음)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  // PNG 캡처 전용 화면 밖 원본(1080×1350, transform 없음) 노드
  const captureRefs = useRef<(HTMLDivElement | null)[]>([]);

  const cardCount = spec?.type === "cardnews" ? spec.cards.length : 1;

  async function generate() {
    setBusy(true); setError(null); setSpec(null);
    cardRefs.current = [];
    captureRefs.current = [];
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setSpec(data.spec);
      setGenKeyword(keyword);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  function mmdd(): string {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }

  async function collectPngs(): Promise<Blob[]> {
    const out: Blob[] = [];
    for (let i = 0; i < cardCount; i++) {
      const node = captureRefs.current[i];
      if (node) out.push(await exportNodeToPng(node));
    }
    if (out.length !== cardCount) {
      throw new Error("일부 카드 캡처에 실패했습니다. 다시 시도해주세요.");
    }
    return out;
  }

  async function downloadAll() {
    if (!spec) return;
    setBusy(true); setError(null);
    try {
      const blobs = await collectPngs();
      const slug = slugify(genKeyword) || "card";
      blobs.forEach((b, i) => downloadBlob(b, `${slug}-${i + 1}.png`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "다운로드 오류");
    } finally { setBusy(false); }
  }

  async function saveToFolder() {
    if (!spec) return;
    setBusy(true); setError(null);
    try {
      const blobs = await collectPngs();
      const images = await Promise.all(blobs.map(blobToBase64));
      const templateIds =
        spec.type === "cardnews" ? spec.cards.map((c) => c.role) : ["InfographicCard"];
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: spec.type, keyword: genKeyword, mmdd: mmdd(), images, templateIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      alert(`저장 완료: ${data.dir} (${data.paths.length}장)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 오류");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto grid max-w-[1120px] grid-cols-[360px_1fr] gap-10 px-6 py-12">
        {/* 좌측: 컨트롤 (도구 = 차갑게) */}
        <section>
          <p className="text-xs uppercase tracking-[0.28em] text-stone-500">RE:PICK STUDIO</p>
          <h1 className="my-2 mb-7 text-[34px] font-extrabold">카드 스튜디오</h1>

          <label className="text-sm text-stone-600">키워드</label>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="예: 에어컨 전기세 절약"
            className="mt-1.5 mb-5 w-full rounded-[10px] border border-stone-200 px-3.5 py-3 text-[15px]"
          />

          <div className="mb-1.5 text-sm text-stone-600">유형</div>
          <div className="mb-5 flex gap-2">
            {(["informationsend", "cardnews"] as GenType[]).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 cursor-pointer rounded-[10px] border border-stone-200 py-2.5 ${type === t ? "bg-stone-900 text-white" : "bg-white text-stone-900"}`}>
                {t === "informationsend" ? "정보전달" : "카드뉴스"}
              </button>
            ))}
          </div>

          <div className="mb-1.5 text-sm text-stone-600">테마</div>
          <div className="mb-6 flex gap-2">
            {THEME_IDS.map((id) => (
              <button key={id} onClick={() => setThemeId(id)}
                className={`flex-1 cursor-pointer rounded-[10px] py-2 text-xs ${themeId === id ? "border-2 border-orange-700" : "border border-stone-200"}`}
                style={{ background: THEMES[id].bg, color: THEMES[id].fg }}>
                {THEMES[id].label}
              </button>
            ))}
          </div>

          <button onClick={generate} disabled={busy || !keyword.trim()}
            className={`w-full rounded-xl border-none bg-orange-700 py-3.5 text-base font-bold text-white ${busy ? "cursor-wait" : "cursor-pointer"} ${!keyword.trim() ? "opacity-50" : "opacity-100"}`}>
            {busy ? "생성 중…" : "생성하기"}
          </button>

          {spec && (
            <div className="mt-4 flex gap-2">
              <button onClick={downloadAll} disabled={busy} className="flex-1 cursor-pointer rounded-[10px] border border-stone-900 bg-white py-3">PNG 다운로드</button>
              <button onClick={saveToFolder} disabled={busy} className="flex-1 cursor-pointer rounded-[10px] border-none bg-stone-900 py-3 text-white">폴더에 저장</button>
            </div>
          )}
          {error && <p className="mt-3.5 text-sm text-red-600">⚠ {error}</p>}
        </section>

        {/* 우측: 미리보기 캐러셀 (산출물 = 뜨겁게) */}
        <section>
          {!spec && <div className="flex h-[480px] items-center justify-center rounded-2xl border border-dashed border-stone-300 text-stone-400">키워드를 입력하고 생성하기를 누르세요</div>}
          {spec && (
            <div className="flex gap-6 overflow-x-auto pb-3">
              {Array.from({ length: cardCount }).map((_, i) => (
                <div key={i} className="flex-none">
                  <div className="mb-1.5 text-xs text-stone-500">{i + 1} / {cardCount}</div>
                  {/* 화면용 축소 렌더 (표시 전용). PNG 캡처는 화면 밖 원본 노드(captureRefs)에서 수행한다. */}
                  <div ref={(el) => { cardRefs.current[i] = el; }} className="overflow-hidden rounded-xl border border-stone-200" style={{ width: 324, height: 405 }}>
                    <div style={{ transform: "scale(0.3)", transformOrigin: "top left" }}>
                      <CardRenderer spec={spec} themeId={themeId} index={i} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 화면 밖 원본 렌더(1080×1350, transform 없음): PNG 캡처 전용 */}
      {spec && (
        <div style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none", opacity: 0 }}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <div key={i} ref={(el) => { captureRefs.current[i] = el; }}>
              <CardRenderer spec={spec} themeId={themeId} index={i} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

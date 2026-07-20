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
    return out;
  }

  async function downloadAll() {
    if (!spec) return;
    setBusy(true);
    try {
      const blobs = await collectPngs();
      const slug = slugify(keyword) || "card";
      blobs.forEach((b, i) => downloadBlob(b, `${slug}-${i + 1}.png`));
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
        body: JSON.stringify({ type, keyword, mmdd: mmdd(), images, templateIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      alert(`저장 완료: ${data.dir} (${data.paths.length}장)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 오류");
    } finally { setBusy(false); }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#faf9f7", color: "#1c1917" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 24px", display: "grid", gridTemplateColumns: "360px 1fr", gap: 40 }}>
        {/* 좌측: 컨트롤 (도구 = 차갑게) */}
        <section>
          <p style={{ letterSpacing: "0.28em", fontSize: 12, textTransform: "uppercase", color: "#78716c" }}>RE:PICK STUDIO</p>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: "8px 0 28px" }}>카드 스튜디오</h1>

          <label style={{ fontSize: 13, color: "#57534e" }}>키워드</label>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="예: 에어컨 전기세 절약"
            style={{ width: "100%", marginTop: 6, marginBottom: 20, padding: "12px 14px", borderRadius: 10, border: "1px solid #e7e5e4", fontSize: 15 }}
          />

          <div style={{ fontSize: 13, color: "#57534e", marginBottom: 6 }}>유형</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["informationsend", "cardnews"] as GenType[]).map((t) => (
              <button key={t} onClick={() => setType(t)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #e7e5e4", background: type === t ? "#1c1917" : "#fff", color: type === t ? "#fff" : "#1c1917", cursor: "pointer" }}>
                {t === "informationsend" ? "정보전달" : "카드뉴스"}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 13, color: "#57534e", marginBottom: 6 }}>테마</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {THEME_IDS.map((id) => (
              <button key={id} onClick={() => setThemeId(id)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: themeId === id ? "2px solid #c2410c" : "1px solid #e7e5e4", background: THEMES[id].bg, color: THEMES[id].fg, fontSize: 12, cursor: "pointer" }}>
                {THEMES[id].label}
              </button>
            ))}
          </div>

          <button onClick={generate} disabled={busy || !keyword.trim()}
            style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: "#c2410c", color: "#fff", fontSize: 16, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: !keyword.trim() ? 0.5 : 1 }}>
            {busy ? "생성 중…" : "생성하기"}
          </button>

          {spec && (
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={downloadAll} disabled={busy} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #1c1917", background: "#fff", cursor: "pointer" }}>PNG 다운로드</button>
              <button onClick={saveToFolder} disabled={busy} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: "#1c1917", color: "#fff", cursor: "pointer" }}>폴더에 저장</button>
            </div>
          )}
          {error && <p style={{ color: "#dc2626", marginTop: 14, fontSize: 14 }}>⚠ {error}</p>}
        </section>

        {/* 우측: 미리보기 캐러셀 (산출물 = 뜨겁게) */}
        <section>
          {!spec && <div style={{ height: 480, borderRadius: 16, border: "1px dashed #d6d3d1", display: "flex", alignItems: "center", justifyContent: "center", color: "#a8a29e" }}>키워드를 입력하고 생성하기를 누르세요</div>}
          {spec && (
            <div style={{ display: "flex", gap: 24, overflowX: "auto", paddingBottom: 12 }}>
              {Array.from({ length: cardCount }).map((_, i) => (
                <div key={i} style={{ flex: "0 0 auto" }}>
                  <div style={{ fontSize: 12, color: "#78716c", marginBottom: 6 }}>{i + 1} / {cardCount}</div>
                  {/* 화면용 축소 렌더 (표시 전용). PNG 캡처는 화면 밖 원본 노드(captureRefs)에서 수행한다. */}
                  <div ref={(el) => { cardRefs.current[i] = el; }} style={{ width: 324, height: 405, overflow: "hidden", borderRadius: 12, border: "1px solid #e7e5e4" }}>
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

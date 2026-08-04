"use client";

import { useEffect, useState } from "react";
import { SectionHead } from "@/features/shell/StudioFrame";
import { TokenStatusBlock, type RefreshActionResult, type TokenStatusView } from "@/features/cardnews/screens/TokenStatusBlock";

/**
 * 인스타그램 연결 설정 — **토큰 만료일과 갱신**.
 *
 * 예전엔 게시 화면 안에 있었는데, 올릴 때마다 보게 되는 자리에 "가끔 한 번" 하는 일이 섞여
 * 있었다. 게시 화면은 연결 확인 → 캡션 → 언제 올릴지로 정리하고, 토큰은 여기로 뺐다.
 *
 * **토큰 값 자체는 이 화면에도, 어떤 응답에도 오지 않는다** — 서버가 만료일만 알려 준다.
 */
export function InstagramSettings() {
  const [status, setStatus] = useState<TokenStatusView>({ state: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<RefreshActionResult>({ state: "idle" });

  useEffect(() => {
    let alive = true;
    void fetch("/api/instagram-refresh-token")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { expired?: boolean; expiresAt?: string; daysRemaining?: number } | null) => {
        if (!alive) return;
        if (data?.expired) {
          setStatus({ state: "expired" });
        } else if (typeof data?.expiresAt === "string" && typeof data.daysRemaining === "number") {
          setStatus({ state: "valid", expiresAt: new Date(data.expiresAt), daysRemaining: data.daysRemaining });
        } else {
          setStatus({ state: "unknown" });
        }
      })
      .catch(() => {
        if (alive) setStatus({ state: "check-failed" });
      });
    return () => {
      alive = false;
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/instagram-refresh-token", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setResult({ state: "success", expiresAt: data.expiresAt });
        setStatus({
          state: "valid",
          expiresAt: new Date(data.expiresAt),
          // 남은 날짜는 서버가 함께 준다 — 화면에서 다시 세지 않는다(둘이 어긋나면 거짓말이 된다).
          daysRemaining: typeof data.daysRemaining === "number" ? data.daysRemaining : 0,
        });
      } else {
        setResult({
          state: "failed",
          message: typeof data.error === "string" ? data.error : "토큰 갱신에 실패했어요.",
        });
      }
    } catch {
      setResult({ state: "failed", message: "토큰 갱신에 실패했어요. 잠시 후 다시 시도해 주세요." });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHead title="인스타그램 연결" aside="토큰은 60일마다 새로 받아요" />
      <div className="flex flex-col gap-4 rounded-xl border border-hair p-6">
        <p className="text-[14px] leading-relaxed text-ink-2">
          서버가 켜질 때 만료가 30일 안으로 다가왔으면 스스로 갱신해요. 여기서 직접 갱신할 수도 있어요 —
          토큰 값 자체는 화면에 오지 않고, 남은 기간만 보여 줘요.
        </p>
        <TokenStatusBlock status={status} refreshing={refreshing} refreshResult={result} onRefresh={() => void refresh()} />
      </div>
    </section>
  );
}

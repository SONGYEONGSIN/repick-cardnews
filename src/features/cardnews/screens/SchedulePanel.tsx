"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, CircleAlert, LoaderCircle, X } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { inKorean } from "./errors";
import {
  STATUS_LABELS,
  isPending,
  toLocalInputValue,
  toScheduleView,
  type ScheduleView,
} from "./schedule-view";

/**
 * 예약 발행 — 인스타그램 방법 안에 붙는다. 예약도 게시의 한 갈래다.
 *
 * 표준(docs/ui-standards.md): `SectionHead` 밖 / 내용은 박스 안 / 2단은 왼쪽 설명·조작,
 * 오른쪽 결과(목록).
 *
 * **컴퓨터가 켜져 있어야 한다는 사실을 반드시 화면에 적는다.** 안 적으면 "예약했으니 됐다"고
 * 믿고 컴퓨터를 끈다 — 로컬 앱의 구조적 제약이라 우회할 수 없다.
 */

export function SchedulePanel({
  busy,
  imageCount,
  keyword,
  caption,
  hashtags,
  onCaptureImages,
}: {
  busy: boolean;
  imageCount: number;
  keyword: string;
  caption: string;
  hashtags: string[];
  onCaptureImages: (count: number) => Promise<string[]>;
}) {
  const [when, setWhen] = useState("");
  const [items, setItems] = useState<ScheduleView[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule");
      const body: unknown = await res.json().catch(() => null);
      setItems(toScheduleView(res.status, body));
    } catch {
      // 목록을 못 읽는 것으로 화면을 막지 않는다 — 예약 자체는 계속 걸 수 있다.
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
    // 스케줄러가 1분마다 도므로 화면도 그 주기로 따라간다.
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function schedule() {
    if (working || !when) return;
    setWorking(true);
    setError(null);
    try {
      // 예약 시점의 카드 그대로를 굳힌다 — 나중에 카드를 고쳐도 예약된 것은 그대로 올라간다.
      const images = await onCaptureImages(imageCount);
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scheduledAt: new Date(when).getTime(),
          caption,
          hashtags,
          keyword,
          images: images.map((dataUrl) => dataUrl.split(",")[1] ?? ""),
        }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
        setError(inKorean(typeof message === "string" ? message : "", "예약하지 못했어요. 잠시 후 다시 시도해 주세요."));
        return;
      }
      setWhen("");
      await load();
    } catch (e) {
      setError(inKorean(e instanceof Error ? e.message : "", "예약하지 못했어요. 잠시 후 다시 시도해 주세요."));
    } finally {
      setWorking(false);
    }
  }

  async function cancel(id: string) {
    try {
      await fetch(`/api/schedule?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } catch {
      setError("예약을 취소하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHead title="예약 발행" aside="정해 둔 시각에 자동으로 올려요" />
      <div className="grid gap-6 rounded-xl border border-hair p-6 xl:grid-cols-2 xl:items-start">
        <div className="flex flex-col gap-4">
          {/* 이 문단을 지우지 마라 — 안 적으면 예약해 두고 컴퓨터를 끈다. */}
          <p className="text-[14px] font-bold leading-relaxed">
            예약한 시각에 이 컴퓨터가 켜져 있고 dev 서버와 터널이 돌고 있어야 올라가요.
          </p>
          <p className="text-[14px] leading-relaxed text-ink-2">
            시각을 한 시간 넘게 지나면 올리지 않고 &lsquo;놓침&rsquo;으로 남겨요. 지금 화면의 캡션과
            해시태그가 그대로 함께 올라가요 — 예약한 뒤 카드를 고쳐도 예약된 것은 그대로예요.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold text-ink-2">언제 올릴까요</span>
            <input
              type="datetime-local"
              value={when}
              min={toLocalInputValue(Date.now() + 60_000)}
              onChange={(e) => setWhen(e.target.value)}
              disabled={busy || working}
              className={`h-11 rounded-lg border border-hair px-3 text-[14px] transition-colors duration-200 focus:border-ink focus:outline-none disabled:text-ink-disabled ${FOCUS_RING} motion-reduce:transition-none`}
            />
          </label>

          <SolidButton disabled={busy || working || !when} onClick={() => void schedule()}>
            {working ? (
              <LoaderCircle size={15} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <CalendarClock size={15} aria-hidden="true" />
            )}
            {working ? "예약하는 중" : "이 시각에 예약"}
          </SolidButton>

          {error && (
            <p role="alert" className="flex items-start gap-2 text-[14px] font-bold">
              <CircleAlert size={15} aria-hidden="true" className="mt-0.5 flex-none" />
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-[13px] text-ink-2">예약 목록</h3>
          {items.length === 0 ? (
            <p className="text-[14px] text-ink-2">아직 예약이 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {items.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 rounded-lg border border-hair px-4 py-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold">{STATUS_LABELS[item.status]}</span>
                    <span className="text-[13px] text-ink-2">{item.describe}</span>
                    {isPending(item) && (
                      <button
                        type="button"
                        onClick={() => void cancel(item.id)}
                        className={`ml-auto flex items-center gap-1 rounded px-2 py-1 text-[13px] font-bold text-ink-2 transition-colors duration-200 hover:text-ink ${FOCUS_RING} motion-reduce:transition-none`}
                      >
                        <X size={13} aria-hidden="true" />
                        취소
                      </button>
                    )}
                    {item.status === "published" && (
                      <Check size={14} aria-hidden="true" className="ml-auto flex-none" />
                    )}
                  </span>
                  <span className="text-[13px] text-ink-2">
                    {item.keyword} · 카드 {item.imageCount}장
                  </span>
                  {/* 왜 실패했는지 감추지 않는다 — 다시 예약하려면 이유를 알아야 한다. */}
                  {item.message && <span className="text-[13px] font-bold leading-relaxed">{item.message}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

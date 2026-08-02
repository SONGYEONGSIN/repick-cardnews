"use client";

import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { SectionHead } from "@/features/shell/StudioFrame";

/**
 * `POST /api/share` 응답에서 이 패널이 쓰는 부분만 — `token` 은 필요 없다.
 * `link` 가 `null` 이면 이 PC 의 집 네트워크 주소를 못 찾은 것이다(`@/lib/lan-address`).
 */
export type ShareResult = { link: string | null; expiresAt: string };

function remainingLabel(expiresAt: string, now: number): string {
  const ms = Math.max(0, new Date(expiresAt).getTime() - now);
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}분 ${String(seconds).padStart(2, "0")}초 뒤 만료돼요`;
}

/**
 * "폰으로 보내기" 결과 — QR·링크·남은 시간. `share.link` 가 있을 때만 QR 을 그린다.
 * `qrcode` 는 브라우저 canvas 로 그리므로 이 파일은 클라이언트 컴포넌트다.
 */
export function SharePanel({ share }: { share: ShareResult }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!share.link) return;
    let cancelled = false;
    toDataURL(share.link).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [share.link]);

  // 만료까지 남은 시간을 1초마다 다시 계산해 보여 준다.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="flex max-w-[640px] flex-col gap-4">
      <SectionHead title="폰으로 보내기" aside="같은 와이파이에서만 열려요" />
      <div role="status" className="flex flex-col gap-4 rounded-xl border border-hair p-6">
        {share.link ? (
          <>
            <p className="text-[14px] leading-relaxed text-ink-2">
              폰이 이 컴퓨터와 같은 와이파이에 연결돼 있어야 링크가 열려요.
            </p>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="폰 카메라로 스캔하면 카드가 열려요" className="h-44 w-44 flex-none" />
            )}
            <p className="break-all rounded bg-hair-soft px-3 py-2 font-mono text-[13px]">{share.link}</p>
            <p className="text-[13px] font-bold text-ink-2">{remainingLabel(share.expiresAt, now)}</p>
          </>
        ) : (
          <p className="text-[14px] leading-relaxed text-ink-2">
            이 컴퓨터의 집 네트워크 주소를 찾지 못해 링크를 만들지 못했어요. 이 컴퓨터가 와이파이(유선이
            아닌)에 연결돼 있는지 확인한 뒤 다시 눌러 주세요.
          </p>
        )}
      </div>
    </section>
  );
}

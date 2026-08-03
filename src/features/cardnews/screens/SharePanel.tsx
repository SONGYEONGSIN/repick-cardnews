"use client";

import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { Smartphone } from "lucide-react";
import { LineButton, SectionHead } from "@/features/shell/StudioFrame";

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
 * "폰으로 보내기" — 내보내는 세 갈래 중 둘째. 사진이 이 컴퓨터를 벗어나 같은 와이파이의
 * 다른 기기로 가지만, 인터넷으로는 나가지 않는다는 점에서 "인스타그램에 올리기"와 구분된다.
 *
 * 트리거 버튼(`onRequest`)은 예전에 `ExportScreen` 헤더에 있었다 — 위치만 이 패널 안으로
 * 옮겼고, 실제 요청 로직(`/api/share` 호출)은 그대로 `ExportScreen`이 쥐고 있다. `share`가
 * `null`이면 아직 요청 전, 있으면 결과(QR·링크·만료)를 보여준다. `share.link`가 있을 때만
 * QR을 그린다 — `qrcode`는 브라우저 canvas로 그리므로 이 파일은 클라이언트 컴포넌트다.
 */
export function SharePanel({
  share,
  busy,
  onRequest,
}: {
  share: ShareResult | null;
  busy: boolean;
  onRequest: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!share?.link) return;
    let cancelled = false;
    toDataURL(share.link).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [share?.link]);

  // 만료까지 남은 시간을 1초마다 다시 계산해 보여 준다.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    // 표준: 제목/구분선 밖, 내용은 박스 안 + 설명(왼쪽)/조작·결과(오른쪽) 2단 — docs/ui-standards.md §1,§3
    <section className="flex flex-col gap-4">
      <SectionHead title="폰으로 보내기" aside="같은 와이파이에서만 열려요" />
      <div role="status" className="grid gap-6 rounded-xl border border-hair p-6 xl:grid-cols-2 xl:items-start">
        <div className="flex flex-col gap-3">
          {/* 이 방법이 "확인용"으로만 읽히던 문제 — 링크 조건만 적혀 있고 **무엇에 쓰는지**가
              없었다. 폰에 저장한 뒤 인스타 앱으로 올리는 길이라는 걸 먼저 말한다. */}
          <p className="text-[14px] leading-relaxed">
            <span className="font-bold">폰 사진첩에 저장해서 인스타 앱으로 직접 올릴 때 써요.</span>{" "}
            앱에서 올리면 예약·위치·태그처럼 인스타 앱 기능을 그대로 쓸 수 있어요.
          </p>
          <p className="text-[14px] leading-relaxed text-ink-2">
            폰이 이 컴퓨터와 같은 와이파이에 연결돼 있어야 링크가 열려요. 인터넷으로는 나가지 않아요.
            링크를 연 다음 <span className="font-bold">이미지를 길게 눌러 저장</span>하면 돼요.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {!share && (
            <LineButton disabled={busy} onClick={onRequest}>
              <Smartphone size={15} aria-hidden="true" />
              폰으로 보내기 링크 만들기
            </LineButton>
          )}
          {share?.link && (
            <>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="폰 카메라로 스캔하면 카드가 열려요" className="h-44 w-44 flex-none" />
              )}
              <p className="break-all rounded bg-hair-soft px-3 py-2 font-mono text-[13px]">{share.link}</p>
              <p className="text-[13px] font-bold text-ink-2">{remainingLabel(share.expiresAt, now)}</p>
            </>
          )}
          {share && !share.link && (
            <p className="text-[14px] leading-relaxed text-ink-2">
              이 컴퓨터의 집 네트워크 주소를 찾지 못해 링크를 만들지 못했어요. 이 컴퓨터가 와이파이(유선이
              아닌)에 연결돼 있는지 확인한 뒤 다시 눌러 주세요.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

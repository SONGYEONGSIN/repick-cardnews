import { Check, CircleAlert } from "lucide-react";
import { LineButton } from "@/features/shell/StudioFrame";
import { formatKoreanDate } from "@/lib/instagram-token-refresh";

/**
 * 인스타그램 액세스 토큰 만료일 표시 + "토큰 갱신" 버튼. `InstagramPublishPanel`이 상태를
 * 들고 있고(`GET /api/instagram-refresh-token`으로 채운다) 이 컴포넌트는 순수하게 보여주기만
 * 한다 — 자세한 배경은 `InstagramPublishPanel` 상단 docstring "토큰 만료일" 항목 참고.
 */

/** 남은 기간이 이 값(일) 이하면 "곧 만료"로 눈에 띄게 보여준다. 자동 갱신 임계값(30일,
 * `AUTO_REFRESH_THRESHOLD_DAYS`)보다 짧게 잡아 — 자동 갱신이 조용히 처리할 여유 구간까지
 * 매번 경고색으로 보여주지 않는다. */
const EXPIRY_WARNING_DAYS = 14;

export type TokenStatusView =
  | { state: "loading" }
  | { state: "check-failed" }
  | { state: "unknown" }
  | { state: "expired" }
  | { state: "valid"; expiresAt: Date; daysRemaining: number };

export type RefreshActionResult =
  | { state: "idle" }
  | { state: "refreshing" }
  | { state: "success"; expiresAt: string }
  | { state: "failed"; message: string };

/**
 * 저장된 토큰 만료일과 "토큰 갱신" 버튼. 이미 만료됐으면(`expired`) 갱신 자체가 불가능하므로
 * 버튼 대신 대시보드 재발급 안내를 보여준다 — `docs/instagram-setup.md`의 6단계를 가리킨다.
 */
export function TokenStatusBlock({
  status,
  refreshing,
  refreshResult,
  onRefresh,
}: {
  status: TokenStatusView;
  refreshing: boolean;
  refreshResult: RefreshActionResult;
  onRefresh: () => void;
}) {
  if (status.state === "loading") {
    return <p className="text-[13px] text-ink-2">토큰 상태를 확인하는 중이에요.</p>;
  }

  if (status.state === "check-failed") {
    return (
      <p role="alert" className="flex items-center gap-2 text-[13px] text-ink-2">
        <CircleAlert size={14} aria-hidden="true" className="flex-none" />
        토큰 상태를 확인하지 못했어요.
      </p>
    );
  }

  if (status.state === "expired") {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-warn-soft px-3 py-2.5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-warn-ink">
          <CircleAlert size={14} aria-hidden="true" className="flex-none" />
          액세스 토큰이 만료됐어요 — 자동으로도, 버튼으로도 갱신할 수 없어요.
        </p>
        <p className="text-[13px] leading-relaxed text-ink-2">
          대시보드에서 새 토큰을 다시 만들어야 해요 — docs/instagram-setup.md 의 6단계를 따라 주세요.
        </p>
      </div>
    );
  }

  const warn = status.state === "valid" && status.daysRemaining <= EXPIRY_WARNING_DAYS;
  const label =
    status.state === "unknown"
      ? "만료일 정보가 아직 없어요."
      : `${formatKoreanDate(status.expiresAt)}까지 · ${status.daysRemaining}일 남음`;

  return (
    <div className={`flex flex-col gap-2 rounded-lg px-3 py-2.5 ${warn ? "bg-warn-soft" : "bg-hair-soft"}`}>
      <p className={`text-[13px] font-bold ${warn ? "text-warn-ink" : "text-ink-2"}`}>{label}</p>
      <LineButton disabled={refreshing} onClick={onRefresh}>
        {refreshing ? "갱신하는 중..." : "토큰 갱신"}
      </LineButton>
      {refreshResult.state === "success" && (
        <p role="status" className="flex items-center gap-2 text-[13px] font-bold">
          <Check size={14} aria-hidden="true" className="flex-none" />
          갱신했어요 — {formatKoreanDate(new Date(refreshResult.expiresAt))}까지 유효해요.
        </p>
      )}
      {refreshResult.state === "failed" && (
        <p role="alert" className="flex items-center gap-2 text-[13px] text-ink-2">
          <CircleAlert size={14} aria-hidden="true" className="flex-none" />
          {refreshResult.message}
        </p>
      )}
    </div>
  );
}

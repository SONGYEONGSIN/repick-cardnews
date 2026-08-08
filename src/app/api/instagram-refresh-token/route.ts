import { daysRemaining, friendlyRefreshMessage, parseStoredExpiresAt } from "@/lib/instagram-token-refresh";
import { refreshInstagramTokenNow } from "@/lib/instagram-token-refresh-runtime";

/**
 * GET /api/instagram-refresh-token — 지금 저장된 만료일을 읽기 전용으로 알려준다(자동 갱신·
 * 수동 갱신이 성공했을 때 `.env.local`의 `INSTAGRAM_TOKEN_EXPIRES_AT`에 남긴 값). 실제
 * 인스타그램 API를 부르지 않고 토큰 값도 어디에도 담기지 않는다. 모든 `/api/*` 와 마찬가지로
 * 로그인해야 부를 수 있다(`src/middleware.ts`).
 */
export async function GET() {
  const expiresAt = parseStoredExpiresAt(process.env.INSTAGRAM_TOKEN_EXPIRES_AT);
  if (!expiresAt) {
    return Response.json({ expiresAt: null, expired: false, daysRemaining: null });
  }

  const now = new Date();
  const expired = expiresAt.getTime() <= now.getTime();
  return Response.json({
    expiresAt: expiresAt.toISOString(),
    expired,
    daysRemaining: expired ? 0 : daysRemaining(now, expiresAt),
  });
}

/**
 * POST /api/instagram-refresh-token — 화면의 "토큰 갱신" 버튼. 실제로 인스타그램 갱신 API를
 * 부르고 성공하면 `.env.local`을 원자적으로 바꾼다 — **배포 서버에서는 그 파일을 못 고치므로
 * 아직 동작하지 않는다**(`docs/deploy-setup.md`). 로그인해야 부를 수 있다.
 * 24시간 미만이라 거절되는 것도 정상 상황으로 함께 내려준다(`reason: "too-soon"`) —
 * **토큰 값은 어떤 경우에도 응답에 담기지 않는다.**
 */
export async function POST(req: Request) {

  try {
    const result = await refreshInstagramTokenNow(process.env);
    if (result.ok) {
      return Response.json({ ok: true, expiresAt: result.expiresAt.toISOString() });
    }

    const status = result.reason === "config-missing" || result.reason === "token-line-missing" ? 400 : 502;
    return Response.json(
      { ok: false, reason: result.reason, error: friendlyRefreshMessage(result.reason) },
      { status },
    );
  } catch {
    return Response.json({ ok: false, error: "토큰 갱신에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

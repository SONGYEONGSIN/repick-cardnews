import { checkInstagramConfig } from "@/lib/instagram-config";
import { isLocalHost } from "@/lib/local-guard";
import { verifyInstagramConnection, friendlyVerifyError } from "@/lib/instagram";

/**
 * POST /api/instagram-verify — 화면의 "연결 확인" 버튼을 누를 때만 부르는 경로. 환경변수가
 * 채워졌는지만 보는 `/api/instagram-status`와 달리, 여기서는 실제로 Graph API 를 한 번
 * 호출해 토큰이 유효하고 설정된 계정 ID가 그 토큰이 가리키는 계정과 맞는지 확인한 뒤 계정
 * 이름(username)을 돌려준다 — 자세한 판정은 `@/lib/instagram`의 `verifyInstagramConnection`.
 *
 * `/api/publish`·`/api/share`와 같은 이유로 이 PC 브라우저에서만 부를 수 있게 막는다 — 이
 * 라우트도 실제 액세스 토큰으로 인스타그램 서버를 호출하는 액션이기 때문이다. 판정 기준과
 * 한계는 `@/lib/local-guard` 참고. **토큰 값은 이 응답에도 절대 담기지 않는다.**
 */
export async function POST(req: Request) {
  if (!isLocalHost(req.headers.get("host"))) {
    return Response.json(
      { error: "인스타그램 연결 확인은 이 컴퓨터의 브라우저에서만 할 수 있어요." },
      { status: 403 },
    );
  }

  const configCheck = checkInstagramConfig(process.env);
  if (!configCheck.ready) {
    return Response.json(
      { ok: false, error: `인스타그램 게시 설정이 없어요: ${configCheck.missing.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const { username } = await verifyInstagramConnection(configCheck.config);
    return Response.json({ ok: true, username });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyVerifyError(e) }, { status: 502 });
  }
}

import { checkInstagramConnectionConfig } from "@/lib/instagram-config";
import { verifyInstagramConnection, friendlyVerifyError } from "@/lib/instagram";

/**
 * POST /api/instagram-verify — 화면의 "연결 확인" 버튼을 누를 때만 부르는 경로. 환경변수가
 * 채워졌는지만 보는 `/api/instagram-status`와 달리, 여기서는 실제로 Graph API 를 한 번
 * 호출해 토큰이 유효하고 설정된 계정 ID가 그 토큰이 가리키는 계정과 맞는지 확인한 뒤 계정
 * 이름(username)을 돌려준다 — 자세한 판정은 `@/lib/instagram`의 `verifyInstagramConnection`.
 *
 * 공개 주소(`PUBLIC_BASE_URL`)는 여기서 필요 없다 — `checkInstagramConnectionConfig()`가
 * 보는 값(계정 ID·토큰)만으로 충분하다. 공개 주소는 인스타그램 서버가 사진을 가져갈 때만
 * 쓰이므로(`/api/publish` 참고), 터널을 아직 안 켜서 공개 주소가 없어도 토큰이 맞는지 먼저
 * 확인할 수 있다.
 *
 * `/api/publish`·`/api/share`와 같은 이유로 로그인한 사람만 부를 수 있다(`src/middleware.ts`)
 * — 이 라우트도 실제 액세스 토큰으로 인스타그램 서버를 호출하는 액션이기 때문이다.
 * **토큰 값은 이 응답에도 절대 담기지 않는다.**
 */
export async function POST(req: Request) {

  const connectionCheck = checkInstagramConnectionConfig(process.env);
  if (!connectionCheck.ready) {
    return Response.json(
      { ok: false, error: `연결 확인에 필요한 값이 없어요: ${connectionCheck.missing.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const { username } = await verifyInstagramConnection(connectionCheck.config);
    return Response.json({ ok: true, username });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyVerifyError(e) }, { status: 502 });
  }
}

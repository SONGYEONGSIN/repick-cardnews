import { checkInstagramConfig, checkInstagramConnectionConfig } from "@/lib/instagram-config";

/**
 * GET /api/instagram-status — 화면이 "인스타그램에 지금 바로 게시할 수 있는가"를 확인하는
 * 읽기 전용 경로. 게시 설정(공개 주소·비즈니스 계정 ID·액세스 토큰)은 서버만 알고 있고
 * 클라이언트로 나가면 안 되므로, 이 라우트는 `checkInstagramConfig()` 가 돌려주는 판정에서
 * **연결 여부와 (없을 때) 빠진 항목의 한국어 이름만** 골라 응답한다 — `ready: true` 여도
 * `config`(액세스 토큰 포함) 자체는 절대 실어 보내지 않는다.
 *
 * `ready: false` 일 때는 `connected` 를 함께 내려준다 — `checkInstagramConnectionConfig()`
 * (계정 ID·토큰만 봄)가 맞으면 `true`다. 화면은 이 값으로 "아직 연결도 안 됨"과 "연결은
 * 됐는데 공개 주소가 없어 게시 준비만 덜 됨"을 구분해 보여준다. `ready: true` 일 때는 어차피
 * 연결도 게시도 다 되는 상태라 `connected` 를 따로 보낼 필요가 없다.
 */
export async function GET() {
  const check = checkInstagramConfig(process.env);
  if (!check.ready) {
    const connectionCheck = checkInstagramConnectionConfig(process.env);
    return Response.json({ ready: false, connected: connectionCheck.ready, missing: check.missing });
  }
  return Response.json({ ready: true });
}

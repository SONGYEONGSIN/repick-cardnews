import { checkInstagramConfig } from "@/lib/instagram-config";

/**
 * GET /api/instagram-status — 화면이 "인스타그램에 지금 바로 게시할 수 있는가"를 확인하는
 * 읽기 전용 경로. 게시 설정(공개 주소·비즈니스 계정 ID·액세스 토큰)은 서버만 알고 있고
 * 클라이언트로 나가면 안 되므로, 이 라우트는 `checkInstagramConfig()` 가 돌려주는 판정에서
 * **연결 여부와 (없을 때) 빠진 항목의 한국어 이름만** 골라 응답한다 — `ready: true` 여도
 * `config`(액세스 토큰 포함) 자체는 절대 실어 보내지 않는다.
 */
export async function GET() {
  const check = checkInstagramConfig(process.env);
  if (!check.ready) {
    return Response.json({ ready: false, missing: check.missing });
  }
  return Response.json({ ready: true });
}

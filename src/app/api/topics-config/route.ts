/**
 * GET /api/topics-config — 화면이 "네이버 렌즈를 고를 수 있는지"를 알기 위한 최소 조회.
 *
 * **불리언 하나만 돌려준다.** 키 값이나 그 일부를 응답에 담으면 안 된다 — 이 응답은 브라우저로
 * 나가고 개발자 도구에 그대로 남는다.
 *
 * 한쪽만 설정된 경우도 `false` 다(`checkNaverDatalabConfig` 가 둘 다 있어야 `configured`).
 * 반쪽 설정으로 렌즈를 열어 주면 사용자가 100초를 기다린 끝에 실패를 보게 된다.
 */
import { checkNaverDatalabConfig } from "@/lib/topics-config";
import { isLocalHost } from "@/lib/local-guard";

export async function GET(req: Request) {
  if (!isLocalHost(req.headers.get("host"))) {
    return Response.json({ error: "이 컴퓨터의 브라우저에서만 확인할 수 있어요." }, { status: 403 });
  }
  return Response.json({ naverConfigured: checkNaverDatalabConfig(process.env).configured });
}

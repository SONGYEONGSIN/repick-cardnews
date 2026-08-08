import { z } from "zod/v4";
import { readPublishProgress } from "@/lib/publish-progress-store";

/**
 * GET /api/publish-progress — 지금 도는 인스타그램 게시가 어디까지 갔는지 읽기만 하는 경로.
 * 화면(`InstagramPublishPanel`)이 게시하는 동안 몇 초 간격으로 이 경로를 불러 "N장 중 M장
 * 준비 중" 같은 문구를 만든다.
 *
 * `/api/publish`와 같은 이유로 이 PC 브라우저에서만 부를 수 있게 막는다 — 게시 진행 상황도
 * 같은 와이파이의 다른 기기가 굳이 들여다볼 이유가 없는 내부 상태다.
 *
 * 도는 게시가 없으면(기록이 없거나 만료됐으면) 에러가 아니라 `progress: null`로 조용히
 * 답한다 — 폴링은 원래 "지금 아무것도 없을 수 있다"는 전제로 도는 것이라 404로 시끄럽게
 * 만들 이유가 없다. 응답에는 진행 상황만 담고, 토큰 값 자체는 절대 되돌려 보내지 않는다.
 */
const QuerySchema = z.object({ token: z.uuid("잘못된 공유 링크입니다") });

export async function GET(req: Request) {

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ token: url.searchParams.get("token") });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const progress = readPublishProgress(parsed.data.token, Date.now());
  return Response.json({ progress });
}

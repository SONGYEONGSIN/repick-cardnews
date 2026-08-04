import { readRecent } from "@/lib/ledger";
import { CardnewsFlow } from "@/features/cardnews/CardnewsFlow";
import { keywordFromParam } from "@/features/studio/switch-format";

/**
 * 첫 화면 = **카드뉴스 주제 화면**이다.
 *
 * 예전엔 여기가 별도 허브(카드뉴스/정보전달 고르기)였는데, 바로 다음 화면인 주제 화면에도
 * 같은 '어떤 형태로' 카드가 있어 **같은 선택을 두 번** 시켰다. 허브를 없애고 주제 화면을
 * 앞으로 당겼다 — 형태 전환은 그 화면 안에서 한다.
 *
 * 최근 만든 것은 원장(디스크)에서 읽으므로 서버에서 읽어 내려준다. 정보전달에서 형태를
 * 바꿔 넘어오면 주소에 주제가 실려 온다(`switch-format`) — 그 값으로 시작한다.
 */

// 최근 목록은 요청 시점의 원장을 읽어야 한다 — 정적 프리렌더면 빌드 때 값에 그대로 멈춘다.
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ keyword?: string | string[] }>;
}) {
  const [recent, params] = await Promise.all([readRecent(5), searchParams]);
  return <CardnewsFlow recent={recent} initialKeyword={keywordFromParam(params.keyword)} />;
}

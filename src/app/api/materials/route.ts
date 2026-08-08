/**
 * GET /api/materials — **빠른** 소재 찾기(급상승·키워드 검색).
 *
 * `/api/topics` 와 나눈 이유는 속도다. 여기는 **Claude 를 부르지 않아 1~2초**에 끝나고, 영상
 * 제목을 **날것 그대로** 돌려준다. 다듬는 일(100초)은 `/api/topics` 가 맡는다. 하나로 합치면
 * 빠른 길이 사라진다.
 *
 * 후보는 언제나 유튜브에서 온다 — 네이버는 후보를 만들 수 없다(검색어트렌드·쇼핑인사이트 모두
 * 키워드를 입력으로 요구한다).
 *
 * `/api/publish` 와 같은 이유로 로그인한 사람만 부를 수 있다(`src/middleware.ts`).
 */
import { checkYoutubeConfig } from "@/lib/topics-config";
import { fetchYoutubeTrendingCandidates, friendlyYoutubeError, parseCategoryIds } from "@/lib/youtube-trending";
import { fetchYoutubeSearchMaterials, friendlyYoutubeSearchError, type MaterialItem } from "@/lib/youtube-search";

export async function GET(req: Request) {

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  if (mode !== "trending" && mode !== "search") {
    return Response.json({ error: "어떤 방식으로 찾을지 알 수 없어요." }, { status: 400 });
  }

  const configCheck = checkYoutubeConfig(process.env);
  if (!configCheck.ready) {
    return Response.json({ error: `소재를 찾을 설정이 없어요: ${configCheck.missing.join(", ")}` }, { status: 400 });
  }
  const { youtubeApiKey } = configCheck.config;

  if (mode === "search") {
    const query = (url.searchParams.get("q") ?? "").trim();
    // 빈 검색어로 부르면 100유닛을 헛되이 쓴다 — 나가기 전에 막는다.
    if (!query) {
      return Response.json({ error: "무엇을 찾을지 알려 주세요." }, { status: 400 });
    }
    try {
      const items = await fetchYoutubeSearchMaterials(youtubeApiKey, query);
      return Response.json({ items, mode, query });
    } catch (e) {
      return Response.json({ error: friendlyYoutubeSearchError(e) }, { status: 502 });
    }
  }

  const categories = parseCategoryIds(url.searchParams.get("categories"));
  try {
    const result = await fetchYoutubeTrendingCandidates(youtubeApiKey, categories);
    const items: MaterialItem[] = result.candidates.map(({ videoId, title, channelTitle }) => ({
      videoId,
      title,
      channelTitle,
    }));
    const skipped = result.skippedCategories.map((c) => c.displayName);
    return Response.json({
      items,
      mode,
      youtubeCategories: result.usedCategories.map((c) => c.displayName),
      ...(skipped.length > 0 ? { skippedYoutubeCategories: skipped } : {}),
    });
  } catch (e) {
    return Response.json({ error: friendlyYoutubeError(e) }, { status: 502 });
  }
}

/**
 * GET /api/topics — 요즘 뜨는 것에서 카드뉴스 주제 후보를 뽑는다.
 *
 * 1. 유튜브 인기 급상승(한국, 생활 정보 카테고리만 — `@/lib/youtube-trending`)에서 후보를 가져온다.
 * 2. Claude가 30~40대 맘의 생활 정보로 바꿀 만한 것만 추리고, 그 안에서 자체 순위(rank)도
 *    매긴다(`@/lib/topic-curation`) — 데이터랩이 없거나 실패했을 때 이 순위가 유일한 정렬
 *    근거다.
 * 3. **네이버 데이터랩 설정이 있을 때만** 검색 비중으로 순위를 다시 매긴다(`@/lib/naver-datalab`).
 *    설정이 없으면 조용히 건너뛴다 — 오류가 아니다(`@/lib/topics-config`의 필수/선택 구분
 *    참고). **설정은 있는데 호출이 실패하면(예: 자격 증명 오류)도 전체를 죽이지 않는다** —
 *    이미 Claude가 만들어 둔 결과(110초 가까이 걸린 작업)를 버리지 않고 Claude 순위로
 *    폴백한다. 데이터랩은 설계상 선택 기능이라 "없으면 되는데 있는데 고장 나면 전체가
 *    죽는" 것은 앞뒤가 안 맞는다.
 * 4. 상위 10개 안팎을 돌려준다. **응답에 순위가 어느 근거(`rankedBy`)로 매겨졌는지 반드시
 *    담는다** — 데이터랩을 쓰지 않고 검색량 기준인 척하면 안 된다. "설정이 없어서
 *    Claude 순서"와 "연결하지 못해서 Claude 순서"는 사용자에게 다른 사실이라 `rankedBy`
 *    값 자체를 구분한다 — 후자는 자격 증명을 다시 확인해야 한다는 신호다.
 *
 * `/api/publish`와 같은 이유로 이 PC 브라우저에서만 호출할 수 있다(`@/lib/local-guard`).
 * **오래 걸린다** — 유튜브 3개 카테고리 병렬 호출이 1~2초, Claude 추리기가 실측 100초
 * 안팎(2026-08-02), 데이터랩이 붙으면 몇 초 더. 보통 100~110초다. 부르는 쪽은 이걸
 * 전제로 만들어야 한다 — 화면 진입만으로 자동 호출하면 사용자를 100초 세워 둔다.
 */
import { checkTopicsConfig } from "@/lib/topics-config";
import { isLocalHost } from "@/lib/local-guard";
import { fetchYoutubeTrendingCandidates, friendlyYoutubeError } from "@/lib/youtube-trending";
import { curateTopicsWithClaude, friendlyTopicCurationError, type CuratedTopic } from "@/lib/topic-curation";
import { rankKeywordsByNaverDatalab } from "@/lib/naver-datalab";

/** "상위 10개 안팎을 돌려준다"(사용자 지시). */
const TOP_N = 10;

type RankedBy = "naver-datalab" | "claude-no-naver-config" | "claude-naver-unavailable";

const NOTE_BY_BASIS: Record<RankedBy, string> = {
  "naver-datalab":
    "네이버 데이터랩에서 30~40대 여성 기준 상대 검색 비중을 조회해 정렬했어요(절대 검색량이 아니라 후보끼리의 상대 비교예요).",
  "claude-no-naver-config":
    "네이버 데이터랩 설정이 없어 Claude가 판단한 관련성 순서로 정렬했어요(실제 검색 비중은 반영되지 않았어요).",
  "claude-naver-unavailable":
    "네이버 데이터랩에 연결하지 못해 Claude가 판단한 관련성 순서로 정렬했어요 — 클라이언트 ID·시크릿 설정을 확인해 주세요(실제 검색 비중은 반영되지 않았어요).",
};

type TopicResult = { keyword: string; reason: string };

/** 결과가 상한보다 적을 때(0개 포함) 부족하다는 사실을 정직하게 알린다. 화면이 빈 배열만
 * 받고 "왜 없지?"로 헷갈리지 않게 한다. */
function buildScarcityMessage(count: number): string | undefined {
  if (count >= TOP_N) return undefined;
  if (count === 0) {
    return "오늘은 유튜브 인기 급상승 중 생활 정보로 다듬을 만한 주제가 없었어요. 잠시 후 다시 시도해 주세요.";
  }
  return `오늘은 생활 정보로 다듬을 만한 후보가 ${count}개뿐이었어요.`;
}

function topResultsByRank(curated: CuratedTopic[]): TopicResult[] {
  return [...curated]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, TOP_N)
    .map(({ keyword, reason }) => ({ keyword, reason }));
}

/** 유튜브 카테고리 일부가 실패해도 파이프라인은 계속 간다(`@/lib/youtube-trending`) — 그
 * 사실을 감추지 않고 건너뛴 카테고리 이름을 응답에 그대로 담는다. */
function respond(topics: TopicResult[], rankedBy: RankedBy, skippedYoutubeCategories: string[]) {
  const message = buildScarcityMessage(topics.length);
  return Response.json({
    topics,
    rankedBy,
    note: NOTE_BY_BASIS[rankedBy],
    ...(message ? { message } : {}),
    ...(skippedYoutubeCategories.length > 0 ? { skippedYoutubeCategories } : {}),
  });
}

export async function GET(req: Request) {
  if (!isLocalHost(req.headers.get("host"))) {
    return Response.json({ error: "트렌드 주제 가져오기는 이 컴퓨터의 브라우저에서만 할 수 있어요." }, { status: 403 });
  }

  const configCheck = checkTopicsConfig(process.env);
  if (!configCheck.ready) {
    return Response.json(
      { error: `트렌드 주제를 가져올 설정이 없어요: ${configCheck.missing.join(", ")}` },
      { status: 400 },
    );
  }
  const { config } = configCheck;

  let youtubeResult;
  try {
    youtubeResult = await fetchYoutubeTrendingCandidates(config.youtubeApiKey);
  } catch (e) {
    return Response.json({ error: friendlyYoutubeError(e) }, { status: 502 });
  }
  const skippedYoutubeCategories = youtubeResult.skippedCategories.map((c) => c.label);

  let curated: CuratedTopic[];
  try {
    curated = await curateTopicsWithClaude(youtubeResult.candidates);
  } catch (e) {
    return Response.json({ error: friendlyTopicCurationError(e) }, { status: 502 });
  }

  if (curated.length === 0) {
    return respond([], "claude-no-naver-config", skippedYoutubeCategories);
  }

  if (!config.naver) {
    return respond(topResultsByRank(curated), "claude-no-naver-config", skippedYoutubeCategories);
  }

  try {
    const ranked = await rankKeywordsByNaverDatalab(
      curated.map((t) => t.keyword),
      config.naver,
    );
    const reasonByKeyword = new Map(curated.map((t) => [t.keyword, t.reason]));
    const topics = ranked
      .slice(0, TOP_N)
      .map((r) => ({ keyword: r.keyword, reason: reasonByKeyword.get(r.keyword) ?? "" }));
    return respond(topics, "naver-datalab", skippedYoutubeCategories);
  } catch {
    // 데이터랩은 선택 기능이다 — 실패해도 Claude 가 이미 만들어 둔 결과를 버리지 않고
    // Claude 순위로 폴백한다. 원인(오류 본문·키 값)은 응답에 담지 않는다.
    return respond(topResultsByRank(curated), "claude-naver-unavailable", skippedYoutubeCategories);
  }
}

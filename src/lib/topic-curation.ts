/**
 * 유튜브 인기 급상승 후보를 30~40대 맘의 생활 정보 주제로 추린다 — 트렌드 주제
 * 파이프라인의 3단계. `@/app/api/generate/route.ts`가 카피를 만드는 방식(로컬 `claude -p`
 * + `--json-schema` 구조화 출력 + zod 재검증)을 그대로 따른다.
 *
 * 연예·정치·특정 사건처럼 생활 정보가 될 수 없는 후보는 버리고, 남은 것은 검색할 만한
 * 짧은 키워드로 다듬는다. 실제 `claude` 호출은 계정 사용량을 쓰므로 테스트에서는 절대
 * 부르지 않는다 — `curateTopicsWithClaude`는 `options.command`로 가짜 실행 파일을 주입할
 * 수 있다(`@/lib/claude-cli.test.ts`와 같은 stub 방식, 이 파일의 테스트 참고).
 */
import { z } from "zod/v4";
import type { ContentBlock } from "@/lib/prompt";
import type { YoutubeCandidate } from "@/lib/youtube-trending";
import { runClaudeCli, CliNotFound, CliFailed, CliTimeout, NoStructuredOutput } from "@/lib/claude-cli";

export function buildTopicCurationSystemPrompt(): string {
  return [
    "당신은 30~40대 자녀를 둔 부모(맘) 대상 생활 정보 인스타그램 계정의 주제 기획자입니다.",
    "아래 유튜브 인기 급상승(한국) 영상 목록에서, 30~40대 부모의 생활(육아·집안일·건강·재테크·",
    "교육·요리 등)에 실제로 도움이 되는 '생활 정보' 카드뉴스 주제로 바꿀 만한 것만 고르세요.",
    "",
    "제외할 것: 특정 연예인·정치인·정치 이슈처럼 생활 정보가 될 수 없는 것, 스포츠 경기",
    "결과나 단발성 사건처럼 금방 지나갈 화제, 영상 제목의 낚시성 표현을 그대로 베낀 것.",
    "",
    "고른 각 항목은 검색창에 칠 법한 짧은 키워드(브랜드명·특정 인물명은 빼고 일반화)로",
    "바꾸고, 왜 골랐는지 한 줄로 설명하세요. 확신이 없으면 포함하지 마세요 — 개수를",
    "채우려 애쓰지 마세요. 목록 전체에 생활 정보로 바꿀 만한 것이 하나도 없으면 topics를",
    "빈 배열로 내세요 — 연예·게임·음악처럼 생활 정보가 아닌 것을 억지로 비틀어 채우면",
    "안 됩니다.",
    "",
    "그리고 고른 항목끼리 30~40대 부모에게 얼마나 관련 있고 쓸모 있는지 순위(rank)를",
    "매기세요 — 1이 가장 관련 있고 쓸모 있는 항목입니다. 이 순위는 검색 데이터 없이 쓸 수",
    "있는 정렬 근거로 실제 쓰일 수 있으니 신중하게 매기세요.",
  ].join("\n");
}

export function buildTopicCurationUserContent(candidates: YoutubeCandidate[]): ContentBlock[] {
  const lines = candidates.map(
    (c, i) => `${i + 1}. 제목: ${c.title} | 채널: ${c.channelTitle} | 카테고리ID: ${c.categoryId}`,
  );
  const text = ["아래는 유튜브 인기 급상승(한국) 영상 목록입니다.", "", ...lines].join("\n");
  return [{ type: "text", text }];
}

export const CuratedTopicSchema = z.object({
  /** 데이터랩에 넣을 검색어. 짧고 일반화된 키워드 — 특정 인물명·브랜드명은 배제한다. */
  keyword: z.string().trim().min(1).max(20),
  /** 왜 이 키워드를 골랐는지 한 줄 설명. */
  reason: z.string().trim().min(1).max(60),
  /**
   * Claude 가 매긴 관련성 순위(1이 가장 관련 있음). 네이버 데이터랩 설정이 없을 때
   * `/api/topics`의 **유일한 정렬 근거**가 된다(`@/lib/topics-config`의 "선택" 참고) —
   * 그래서 optional 이 아니라 필수다.
   */
  rank: z.number().int().min(1),
});

export const CuratedTopicsSchema = z.object({
  topics: z.array(CuratedTopicSchema).max(30),
});

export type CuratedTopic = z.infer<typeof CuratedTopicSchema>;

/** Claude 는 성공했지만(CLI 자체는 실패하지 않음) 낸 값이 `CuratedTopicsSchema`를 다시
 * 통과하지 못했다. `--json-schema`가 모양은 강제해도 zod 재검증까지 대신하진 않는다 —
 * `@/app/api/generate/route.ts`가 `.refine()` 때문에 다시 검증하는 것과 같은 이유다. */
export class TopicCurationSchemaMismatch extends Error {}

const MODEL = "claude-opus-4-8";
/** `@/app/api/generate/route.ts`의 실측(24초)의 5배를 그대로 따른다 — 이 단계 자체의
 * 실측치는 아직 없다(입력이 후보 목록 텍스트뿐이라 사진을 보내는 generate 보다 가벼울
 * 가능성이 높지만, 과소 추정보다 같은 값을 쓰는 쪽이 안전하다). */
const TIMEOUT_MS = 120_000;

export type CurateTopicsOptions = {
  model?: string;
  timeoutMs?: number;
  /** 테스트에서 실제 `claude` 대신 가짜 실행 파일을 주입한다. */
  command?: string;
};

export async function curateTopicsWithClaude(
  candidates: YoutubeCandidate[],
  options: CurateTopicsOptions = {},
): Promise<CuratedTopic[]> {
  const raw = await runClaudeCli({
    system: buildTopicCurationSystemPrompt(),
    content: buildTopicCurationUserContent(candidates),
    jsonSchema: z.toJSONSchema(CuratedTopicsSchema),
    model: options.model ?? MODEL,
    timeoutMs: options.timeoutMs ?? TIMEOUT_MS,
    command: options.command,
  });

  const parsed = CuratedTopicsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TopicCurationSchemaMismatch("주제 추리기 결과가 스키마와 맞지 않습니다");
  }
  return parsed.data.topics;
}

/** CLI 가 한도를 알릴 때 쓰는 표현들 — `@/lib/api-errors.ts`의 같은 이름 함수와 동일한
 * 판정이다. 그 파일이 export 하지 않아 여기서 다시 둔다(정규식 한 줄 중복은 파일 간
 * 결합보다 싸다, `@/lib/instagram-token-refresh-runtime.ts`의 `DEFAULT_GRAPH_HOST`와 같은
 * 선택). */
function isUsageLimit(message: string): boolean {
  return /usage limit|rate.?limit/i.test(message);
}

/** 실패를 한국어 안내로 바꾼다. CLI 가 준 영문 사유를 그대로 보여주지 않는다. */
export function friendlyTopicCurationError(e: unknown): string {
  if (e instanceof CliNotFound) {
    return "Claude Code CLI를 찾을 수 없어요. `claude` 설치를 확인해 주세요.";
  }
  if (e instanceof CliTimeout) {
    return "주제를 추리는 데 너무 오래 걸려 중단했어요. 다시 시도해 주세요.";
  }
  if (e instanceof NoStructuredOutput || e instanceof TopicCurationSchemaMismatch) {
    return "주제 추리기 결과가 예상과 맞지 않아요. 다시 시도해 주세요.";
  }
  if (e instanceof CliFailed) {
    return isUsageLimit(e.message)
      ? "Claude 사용량 한도에 걸렸어요. 같은 계정으로 Claude Code 같은 다른 작업이 돌고 있다면 끝난 뒤 다시 시도해 주세요."
      : "주제 추리기에 실패했어요. 잠시 후 다시 시도해 주세요.";
  }
  if (e instanceof Error) return e.message;
  return "주제를 추리는 중 오류가 났어요. 다시 시도해 주세요.";
}

/**
 * 트렌드 주제 파이프라인(GET /api/topics)에 필요한 서버 환경변수를 읽고 "지금 파이프라인을
 * 돌릴 수 있는가"를 판정한다. `@/lib/instagram-config`(`checkInstagramConnectionConfig`·
 * `checkInstagramConfig` 두 층으로 나눈 것)와 같은 방식이다 — 순수 함수라 `process.env`를
 * 직접 읽지 않고 호출 쪽이 넘긴 값으로 테스트한다.
 *
 * **필수/선택이 인스타그램 설정과 다르다**: 유튜브 API 키만 있으면 파이프라인이 돈다(1단계
 * 유튜브 → 2단계 Claude가 추리기+순위 매기기). 네이버 데이터랩 클라이언트 ID·시크릿은
 * **선택**이다 — 네이버가 데이터랩 API를 별도 제휴 신청으로 옮겨 지금 신청 화면에 안 보일 수
 * 있다(2026-08-02 기준). 없어도 오류로 만들지 않고 조용히 건너뛴다 — 있으면 검색 비중으로
 * 다시 순위를 매기는 데 쓴다(`@/lib/naver-datalab`, `@/app/api/topics/route.ts`).
 *
 * **시크릿 값 자체는 `missing`에는 절대 담기지 않지만, `ready: true`일 때 돌아오는
 * `config`에는 그대로 담긴다** — 호출 쪽(`/api/topics`)이 응답 바디에 이 `config`를 그대로
 * 실어 보내면 안 된다(`checkInstagramConfig`와 동일한 책임 분리).
 */

const ENV_KEYS = {
  youtubeApiKey: "YOUTUBE_API_KEY",
  naverClientId: "NAVER_CLIENT_ID",
  naverClientSecret: "NAVER_CLIENT_SECRET",
} as const;

const ENV_LABELS = {
  youtubeApiKey: `유튜브 API 키(${ENV_KEYS.youtubeApiKey})`,
} as const;

/** 필수 — 유튜브 인기 급상승을 가져오는 데만 있으면 된다. */
export type YoutubeConfig = { youtubeApiKey: string };
export type YoutubeConfigCheck = { ready: true; config: YoutubeConfig } | { ready: false; missing: string[] };

export function checkYoutubeConfig(env: Record<string, string | undefined>): YoutubeConfigCheck {
  const youtubeApiKey = env[ENV_KEYS.youtubeApiKey]?.trim();
  if (!youtubeApiKey) {
    return { ready: false, missing: [ENV_LABELS.youtubeApiKey] };
  }
  return { ready: true, config: { youtubeApiKey } };
}

/** 선택 — 데이터랩 클라이언트 ID·시크릿. */
export type NaverDatalabAuthConfig = { clientId: string; clientSecret: string };
export type NaverDatalabConfigCheck = { configured: true; config: NaverDatalabAuthConfig } | { configured: false };

/**
 * 둘 다 있어야만 "설정됨"이다 — 하나만 있으면(오타 등) 실패할 API 호출을 시도하는 대신
 * "설정 안 됨"으로 조용히 넘어간다. 선택 기능이 부분 입력 때문에 파이프라인을 막으면 안 된다.
 */
export function checkNaverDatalabConfig(env: Record<string, string | undefined>): NaverDatalabConfigCheck {
  const clientId = env[ENV_KEYS.naverClientId]?.trim();
  const clientSecret = env[ENV_KEYS.naverClientSecret]?.trim();
  if (!clientId || !clientSecret) {
    return { configured: false };
  }
  return { configured: true, config: { clientId, clientSecret } };
}

/** 합성 — 필수(유튜브)만 준비 여부를 가르고, 선택(네이버)은 있으면 담고 없으면 `null`. */
export type TopicsConfig = YoutubeConfig & { naver: NaverDatalabAuthConfig | null };
export type TopicsConfigCheck = { ready: true; config: TopicsConfig } | { ready: false; missing: string[] };

export function checkTopicsConfig(env: Record<string, string | undefined>): TopicsConfigCheck {
  const youtubeCheck = checkYoutubeConfig(env);
  if (!youtubeCheck.ready) {
    return youtubeCheck;
  }
  const naverCheck = checkNaverDatalabConfig(env);
  return {
    ready: true,
    config: {
      ...youtubeCheck.config,
      naver: naverCheck.configured ? naverCheck.config : null,
    },
  };
}

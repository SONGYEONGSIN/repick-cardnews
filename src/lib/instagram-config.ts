/**
 * 인스타그램 게시에 필요한 서버 환경변수를 읽고 "지금 게시할 수 있는 상태인가"를 판정한다.
 *
 * 순수 함수다 — `process.env`를 직접 읽지 않고 호출 쪽이 넘긴 값으로 판정해 테스트하기 쉽다.
 * 하나라도 없으면 던지지 않고 무엇이 없는지 한국어 이름으로 돌려준다(화면이 그대로 보여 줄 수
 * 있게). **`accessToken` 값 자체는 이 결과의 `missing` 목록에 절대 담기지 않는다** — 항목
 * 이름만 담긴다. `ready: true`일 때 돌아오는 `config.accessToken`도 서버 안에서 게시 클라이언트가
 * 읽을 뿐, 이 값을 API 라우트 응답에 그대로 실어 보내면 안 된다(호출 쪽 책임).
 */

export type InstagramConfig = {
  /** 우리 이미지가 바깥에서 닿는 공개 base URL. 예: https://xxxx.ngrok-free.app */
  publicBaseUrl: string;
  /** 인스타그램 비즈니스 계정 ID (Graph API 의 {ig-user-id}). */
  businessAccountId: string;
  /** 장기 액세스 토큰. 절대 클라이언트로 내보내지 않는다. */
  accessToken: string;
  /**
   * Graph API 호스트. 공식 문서(Instagram Login 방식) 예제는 `graph.instagram.com` 을 쓴다.
   * Facebook Login 방식 등 다른 연동이면 값이 다를 수 있어 환경변수로 갈아 끼울 수 있게 뺐다.
   * 필수 항목이 아니다 — 없으면 기본값을 쓰고, 게시 가능 여부(`missing`)에 영향을 주지 않는다.
   */
  graphHost: string;
};

export type InstagramConfigCheck =
  | { ready: true; config: InstagramConfig }
  | { ready: false; missing: string[] };

const ENV_KEYS = {
  publicBaseUrl: "PUBLIC_BASE_URL",
  businessAccountId: "INSTAGRAM_BUSINESS_ACCOUNT_ID",
  accessToken: "INSTAGRAM_ACCESS_TOKEN",
  graphHost: "INSTAGRAM_GRAPH_HOST",
} as const;

const ENV_LABELS = {
  publicBaseUrl: `공개 주소(${ENV_KEYS.publicBaseUrl})`,
  businessAccountId: `인스타그램 비즈니스 계정 ID(${ENV_KEYS.businessAccountId})`,
  accessToken: `인스타그램 액세스 토큰(${ENV_KEYS.accessToken})`,
} as const;

/** 공식 문서(Instagram Login 방식) 예제가 쓰는 호스트. `INSTAGRAM_GRAPH_HOST` 가 없을 때 쓴다. */
const DEFAULT_GRAPH_HOST = "graph.instagram.com";

export function checkInstagramConfig(env: Record<string, string | undefined>): InstagramConfigCheck {
  const publicBaseUrl = env[ENV_KEYS.publicBaseUrl]?.trim();
  const businessAccountId = env[ENV_KEYS.businessAccountId]?.trim();
  const accessToken = env[ENV_KEYS.accessToken]?.trim();
  const graphHost = env[ENV_KEYS.graphHost]?.trim() || DEFAULT_GRAPH_HOST;

  const missing: string[] = [];
  if (!publicBaseUrl) missing.push(ENV_LABELS.publicBaseUrl);
  if (!businessAccountId) missing.push(ENV_LABELS.businessAccountId);
  if (!accessToken) missing.push(ENV_LABELS.accessToken);

  if (!publicBaseUrl || !businessAccountId || !accessToken) {
    return { ready: false, missing };
  }

  return { ready: true, config: { publicBaseUrl, businessAccountId, accessToken, graphHost } };
}

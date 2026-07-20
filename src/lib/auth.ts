export type AuthMode = "api_key" | "oauth" | "none";

type AuthEnv = {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_AUTH_TOKEN?: string;
  CLAUDE_CODE_OAUTH_TOKEN?: string;
  [key: string]: string | undefined;
};

/**
 * Reads only the relevant env keys and returns which credential is available.
 * Precedence: ANTHROPIC_API_KEY > (ANTHROPIC_AUTH_TOKEN | CLAUDE_CODE_OAUTH_TOKEN) > none.
 */
export function resolveAuthMode(env: AuthEnv): AuthMode {
  if (env.ANTHROPIC_API_KEY) return "api_key";
  if (env.ANTHROPIC_AUTH_TOKEN || env.CLAUDE_CODE_OAUTH_TOKEN) return "oauth";
  return "none";
}

/**
 * Returns the OAuth token string (ANTHROPIC_AUTH_TOKEN takes precedence over
 * CLAUDE_CODE_OAUTH_TOKEN) or undefined if neither is set.
 */
export function oauthToken(env: AuthEnv): string | undefined {
  return env.ANTHROPIC_AUTH_TOKEN ?? env.CLAUDE_CODE_OAUTH_TOKEN;
}

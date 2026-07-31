/**
 * `claude -p` 호출 실패를 사용자에게 보여 줄 한국어 문장으로 바꾼다.
 *
 * CLI 는 실패 사유를 영어 산문으로 준다. 그대로 흘리면 사용자가 읽을 수 없고,
 * stderr 에는 JSON 이 섞여 나오기도 한다. 한도 판정에만 원문을 쓰고 문구는 고정한다.
 */
import { CliNotFound, CliFailed, CliTimeout, NoStructuredOutput } from "@/lib/claude-cli";

export const SCHEMA_MISMATCH = "카피 생성 결과가 스키마와 맞지 않습니다. 다시 시도해주세요.";

/** CLI 가 한도를 알릴 때 쓰는 표현들. */
function isUsageLimit(message: string): boolean {
  return /usage limit|rate.?limit/i.test(message);
}

export function friendlyGenerateError(e: unknown): string {
  if (e instanceof CliNotFound) {
    return "Claude Code CLI를 찾을 수 없어요. `claude` 설치를 확인해 주세요.";
  }
  if (e instanceof CliTimeout) {
    return "생성이 너무 오래 걸려 중단했어요. 다시 시도해 주세요.";
  }
  if (e instanceof NoStructuredOutput) {
    return SCHEMA_MISMATCH;
  }
  if (e instanceof CliFailed) {
    return isUsageLimit(e.message)
      ? "Claude 사용량 한도에 걸렸어요. 같은 계정으로 Claude Code 같은 다른 작업이 돌고 있다면 끝난 뒤 다시 시도해 주세요."
      : "카피 생성에 실패했어요. 잠시 후 다시 시도해 주세요.";
  }
  // 여기까지 온 오류는 우리 코드가 던진 것이라 메시지가 이미 한국어다.
  if (e instanceof Error) return e.message;
  return "생성 중 오류가 났어요. 다시 시도해 주세요.";
}

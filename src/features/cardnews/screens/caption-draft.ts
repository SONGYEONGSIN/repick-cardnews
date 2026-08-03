import { MAX_HASHTAGS } from "@/lib/hashtags";
import { isBlankText } from "@/templates/layout-utils";

/**
 * 캡션·해시태그의 **첫 초안**. 빈 칸을 마주하는 대신 고칠 거리를 준다 — 카드에 이미 있는 글과
 * 주제에서 뽑으므로 없는 말을 지어내지 않는다.
 *
 * 순수 함수다(이 저장소 vitest 는 `environment: "node"` 라 렌더 테스트를 못 쓴다).
 */

/** 인스타 캡션 상한. `/api/schedule`·`/api/publish` 가 같은 값으로 막는다. */
const CAPTION_MAX = 2200;

/**
 * 첫 헤드라인을 첫 줄로 두고 나머지를 아래에 나열한다 — 후크가 캡션의 첫인상이라 그대로 쓴다.
 * 헤드라인이 하나도 없으면 주제라도 남긴다.
 */
export function defaultCaption(keyword: string, headings: readonly string[]): string {
  const kept = headings.filter((h) => !isBlankText(h)).map((h) => h.trim());
  if (kept.length === 0) return keyword.trim();

  const [first, ...rest] = kept;
  const body = rest.map((h) => `· ${h}`).join("\n");
  const caption = rest.length > 0 ? `${first}\n\n${body}` : first;
  return caption.slice(0, CAPTION_MAX);
}

/**
 * 주제에서 태그를 뽑는다 — 붙여 쓴 것 하나와 낱말들. **주제 밖의 말을 지어내지 않는다**:
 * "일상"·"정보" 같은 범용 태그를 넣으면 사용자가 안 쓴 말이 게시물에 붙는다.
 *
 * `#` 은 붙이지 않는다(`@/lib/hashtags` 의 관례 — 합칠 때 붙인다).
 */
export function defaultHashtags(keyword: string): string[] {
  const words = keyword
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (words.length === 0) return [];

  const joined = words.join("");
  const out: string[] = [];
  for (const tag of [joined, ...words]) {
    if (out.length >= MAX_HASHTAGS) break;
    if (!out.includes(tag)) out.push(tag);
  }
  return out;
}

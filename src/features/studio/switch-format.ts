/**
 * 형태 전환(`/` ↔ `/info`)에서 **주제를 잃지 않게** 하는 두 조각.
 *
 * 두 형식은 서로 다른 라우트라, 전환은 곧 페이지 이동이고 넘어간 화면은 상태를 새로 만든다.
 * 그래서 주소에 주제를 실어 보내고(`switchHref`) 받는 쪽이 그 값으로 시작한다
 * (`keywordFromParam`). 순서를 강제하는 대신 언제 바꿔도 안 잃게 하는 쪽을 골랐다 —
 * 형태를 먼저 고르게 해도 "주제를 쓴 뒤 마음이 바뀌는" 경우는 그대로 남는다.
 *
 * 순수 함수다 — 이 저장소 vitest 는 `environment: "node"` 라 화면을 못 그린다.
 */

/** 주제 입력칸의 `maxLength` 와 같아야 한다 — 주소로 더 긴 값을 밀어 넣지 못하게 막는다. */
export const KEYWORD_MAX = 60;

/** 다른 형태로 건너갈 주소. 주제가 비어 있으면 아무것도 붙이지 않는다. */
export function switchHref(path: string, keyword: string): string {
  const trimmed = keyword.trim();
  if (trimmed.length === 0) return path;
  return `${path}?${new URLSearchParams({ keyword: trimmed })}`;
}

/**
 * 주소에서 읽은 주제. 없으면 빈 문자열이다.
 *
 * 값은 사용자가 손댈 수 있는 자리라 입력칸과 같은 규칙으로 다듬는다 — 한 줄로 접고, 앞뒤
 * 공백을 떼고, 상한까지만 받는다.
 */
export function keywordFromParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, KEYWORD_MAX);
}

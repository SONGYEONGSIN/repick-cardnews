/**
 * 사용자에게 보일 오류 문구를 고른다.
 *
 * 한글이 든 것만 그대로 쓴다 — 서버가 만든 한국어(`api-errors.ts`)와 이 화면들의 우리 문구는
 * 통과하고, 브라우저·파일시스템 API 가 던진 영문(`Failed to fetch`, 파일 읽기 `DOMException`,
 * 캡처·저장 실패 등)은 안내 문구로 갈아 끼운다. 이 프로젝트는 영어 원문이나 JSON 을 사용자에게
 * 노출하지 않는다.
 *
 * `WorkbenchScreen`(카피 생성·사진 읽기)과 `ExportScreen`(다운로드·폴더 저장) 두 화면이 함께
 * 쓴다 — 한쪽만 거르면 나머지 경로로 영문이 샌다.
 */
export function inKorean(raw: string, fallback: string): string {
  return /[가-힣]/.test(raw) ? raw : fallback;
}

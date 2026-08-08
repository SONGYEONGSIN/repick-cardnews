/**
 * 사진을 받아들일 때의 **판단** — 무엇을 받고, 무엇이 왜 빠졌는지.
 *
 * 예전에는 확장자 셋(`jpg`·`png`·`webp`)만 통과시키고 **나머지를 말없이 버렸다.** 파일 선택은
 * `accept="image/*"` 로 다 받아 놓고서다. 그래서 아이폰에서 5장을 고르면 HEIC 한 장이 조용히
 * 사라져 4장만 들어갔다(2026-08-09 사장님 보고).
 *
 * 조용히 버리는 게 문제의 본체였다 — 형식을 넓히는 것보다 **빠진 것을 말해 주는 것**이 더
 * 중요하다. 어떤 형식은 브라우저가 못 열 수도 있는데(데스크톱 크롬은 HEIC 를 못 읽는다),
 * 그때도 "몇 장이 왜 안 들어갔는지" 는 말할 수 있다.
 */

export type SkipReason = "not-image" | "unreadable";
export type Skipped = { name: string; reason: SkipReason };

/** 브라우저가 못 알아보는 파일이 있어 확장자도 함께 본다 — 폴더에서 온 파일은 `type` 이 빌 수 있다. */
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif|avif|bmp|tiff?)$/i;

export function isLikelyImage(file: { name: string; type?: string }): boolean {
  if (file.type?.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name);
}

const REASON_TEXT: Record<SkipReason, string> = {
  "not-image": "이미지 파일이 아니에요",
  unreadable: "이 브라우저가 못 여는 형식이에요",
};

/** 이름을 몇 개까지 대나. 다 늘어놓으면 문장이 화면을 넘긴다. */
const NAMES_SHOWN = 3;

/**
 * 빠진 게 있으면 한 줄로 말한다. 없으면 `null` — 잘 된 일에는 말을 붙이지 않는다.
 *
 * **몇 장 중 몇 장인지를 먼저 말한다.** 이름부터 대면 "그래서 몇 장 들어갔지?" 를 다시 세야 한다.
 */
export function skippedNotice(kept: number, skipped: Skipped[]): string | null {
  if (skipped.length === 0) return null;

  const total = kept + skipped.length;
  const shown = skipped.slice(0, NAMES_SHOWN);
  const rest = skipped.length - shown.length;

  const detail = shown.map((s) => `${s.name}(${REASON_TEXT[s.reason]})`).join(", ");
  const tail = rest > 0 ? ` 외 ${rest}개` : "";

  return `${total}장 중 ${kept}장만 넣었어요. 못 넣은 것: ${detail}${tail}`;
}

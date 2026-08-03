export const THUMB_MAX = 1024;

/** 4:5 판정 허용 오차 — 보정 과정에서 1~2px 어긋난 사진을 경고하지 않기 위한 폭 */
const RATIO_TOLERANCE = 0.02;

export type Photo = {
  id: string;
  name: string;
  /** 원본 dataURL — PNG 캡처용 */
  dataUrl: string;
  /** 최장변 THUMB_MAX로 줄인 dataURL — Claude 전송용 */
  thumbUrl: string;
  width: number;
  height: number;
  bytes: number;
};

export function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("base64 dataURL이 아닙니다");
  return { mediaType: m[1], base64: m[2] };
}

export function isFourFive(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return Math.abs(width / height - 0.8) <= RATIO_TOLERANCE;
}

export function downscaleSize(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const collator = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

export function compareFileNames(a: string, b: string): number {
  return collator.compare(a, b);
}

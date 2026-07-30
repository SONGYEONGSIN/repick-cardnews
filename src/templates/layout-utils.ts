export type Focal = { x: number; y: number };

export const DEFAULT_FOCAL: Focal = { x: 0.5, y: 0.5 };
/** 흰 텍스트가 사진 위에서 대비 4.5:1을 확보하는 하한 */
export const DEFAULT_SCRIM = 0.72;
export const DEFAULT_BAND_CARDNEWS = 0.6;
export const DEFAULT_BAND_INFO = 0.35;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function objectPosition(focal: Focal): string {
  return `${Math.round(clamp01(focal.x) * 100)}% ${Math.round(clamp01(focal.y) * 100)}%`;
}

export function scrimGradient(strength: number): string {
  const a = round2(clamp01(strength));
  const mid = round2(a * 0.75);
  return `linear-gradient(to top, rgba(0,0,0,${a}) 0%, rgba(0,0,0,${mid}) 34%, rgba(0,0,0,0) 68%)`;
}
